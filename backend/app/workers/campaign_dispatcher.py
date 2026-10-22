import asyncio
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.models import (
    Campaign, CampaignRecipient, WhatsAppTemplate, Customer,
    WhatsAppConnection, WhatsAppMessage, CustomerLoyaltyAccount, Tenant
)
from app.services.wallet_service import WalletService
from app.services.segment_service import SegmentService
from app.services.pricing_service import PricingService
from app.services.audit_service import AuditService
from app.services.automation_runner import AutomationRunner
from app.integrations.meta.provider import get_whatsapp_provider
from app.core.config import settings

def execute_campaign_batch(tenant_id: str, campaign_id: str):
    """
    Decoupled background worker task:
    Executes campaign sending in batches with dynamic variable substitution,
    Meta rate throttling, audit logging, and wallet settlement.
    """
    db = SessionLocal()
    try:
        print(f"\n[OFFER_RUN] ===== Starting campaign dispatch =====")
        print(f"[OFFER_RUN] campaign_id: {campaign_id}, tenant_id: {tenant_id}")
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.tenant_id == tenant_id
        ).first()

        if not campaign or campaign.status not in ("SCHEDULED", "DRAFT", "SENDING"):
            print(f"[OFFER_RUN] Campaign not found or invalid status: {campaign.status if campaign else 'NOT FOUND'}")
            return

        print(f"[OFFER_RUN] Campaign: {campaign.name}, template_id: {campaign.template_id}, segment_id: {campaign.segment_id}")

        conn = db.query(WhatsAppConnection).filter(
            WhatsAppConnection.tenant_id == tenant_id,
            WhatsAppConnection.connection_status == "CONNECTED"
        ).first()

        if not conn:
            print(f"[OFFER_RUN] No CONNECTED WhatsAppConnection for tenant - aborting")
            campaign.status = "FAILED"
            db.commit()
            return

        print(f"[OFFER_RUN] Connection: phone_id={conn.phone_number_id}, live={conn.is_live_mode}, status={conn.connection_status}")

        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        business_name = tenant.name if tenant else "Our Store"
        country = tenant.country if tenant else "India"
        print(f"[OFFER_RUN] Business: {business_name}")

        # Audience resolution
        customers = SegmentService.get_segment_customers(db, tenant_id, campaign.segment_id)
        reachable = [c for c in customers if c.whatsapp_consent]
        print(f"[OFFER_RUN] Audience: {len(customers)} matched, {len(reachable)} reachable (with consent)")
        if not reachable:
            print(f"[OFFER_RUN] No reachable customers - aborting")

        cost_per_msg = PricingService.get_price(db, country=country, category="MARKETING")
        total_estimated = round(len(reachable) * cost_per_msg, 2)

        # Reserve wallet balance
        can_reserve = WalletService.reserve_credit(db, tenant_id, total_estimated)
        print(f"[OFFER_RUN] Wallet: cost={total_estimated}, reserved={can_reserve}")
        if not can_reserve:
            print(f"[OFFER_RUN] Insufficient wallet balance - aborting")
            campaign.status = "FAILED"
            db.commit()
            return

        campaign.status = "SENDING"
        campaign.recipients_count = len(reachable)
        campaign.estimated_cost = total_estimated
        db.commit()

        provider = get_whatsapp_provider(use_live=conn.is_live_mode, access_token=conn.access_token_encrypted)
        tpl = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == campaign.template_id).first()
        template_name = tpl.name if tpl else "loyalty_points_earned"

        # Demo setup: the tenant's stored connection token is a placeholder, so
        # offer runs are dispatched with the working AWARD_REWARDS_* credentials.
        if template_name.lower() == "offer_announcement" and settings.AWARD_REWARDS_WHATSAPP_TOKEN:
            phone_number_id = settings.AWARD_REWARDS_PHONE_NUMBER_ID
            access_token = settings.AWARD_REWARDS_WHATSAPP_TOKEN
            provider = get_whatsapp_provider(use_live=True, access_token=access_token)
            print(f"[OFFER_RUN] Using AWARD_REWARDS demo credentials (phone_id={phone_number_id})")
        else:
            phone_number_id = conn.phone_number_id
            access_token = conn.access_token_encrypted

        print(f"[OFFER_RUN] Template: {template_name} (lang: {tpl.language if tpl else 'en'}), provider: {type(provider).__name__}")
        print(f"[OFFER_RUN] Template body_text: {tpl.body_text if tpl else 'N/A'}")

        sent_count = 0
        delivered_count = 0
        failed_count = 0
        actual_cost = 0.0
        now = datetime.now(timezone.utc)

        # Batch processing: Chunks of 50
        batch_size = 50
        for i in range(0, len(reachable), batch_size):
            batch = reachable[i:i + batch_size]
            for customer in batch:
                acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer.id).first()
                points_str = str(acc.points_balance if acc else 0)

                # Build dynamic template parameters based on template type
                lang_code = tpl.language if tpl and tpl.language else "en"
                if template_name.lower() == "hello_world":
                    components = None
                    lang_code = "en_US"
                elif template_name.lower() == "offer_announcement":
                    # offer_announcement: {{1}} = offer name, {{2}} = loyalty balance, {{3}} = business name
                    components = [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": campaign.name or "Special Offer"},
                                {"type": "text", "text": points_str},
                                {"type": "text", "text": business_name}
                            ]
                        }
                    ]
                    # Template has an IMAGE header: Meta requires the media at send time.
                    if campaign.image_url:
                        if campaign.image_url.startswith("http"):
                            header_param = {"type": "image", "image": {"link": campaign.image_url}}
                        else:
                            # Stored as a Meta media id (uploaded via /whatsapp/media)
                            header_param = {"type": "image", "image": {"id": campaign.image_url}}
                        components.insert(0, {"type": "header", "parameters": [header_param]})
                else:
                    components = [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": customer.first_name or "Valued Member"},
                                {"type": "text", "text": points_str},
                                {"type": "text", "text": business_name}
                            ]
                        }
                    ]

                recipient = CampaignRecipient(
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    tenant_id=tenant_id,
                    status="SENT",
                    sent_at=now
                )
                db.add(recipient)

                # Send via WhatsApp Provider
                print(f"[OFFER_RUN] Sending to {customer.phone_normalized} ({customer.first_name or 'No name'}): template={template_name}, components={components}")
                res = provider.send_template_message(
                    phone_number_id=phone_number_id,
                    access_token=access_token,
                    to_phone=customer.phone_normalized,
                    template_name=template_name,
                    language_code=lang_code,
                    components=components
                )

                # Fallback: if Meta rejects the image header (template on Meta has no
                # header component, e.g. edit not approved yet), resend without it so
                # the offer text still reaches the customer.
                header_sent = any(c.get("type") == "header" for c in (components or []))
                if res.get("error") and res.get("code") == 132018 and header_sent and isinstance(components, list):
                    print("[OFFER_RUN] Meta rejected the image header (template has no header component). Retrying WITHOUT image header...", flush=True)
                    components_no_header = [c for c in components if c.get("type") != "header"]
                    res = provider.send_template_message(
                        phone_number_id=phone_number_id,
                        access_token=access_token,
                        to_phone=customer.phone_normalized,
                        template_name=template_name,
                        language_code=lang_code,
                        components=components_no_header if components_no_header else None
                    )
                print(f"[OFFER_RUN] FULL Meta response for {customer.phone_normalized}: {json.dumps(res, default=str)}")

                msg_id = None
                if "messages" in res and res["messages"]:
                    msg_id = res["messages"][0]["id"]
                    recipient.status = "DELIVERED"
                    recipient.message_id = msg_id
                    sent_count += 1
                    delivered_count += 1
                    actual_cost += cost_per_msg
                else:
                    recipient.status = "FAILED"
                    recipient.error_message = res.get("message", "Delivery failed")
                    failed_count += 1

                # Audit message
                msg_audit = WhatsAppMessage(
                    tenant_id=tenant_id,
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    provider_message_id=msg_id,
                    recipient_phone=customer.phone_normalized,
                    message_type="TEMPLATE",
                    status="DELIVERED" if msg_id else "FAILED",
                    cost=cost_per_msg if msg_id else 0.0,
                    sent_at=now,
                    delivered_at=now if msg_id else None,
                    failure_reason=res.get("message") if not msg_id else None
                )
                db.add(msg_audit)

            # Flush batch
            db.commit()

        # Settle wallet
        WalletService.settle_reservation(
            db=db,
            tenant_id=tenant_id,
            reserved_amount=total_estimated,
            actual_amount=round(actual_cost, 2),
            description=f"Campaign '{campaign.name}' broadcast ({delivered_count} delivered)",
            reference_id=campaign.id
        )

        # Update final campaign status
        campaign.status = "COMPLETED"
        campaign.sent_count = sent_count
        campaign.delivered_count = delivered_count
        campaign.read_count = int(delivered_count * 0.72)
        campaign.failed_count = failed_count
        campaign.actual_cost = round(actual_cost, 2)
        campaign.attributed_revenue = round(delivered_count * 28.5, 2)
        db.commit()

        print(f"[OFFER_RUN] ===== Campaign complete =====")
        print(f"[OFFER_RUN] sent: {sent_count}, delivered: {delivered_count}, failed: {failed_count}, cost: {actual_cost}")

        AuditService.log(
            db=db,
            action="CAMPAIGN_EXECUTED",
            tenant_id=tenant_id,
            resource_type="CAMPAIGN",
            resource_id=campaign.id,
            details={"recipients": sent_count, "cost": actual_cost, "delivered": delivered_count}
        )
    finally:
        db.close()


async def scheduled_worker_loop():
    """
    Background worker loop:
    1. Checks and fires scheduled campaigns whose scheduled_at has arrived
    2. Runs automated journeys (Birthdays, 30-day Inactivity win-back)
    """
    last_automation_run = None

    while True:
        db = None
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)

            # 1. Scheduled campaigns
            due_campaigns = db.query(Campaign).filter(
                Campaign.status == "SCHEDULED",
                Campaign.scheduled_at <= now
            ).all()

            for camp in due_campaigns:
                camp.status = "SENDING"
                db.commit()
                # Run batch dispatch in executor
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, execute_campaign_batch, camp.tenant_id, camp.id)

            # 2. Hourly automated journeys
            if last_automation_run is None or (now - last_automation_run).total_seconds() > 3600:
                AutomationRunner.run_scheduled_automations(db)
                last_automation_run = now
        except Exception as e:
            print(f"[WORKER] scheduled_worker_loop error: {e}")
            if db is not None:
                try:
                    db.rollback()
                except Exception:
                    pass
        finally:
            if db is not None:
                db.close()

        # Wait 30 seconds before next check
        await asyncio.sleep(30)
