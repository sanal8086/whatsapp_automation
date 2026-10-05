import uuid
import hmac
import hashlib
import json
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from app.models.models import (
    WhatsAppConnection, WhatsAppTemplate, WhatsAppMessage,
    PlatformTemplate, WebhookEvent, Tenant, Customer, CampaignRecipient,
    CustomerConsent, Wallet, WhatsAppOnboardingSession
)
from app.services.wallet_service import WalletService
from app.services.pricing_service import PricingService
from app.services.audit_service import AuditService
from app.integrations.meta.provider import get_whatsapp_provider
# NOTE: [DEMO] Demo WhatsApp send function for Wervus Cafe. Remove before production.
from app.services.demo_whatsapp import send_wervus_demo_whatsapp
from app.core.config import settings
from app.core.crypto import encrypt_secret, decrypt_secret

class WhatsAppService:
    @staticmethod
    def get_or_create_connection(db: Session, tenant_id: str) -> WhatsAppConnection:
        conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant_id).first()
        if not conn:
            conn = WhatsAppConnection(
                tenant_id=tenant_id,
                connection_status="DISCONNECTED",
                business_verification_status="VERIFIED",
                phone_verification_status="VERIFIED",
                quality_rating="GREEN",
                is_live_mode=False
            )
            db.add(conn)
            db.commit()
            db.refresh(conn)
        return conn

    @staticmethod
    def connect_account(
        db: Session,
        tenant_id: str,
        display_phone_number: str,
        verified_name: str,
        waba_id: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        access_token: Optional[str] = None,
        is_live_mode: bool = False
    ) -> WhatsAppConnection:
        conn = WhatsAppService.get_or_create_connection(db, tenant_id)
        conn.display_phone_number = display_phone_number
        conn.verified_name = verified_name
        conn.waba_id = waba_id or f"waba_{tenant_id[:8]}"
        conn.phone_number_id = phone_number_id or f"phone_{tenant_id[:8]}"
        conn.is_live_mode = is_live_mode
        
        # Encrypt token at rest
        raw_token = access_token or "mock_access_token_xyz"
        conn.access_token_encrypted = encrypt_secret(raw_token)
        conn.connection_status = "CONNECTED"
        conn.connected_at = datetime.now(timezone.utc)
        conn.last_synced_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(conn)

        # In live mode, register phone and subscribe webhooks safely (won't fail on test accounts)
        provider = get_whatsapp_provider(use_live=is_live_mode, access_token=conn.access_token_encrypted)
        if is_live_mode and phone_number_id:
            try:
                provider.register_phone(phone_number_id, conn.access_token_encrypted)
            except Exception as e:
                print(f"[DEBUG] register_phone notice: {e}")
            if waba_id:
                try:
                    provider.subscribe_waba_webhooks(waba_id, conn.access_token_encrypted)
                except Exception as e:
                    print(f"[DEBUG] subscribe_waba_webhooks notice: {e}")

        # Provision templates into tenant catalog (including hello_world)
        WhatsAppService.provision_platform_templates(db, tenant_id, conn.waba_id)

        # If live credentials & WABA ID provided, auto-sync remote approved templates from Meta
        if is_live_mode and waba_id and access_token:
            try:
                remote_tpls = provider.sync_templates(waba_id, conn.access_token_encrypted)
                for rt in remote_tpls:
                    t_name = rt.get("name", "").lower()
                    if not db.query(WhatsAppTemplate).filter(
                        WhatsAppTemplate.tenant_id == tenant_id,
                        WhatsAppTemplate.name == t_name
                    ).first():
                        db.add(WhatsAppTemplate(
                            tenant_id=tenant_id,
                            waba_id=waba_id,
                            meta_template_id=rt.get("id"),
                            name=t_name,
                            category=rt.get("category", "MARKETING"),
                            language=rt.get("language", "en"),
                            status=rt.get("status", "APPROVED"),
                            body_text=rt.get("body_text", "Template content synced from Meta")
                        ))
                db.commit()
            except Exception as e:
                print(f"[DEBUG] Template auto-sync notice: {e}")

        # Ensure demo wallet has ample balance for broadcasting
        wallet = db.query(Wallet).filter(Wallet.tenant_id == tenant_id).first()
        if wallet and wallet.balance < 100.0:
            wallet.balance = 5000.0
            db.commit()

        # Audit log
        AuditService.log(
            db=db,
            action="WHATSAPP_CONNECTED",
            tenant_id=tenant_id,
            resource_type="WHATSAPP_CONNECTION",
            resource_id=conn.id,
            details={"phone": display_phone_number, "is_live": is_live_mode, "waba_id": conn.waba_id}
        )

        return conn

    @staticmethod
    def exchange_and_connect_embedded_signup(
        db: Session,
        tenant_id: str,
        code: Optional[str] = None,
        waba_id: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        display_phone_number: Optional[str] = None,
        verified_name: Optional[str] = None,
        is_sandbox_simulation: bool = False,
        redirect_uri: Optional[str] = None,
        access_token: Optional[str] = None,
        is_live_mode: bool = False
    ) -> WhatsAppConnection:
        """
        Connects WhatsApp account via:
        1. Direct live credentials (access_token, phone_number_id, waba_id) for demos/direct API, OR
        2. Official Meta Embedded Signup OAuth code exchange, OR
        3. Sandbox developer simulation.
        """
        # Case A: Direct live credentials provided
        if access_token and (is_live_mode or access_token.startswith("EAA")):
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            display_phone = display_phone_number or "+91 Registered Number"
            v_name = verified_name or (tenant.name if tenant else "WhatsApp Merchant")
            target_waba = waba_id or f"waba_{tenant_id[:12]}"
            target_phone_id = phone_number_id or f"phone_{tenant_id[:12]}"

            conn = WhatsAppService.connect_account(
                db=db,
                tenant_id=tenant_id,
                display_phone_number=display_phone,
                verified_name=v_name,
                waba_id=target_waba,
                phone_number_id=target_phone_id,
                access_token=access_token,
                is_live_mode=True
            )
            t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if t:
                t.status = "ACTIVE"
                db.commit()
            return conn

        # Case B: Meta OAuth Code Exchange
        is_live = (
            not is_sandbox_simulation and
            bool(code) and
            not settings.META_APP_ID.startswith("mock_")
        )

        provider = get_whatsapp_provider(use_live=is_live)

        if is_live and code:
            # 1. Exchange Meta authorization code for system user access token
            res = provider.exchange_embedded_signup_code(
                client_id=settings.META_APP_ID,
                client_secret=settings.META_APP_SECRET,
                code=code,
                redirect_uri=redirect_uri
            )
            if "error" in res or "access_token" not in res:
                error_msg = res.get("message") or (res.get("error", {}).get("message") if isinstance(res.get("error"), dict) else str(res.get("error")))
                raise HTTPException(status_code=400, detail=f"Meta OAuth code exchange failed: {error_msg}")

            access_token = res["access_token"]

            # 2. Discover WABA ID if not already captured from frontend postMessage
            if not waba_id:
                debug_info = provider.debug_token(access_token, settings.META_APP_ID, settings.META_APP_SECRET)
                granular_scopes = debug_info.get("data", {}).get("granular_scopes", [])
                for scope_item in granular_scopes:
                    if scope_item.get("scope") in ("whatsapp_business_management", "whatsapp_business_messaging"):
                        target_ids = scope_item.get("target_ids", [])
                        if target_ids:
                            waba_id = target_ids[0]
                            break

            # 3. Discover Phone Number ID and Verified Name from Meta
            if waba_id and (not phone_number_id or not display_phone_number):
                phone_list = provider.get_phone_numbers(waba_id, access_token)
                if phone_list:
                    primary_phone = phone_list[0]
                    phone_number_id = phone_number_id or primary_phone.get("id")
                    display_phone_number = display_phone_number or primary_phone.get("display_phone_number")
                    verified_name = verified_name or primary_phone.get("verified_name")

            # Fallbacks if still missing
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            display_phone_number = display_phone_number or "+91 Registered Number"
            verified_name = verified_name or (tenant.name if tenant else "WhatsApp Merchant")
            waba_id = waba_id or f"waba_{tenant_id[:12]}"
            phone_number_id = phone_number_id or f"phone_{tenant_id[:12]}"

            # 4. Connect account, register phone & subscribe webhooks
            conn = WhatsAppService.connect_account(
                db=db,
                tenant_id=tenant_id,
                display_phone_number=display_phone_number,
                verified_name=verified_name,
                waba_id=waba_id,
                phone_number_id=phone_number_id,
                access_token=access_token,
                is_live_mode=True
            )
        else:
            # Sandbox / Simulated connection
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            mock_waba = waba_id or f"waba_{uuid.uuid4().hex[:12]}"
            mock_phone_id = phone_number_id or f"pn_{uuid.uuid4().hex[:12]}"
            mock_display_phone = display_phone_number or f"+91 {uuid.uuid4().int % 9000000000 + 1000000000}"
            mock_verified_name = verified_name or (tenant.name if tenant else "Demo Store")
            mock_token = f"mock_token_{uuid.uuid4().hex[:20]}"

            conn = WhatsAppService.connect_account(
                db=db,
                tenant_id=tenant_id,
                display_phone_number=mock_display_phone,
                verified_name=mock_verified_name,
                waba_id=mock_waba,
                phone_number_id=mock_phone_id,
                access_token=mock_token,
                is_live_mode=False
            )

        # Transition tenant to ACTIVE
        t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if t:
            t.status = "ACTIVE"
            db.commit()
            db.refresh(t)

        return conn

    @staticmethod
    def disconnect_account(db: Session, tenant_id: str) -> WhatsAppConnection:
        conn = WhatsAppService.get_or_create_connection(db, tenant_id)
        conn.connection_status = "DISCONNECTED"
        db.commit()
        db.refresh(conn)

        AuditService.log(
            db=db,
            action="WHATSAPP_DISCONNECTED",
            tenant_id=tenant_id,
            resource_type="WHATSAPP_CONNECTION",
            resource_id=conn.id
        )
        return conn

    @staticmethod
    def skip_embedded_signup(db: Session, tenant_id: str) -> WhatsAppConnection:
        conn = WhatsAppService.get_or_create_connection(db, tenant_id)
        if conn.connection_status != "CONNECTED":
            conn.connection_status = "SKIPPED"

        # Set any CREATED / IN_PROGRESS WhatsAppOnboardingSession rows for the tenant to SKIPPED
        db.query(WhatsAppOnboardingSession).filter(
            WhatsAppOnboardingSession.tenant_id == tenant_id,
            WhatsAppOnboardingSession.status.in_(["CREATED", "IN_PROGRESS"])
        ).update({"status": "SKIPPED"}, synchronize_session=False)

        # Transition tenant to ACTIVE
        t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if t:
            t.status = "ACTIVE"

        db.commit()
        db.refresh(conn)

        AuditService.log(
            db=db,
            action="WHATSAPP_ONBOARDING_SKIPPED",
            tenant_id=tenant_id,
            resource_type="WHATSAPP_CONNECTION",
            resource_id=conn.id
        )
        return conn


    @staticmethod
    def provision_platform_templates(db: Session, tenant_id: str, waba_id: str):
        # 1. Guarantee hello_world template exists for tenant (Meta universal default)
        hw = db.query(WhatsAppTemplate).filter(
            WhatsAppTemplate.tenant_id == tenant_id,
            WhatsAppTemplate.name == "hello_world"
        ).first()
        if not hw:
            db.add(WhatsAppTemplate(
                tenant_id=tenant_id,
                waba_id=waba_id,
                meta_template_id=f"meta_hello_world_{tenant_id[:6]}",
                name="hello_world",
                category="UTILITY",
                language="en_US",
                status="APPROVED",
                header_text="Meta Verified Template",
                body_text="Welcome and congratulations! This message confirms your WhatsApp Business Cloud API integration is live and sending successfully.",
                footer_text="Official WhatsApp Cloud API Demo"
            ))

        # 2. Platform templates
        platform_templates = db.query(PlatformTemplate).all()
        for pt in platform_templates:
            existing = db.query(WhatsAppTemplate).filter(
                WhatsAppTemplate.tenant_id == tenant_id,
                WhatsAppTemplate.name == pt.key.lower()
            ).first()
            if not existing:
                merchant_tpl = WhatsAppTemplate(
                    tenant_id=tenant_id,
                    waba_id=waba_id,
                    platform_template_id=pt.id,
                    meta_template_id=f"meta_{pt.key.lower()}_{tenant_id[:6]}",
                    name=pt.key.lower(),
                    category=pt.category,
                    language=pt.language,
                    status="APPROVED",
                    header_text=pt.header_text,
                    body_text=pt.body_text,
                    footer_text=pt.footer_text,
                    buttons_json=pt.buttons_json
                )
                db.add(merchant_tpl)
        db.commit()

    @staticmethod
    def send_single_message(
        db: Session,
        tenant_id: str,
        to_phone: str,
        template_name: Optional[str] = None,
        custom_text: Optional[str] = None,
        campaign_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        components: Optional[List[Dict[str, Any]]] = None
    ) -> WhatsAppMessage:
        conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant_id).first()
        if not conn or conn.connection_status != "CONNECTED":
            raise HTTPException(status_code=400, detail="WhatsApp is not connected for this business")

        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        country = tenant.country if tenant else "India"
        category = "MARKETING" if template_name else "UTILITY"
        cost = PricingService.get_price(db, country=country, category=category)

        # Wallet check and debit
        WalletService.debit_wallet(
            db=db,
            tenant_id=tenant_id,
            amount=cost,
            description=f"WhatsApp message to {to_phone}",
            reference_type="DIRECT_MESSAGE"
        )

        # NOTE: [DEMO] Routing for Wervus Cafe client demo showcase. Remove before production.
        if tenant and tenant.slug == "wervus-cafe":
            lang = "en_US" if (template_name and template_name.lower() == "hello_world") else (settings.WERVUS_DEMO_LANGUAGE_CODE or "en")
            if template_name:
                tpl = db.query(WhatsAppTemplate).filter(
                    WhatsAppTemplate.tenant_id == tenant_id,
                    WhatsAppTemplate.name == template_name.lower()
                ).first()
                if tpl and tpl.language:
                    lang = tpl.language

            res = send_wervus_demo_whatsapp(
                db=db,
                to_phone=to_phone,
                template_name=template_name,
                language_code=lang,
                components=components,
                phone_number_id=conn.phone_number_id or settings.WERVUS_DEMO_PHONE_NUMBER_ID,
                access_token=conn.access_token_encrypted or settings.WERVUS_DEMO_WHATSAPP_TOKEN,
                custom_text=custom_text
            )
        else:
            provider = get_whatsapp_provider(use_live=conn.is_live_mode, access_token=conn.access_token_encrypted)
            if template_name:
                # Query template language for accurate Meta Cloud API matching
                tpl = db.query(WhatsAppTemplate).filter(
                    WhatsAppTemplate.tenant_id == tenant_id,
                    WhatsAppTemplate.name == template_name.lower()
                ).first()
                lang = tpl.language if tpl and tpl.language else ("en_US" if template_name.lower() == "hello_world" else "en")

                res = provider.send_template_message(
                    phone_number_id=conn.phone_number_id,
                    access_token=conn.access_token_encrypted,
                    to_phone=to_phone,
                    template_name=template_name,
                    language_code=lang,
                    components=components
                )
            else:
                res = provider.send_text_message(
                    phone_number_id=conn.phone_number_id,
                    access_token=conn.access_token_encrypted,
                    to_phone=to_phone,
                    text=custom_text or "Hello from your rewards club!"
                )
        # NOTE: [END DEMO]

        provider_msg_id = None
        status = "QUEUED"
        if "messages" in res and res["messages"]:
            provider_msg_id = res["messages"][0]["id"]
            status = "SENT"
        elif res.get("error"):
            status = "FAILED"

        now = datetime.now(timezone.utc)
        message = WhatsAppMessage(
            tenant_id=tenant_id,
            campaign_id=campaign_id,
            customer_id=customer_id,
            provider_message_id=provider_msg_id,
            recipient_phone=to_phone,
            message_type="TEMPLATE" if template_name else "TEXT",
            status=status,
            cost=cost,
            sent_at=now if status == "SENT" else None,
            failure_reason=res.get("message") if status == "FAILED" else None
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def verify_webhook_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
        """Validates X-Hub-Signature-256 HMAC-SHA256 signature using timing-safe comparison"""
        if not signature_header or not signature_header.startswith("sha256="):
            return False
        expected_hash = signature_header[7:]
        mac = hmac.new(settings.META_APP_SECRET.encode(), raw_body, hashlib.sha256)
        computed_hash = mac.hexdigest()
        return hmac.compare_digest(computed_hash, expected_hash)

    @staticmethod
    def process_webhook(db: Session, payload: Dict[str, Any], external_event_id: str) -> Dict[str, Any]:
        """
        Processes incoming Meta Cloud API webhook events:
        1. Deduplication via external_event_id
        2. Delivery status updates (sent, delivered, read, failed)
        3. Inbound customer replies and STOP / START opt-in consent updates
        """
        existing = db.query(WebhookEvent).filter(WebhookEvent.external_event_id == external_event_id).first()
        if existing:
            return {"status": "already_processed", "id": existing.id}

        event = WebhookEvent(
            provider="META",
            event_type="whatsapp_webhook_event",
            external_event_id=external_event_id,
            payload_json=payload,
            processing_status="PROCESSED"
        )
        db.add(event)
        db.flush()

        # Parse Meta changes
        entries = payload.get("entry", [])
        now = datetime.now(timezone.utc)
        status_updates_count = 0
        inbound_messages_count = 0

        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                
                # 1. Handle Status Updates (sent, delivered, read, failed)
                statuses = value.get("statuses", [])
                for st in statuses:
                    wamid = st.get("id")
                    new_status = st.get("status", "").upper() # SENT, DELIVERED, READ, FAILED
                    if not wamid:
                        continue
                    
                    msg = db.query(WhatsAppMessage).filter(WhatsAppMessage.provider_message_id == wamid).first()
                    if msg:
                        msg.status = new_status
                        if new_status == "SENT":
                            msg.sent_at = now
                        elif new_status == "DELIVERED":
                            msg.delivered_at = now
                        elif new_status == "READ":
                            msg.read_at = now
                        elif new_status == "FAILED":
                            msg.failed_at = now
                            errors = st.get("errors", [])
                            if errors:
                                msg.failure_code = str(errors[0].get("code", ""))
                                msg.failure_reason = errors[0].get("message", "Delivery failed")

                    # Update campaign recipient status if linked
                    recipient = db.query(CampaignRecipient).filter(CampaignRecipient.message_id == wamid).first()
                    if recipient:
                        recipient.status = new_status
                    status_updates_count += 1

                # 2. Handle Inbound Customer Messages & Opt-In/Opt-Out Keywords
                inbound_msgs = value.get("messages", [])
                for im in inbound_msgs:
                    sender_phone = im.get("from")
                    text_body = im.get("text", {}).get("body", "").strip()
                    msg_id = im.get("id")

                    if not sender_phone:
                        continue

                    # Find customer
                    customer = db.query(Customer).filter(Customer.phone_normalized.like(f"%{sender_phone[-10:]}")).first()
                    tenant_id = customer.tenant_id if customer else None

                    if tenant_id:
                        inbound_record = WhatsAppMessage(
                            tenant_id=tenant_id,
                            customer_id=customer.id if customer else None,
                            provider_message_id=msg_id,
                            recipient_phone=sender_phone,
                            direction="INBOUND",
                            message_type="TEXT",
                            status="DELIVERED",
                            cost=0.0,
                            sent_at=now,
                            delivered_at=now
                        )
                        db.add(inbound_record)

                        # Handle STOP/START consent keywords
                        upper_text = text_body.upper()
                        if upper_text in ("STOP", "UNSUBSCRIBE", "OPTOUT"):
                            customer.whatsapp_consent = False
                            consent = CustomerConsent(
                                tenant_id=tenant_id,
                                customer_id=customer.id,
                                channel="WHATSAPP",
                                consent_type="MARKETING",
                                status="OPT_OUT",
                                source="WHATSAPP_INBOUND",
                                proof_reference=f"Incoming message {msg_id}: {text_body}"
                            )
                            db.add(consent)
                        elif upper_text in ("START", "UNSTOP", "OPTIN"):
                            customer.whatsapp_consent = True
                            consent = CustomerConsent(
                                tenant_id=tenant_id,
                                customer_id=customer.id,
                                channel="WHATSAPP",
                                consent_type="MARKETING",
                                status="OPT_IN",
                                source="WHATSAPP_INBOUND",
                                proof_reference=f"Incoming message {msg_id}: {text_body}"
                            )
                            db.add(consent)

                    inbound_messages_count += 1

        db.commit()
        return {
            "status": "success",
            "event_id": event.id,
            "status_updates": status_updates_count,
            "inbound_messages": inbound_messages_count
        }

    @staticmethod
    def send_meta_template_direct(
        token: str,
        to_phone: str = "918590102027",
        phone_number_id: str = "1380171298507513",
        template_name: str = "reminderpet ",
        language_code: str = "en_US",
        api_version: str = "v25.0"
    ) -> Dict[str, Any]:
        """
        Directly sends a WhatsApp template message matching the Meta Graph API curl:
        POST https://graph.facebook.com/{api_version}/{phone_number_id}/messages
        Headers:
          Authorization: Bearer {token}
          Content-Type: application/json
        Body:
          {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {
              "name": template_name,
              "language": { "code": language_code }
            }
          }
        """
        import httpx
        url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        clean_token = decrypt_secret(token)
        headers = {
            "Authorization": f"Bearer {clean_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language_code
                }
            }
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                try:
                    data = res.json()
                except Exception:
                    data = {"status_code": res.status_code, "raw_response": res.text}
                return data
        except Exception as exc:
            return {"error": str(exc), "message": f"HTTP request failed: {str(exc)}"}

    @staticmethod
    def broadcast_to_mockuser_customers(
        db: Session,
        token: Optional[str] = None,
        phone_number_id: str = "1380171298507513",
        template_name: str = "reminderpet ",
        language_code: str = "en_US",
        api_version: str = "v25.0",
        tenant_slug: str = "goagain-demo",
        extra_phone_numbers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Broadcasts the template message to all customers in the mockuser setup (tenant 'goagain-demo'),
        plus any extra phone numbers (defaulting to 918590102027).
        Persists Campaign and WhatsAppMessage logs in the database.
        """
        from app.models.models import Campaign
        tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Mock user tenant '{tenant_slug}' not found. Run seed.py first.")

        # Determine access token: explicit token > connection stored token
        conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant.id).first()
        auth_token = token
        if not auth_token and conn and conn.access_token_encrypted:
            auth_token = conn.access_token_encrypted

        if not auth_token:
            raise HTTPException(
                status_code=400,
                detail="Meta WhatsApp access token is required. Pass 'token' or save access token in WhatsApp Settings."
            )

        # Gather target recipients from mock user tenant
        customers = db.query(Customer).filter(
            Customer.tenant_id == tenant.id,
            Customer.whatsapp_consent == True
        ).all()

        recipient_phones = []
        for c in customers:
            clean = c.phone_normalized.replace("+", "").replace(" ", "").replace("-", "")
            if clean and not any(r[0] == clean for r in recipient_phones):
                recipient_phones.append((clean, c.id, f"{c.first_name or ''} {c.last_name or ''}".strip()))

        # Add extra phone numbers (defaults to 918590102027)
        extras = extra_phone_numbers if extra_phone_numbers is not None else ["918590102027"]
        for ep in extras:
            clean = ep.replace("+", "").replace(" ", "").replace("-", "")
            if clean and not any(r[0] == clean for r in recipient_phones):
                cust = db.query(Customer).filter(
                    Customer.tenant_id == tenant.id,
                    Customer.phone_normalized == f"+{clean}"
                ).first()
                recipient_phones.append((clean, cust.id if cust else None, cust.first_name if cust else "VIP Customer"))

        # Create Campaign record for tracking
        now = datetime.now(timezone.utc)
        clean_tpl_name = template_name.strip()
        campaign = Campaign(
            tenant_id=tenant.id,
            name=f"MockUser Broadcast - {clean_tpl_name} ({now.strftime('%d %b %H:%M')})",
            channel="WHATSAPP",
            status="SENDING",
            recipients_count=len(recipient_phones),
            created_at=now
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)

        results = []
        sent_count = 0
        failed_count = 0

        for phone, cust_id, cust_name in recipient_phones:
            res = WhatsAppService.send_meta_template_direct(
                token=auth_token,
                to_phone=phone,
                phone_number_id=phone_number_id,
                template_name=template_name,
                language_code=language_code,
                api_version=api_version
            )

            is_success = "messages" in res and bool(res["messages"])
            provider_msg_id = res["messages"][0]["id"] if is_success else None

            if is_success:
                sent_count += 1
            else:
                failed_count += 1

            # Log WhatsAppMessage
            msg_record = WhatsAppMessage(
                tenant_id=tenant.id,
                campaign_id=campaign.id,
                customer_id=cust_id,
                provider_message_id=provider_msg_id,
                recipient_phone=f"+{phone}",
                message_type="TEMPLATE",
                status="SENT" if is_success else "FAILED",
                cost=0.78 if is_success else 0.0,
                sent_at=now if is_success else None,
                failure_reason=res.get("message") or (str(res.get("error")) if not is_success else None)
            )
            db.add(msg_record)

            results.append({
                "recipient_phone": phone,
                "recipient_name": cust_name,
                "status": "SENT" if is_success else "FAILED",
                "message_id": provider_msg_id,
                "response": res
            })

        campaign.status = "COMPLETED" if sent_count > 0 else "FAILED"
        campaign.sent_count = sent_count
        campaign.delivered_count = sent_count
        campaign.failed_count = failed_count
        db.commit()

        return {
            "campaign_id": campaign.id,
            "campaign_name": campaign.name,
            "template_name": template_name,
            "language_code": language_code,
            "phone_number_id": phone_number_id,
            "api_version": api_version,
            "total_recipients": len(recipient_phones),
            "sent_count": sent_count,
            "failed_count": failed_count,
            "results": results
        }

