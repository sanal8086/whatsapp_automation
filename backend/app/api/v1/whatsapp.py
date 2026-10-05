from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from datetime import datetime, timezone
from pydantic import BaseModel
from app.core.config import settings
from app.models.models import Tenant, WhatsAppConnection, WhatsAppTemplate, WhatsAppMessage, Customer, CustomerLoyaltyAccount, Campaign
from app.schemas.schemas import (
    WhatsAppConnectionOut, ConnectWhatsAppRequest, WhatsAppTemplateOut,
    WhatsAppTemplateCreate, SendTestMessageRequest, WhatsAppMessageOut,
    EmbeddedSignupCallbackRequest, MessagePricingOut
)
from app.services.whatsapp_service import WhatsAppService
from app.services.pricing_service import PricingService
from app.integrations.meta.provider import get_whatsapp_provider, MetaCloudApiProvider

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Cloud API"])

class VerifyCredentialsRequest(BaseModel):
    phone_number_id: str
    access_token: str
    waba_id: Optional[str] = None

class ClientDemoBroadcastRequest(BaseModel):
    recipient_phone: str
    recipient_name: Optional[str] = "Demo Client"
    template_name: Optional[str] = "hello_world"
    custom_text: Optional[str] = None
    add_as_customer: bool = True

@router.get("/connection", response_model=WhatsAppConnectionOut)
def get_connection(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    return WhatsAppService.get_or_create_connection(db, tenant.id)

@router.post("/verify-credentials")
def verify_credentials(
    req: VerifyCredentialsRequest,
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Live verification of Meta Cloud API credentials without storing anything.
    Validates token and Phone Number ID against Meta Graph API.
    """
    token_clean = req.access_token.strip()
    phone_id_clean = req.phone_number_id.strip()

    provider = MetaCloudApiProvider(api_version=settings.META_GRAPH_API_VERSION)
    phone_details = provider.get_phone_number_details(phone_id_clean, token_clean)

    if phone_details.get("error") or "error" in phone_details:
        err_msg = phone_details.get("message") or (phone_details.get("error", {}).get("message") if isinstance(phone_details.get("error"), dict) else str(phone_details.get("error")))
        return {
            "valid": False,
            "error": err_msg or "Failed to verify Phone Number ID with Meta Graph API"
        }

    templates_count = 0
    approved_templates = []
    if req.waba_id and req.waba_id.strip():
        try:
            remote_tpls = provider.sync_templates(req.waba_id.strip(), token_clean)
            approved_templates = [t.get("name") for t in remote_tpls if t.get("status") == "APPROVED"]
            templates_count = len(approved_templates)
        except Exception:
            pass

    return {
        "valid": True,
        "phone_number_id": phone_details.get("id", phone_id_clean),
        "display_phone_number": phone_details.get("display_phone_number", ""),
        "verified_name": phone_details.get("verified_name", ""),
        "quality_rating": phone_details.get("quality_rating", "GREEN"),
        "code_verification_status": phone_details.get("code_verification_status", "VERIFIED"),
        "templates_count": templates_count,
        "approved_templates": approved_templates
    }

@router.post("/connect", response_model=WhatsAppConnectionOut)
def connect_account(
    req: ConnectWhatsAppRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    # Auto-detect live mode if Meta access token starts with EAA
    is_live = req.is_live_mode or (bool(req.access_token) and req.access_token.strip().startswith("EAA"))
    conn = WhatsAppService.connect_account(
        db=db,
        tenant_id=tenant.id,
        display_phone_number=req.display_phone_number,
        verified_name=req.verified_name,
        waba_id=req.waba_id,
        phone_number_id=req.phone_number_id,
        access_token=req.access_token,
        is_live_mode=is_live
    )
    return conn

@router.get("/embedded-signup/config")
def get_embedded_signup_config(
    tenant: Tenant = Depends(get_current_tenant)
):
    """Returns Meta App ID and Configuration ID for launching Embedded Signup popup"""
    return {
        "app_id": settings.META_APP_ID,
        "config_id": settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID or "",
        "graph_version": settings.META_GRAPH_API_VERSION
    }

@router.post("/embedded-signup/callback", response_model=WhatsAppConnectionOut)
def embedded_signup_callback(
    req: EmbeddedSignupCallbackRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Exchanges Meta Embedded Signup code and registers merchant account"""
    return WhatsAppService.exchange_and_connect_embedded_signup(
        db=db,
        tenant_id=tenant.id,
        code=req.code,
        waba_id=req.waba_id,
        phone_number_id=req.phone_number_id,
        display_phone_number=req.display_phone_number,
        verified_name=req.verified_name
    )

@router.post("/disconnect", response_model=WhatsAppConnectionOut)
def disconnect_account(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    return WhatsAppService.disconnect_account(db, tenant.id)

@router.get("/templates", response_model=List[WhatsAppTemplateOut])
def get_templates(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    templates = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.tenant_id == tenant.id).all()
    if not templates:
        WhatsAppService.provision_platform_templates(db, tenant.id, f"waba_{tenant.id[:8]}")
        templates = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.tenant_id == tenant.id).all()
    return templates

@router.post("/templates/sync")
def sync_templates_from_meta(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Syncs approved message templates directly from Meta WABA"""
    conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant.id).first()
    if not conn or not conn.waba_id:
        raise HTTPException(status_code=400, detail="WABA account not configured")

    provider = get_whatsapp_provider(use_live=conn.is_live_mode, access_token=conn.access_token_encrypted)
    remote_templates = provider.sync_templates(conn.waba_id, conn.access_token_encrypted or "")

    synced_count = 0
    for rt in remote_templates:
        name = rt.get("name", "").lower()
        tpl = db.query(WhatsAppTemplate).filter(
            WhatsAppTemplate.tenant_id == tenant.id,
            WhatsAppTemplate.name == name
        ).first()
        if tpl:
            tpl.status = rt.get("status", "APPROVED")
            tpl.meta_template_id = rt.get("id")
            synced_count += 1
        else:
            new_tpl = WhatsAppTemplate(
                tenant_id=tenant.id,
                waba_id=conn.waba_id,
                meta_template_id=rt.get("id"),
                name=name,
                category=rt.get("category", "MARKETING"),
                language=rt.get("language", "en"),
                status=rt.get("status", "APPROVED"),
                body_text=rt.get("body_text", "Template content synced from Meta")
            )
            db.add(new_tpl)
            synced_count += 1
    db.commit()
    return {"status": "success", "synced_count": synced_count}

@router.post("/templates", response_model=WhatsAppTemplateOut)
def create_template(
    req: WhatsAppTemplateCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    tpl = WhatsAppTemplate(
        tenant_id=tenant.id,
        name=req.name.lower().replace(" ", "_"),
        category=req.category,
        language=req.language,
        header_text=req.header_text,
        body_text=req.body_text,
        footer_text=req.footer_text,
        buttons_json=req.buttons_json,
        status="APPROVED"
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl

@router.post("/send-test", response_model=WhatsAppMessageOut)
def send_test_message(
    req: SendTestMessageRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    msg = WhatsAppService.send_single_message(
        db=db,
        tenant_id=tenant.id,
        to_phone=req.phone,
        template_name=req.template_id,
        custom_text=req.custom_text
    )
    return msg

@router.post("/broadcast-client-demo")
def broadcast_client_demo(
    req: ClientDemoBroadcastRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Live WhatsApp Broadcast for Client Demonstration meetings.
    1. Validates connection and ensures test wallet balance.
    2. Registers client as active customer in CRM (optional).
    3. Creates a tracked Live Demo Campaign in database.
    4. Dispatches the WhatsApp template (e.g. hello_world) or custom message.
    5. Returns instant delivery confirmation or exact actionable Meta guidance.
    """
    conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant.id).first()
    if not conn or conn.connection_status != "CONNECTED":
        raise HTTPException(
            status_code=400,
            detail="WhatsApp is not connected yet. Please connect your Meta Phone Number ID and Access Token in WhatsApp Settings."
        )

    clean_phone = req.recipient_phone.replace(" ", "").replace("-", "")
    if not clean_phone.startswith("+"):
        if len(clean_phone) == 10:
            clean_phone = f"+91{clean_phone}"
        else:
            clean_phone = f"+{clean_phone}"

    # 1. Optionally register client as a VIP Customer in this merchant's CRM
    customer = None
    if req.add_as_customer:
        customer = db.query(Customer).filter(
            Customer.tenant_id == tenant.id,
            Customer.phone_normalized == clean_phone
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant.id,
                phone=clean_phone,
                phone_normalized=clean_phone,
                first_name=req.recipient_name or "Demo Guest",
                marketing_consent=True,
                whatsapp_consent=True,
                city="Demo"
            )
            db.add(customer)
            db.flush()

            # Create customer loyalty account with welcome bonus
            db.add(CustomerLoyaltyAccount(
                tenant_id=tenant.id,
                customer_id=customer.id,
                points_balance=250,
                lifetime_earned=250,
                lifetime_redeemed=0,
                current_tier="GOLD"
            ))
            db.commit()

    # 2. Create tracked Campaign record for client showcase
    now = datetime.now(timezone.utc)
    time_label = now.strftime("%d %b %H:%M")
    campaign_name = f"Client Showcase - {req.recipient_name or 'Live Demo'} ({time_label})"
    campaign = Campaign(
        tenant_id=tenant.id,
        name=campaign_name,
        channel="WHATSAPP",
        status="SENDING",
        recipients_count=1,
        created_at=now
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    # 3. Dispatch message
    try:
        tpl_name = (req.template_name or "hello_world").strip().lower()
        msg = WhatsAppService.send_single_message(
            db=db,
            tenant_id=tenant.id,
            to_phone=clean_phone,
            template_name=tpl_name,
            custom_text=req.custom_text,
            campaign_id=campaign.id,
            customer_id=customer.id if customer else None
        )
    except Exception as exc:
        campaign.status = "FAILED"
        campaign.failed_count = 1
        db.commit()
        return {
            "success": False,
            "status": "FAILED",
            "failure_reason": str(exc),
            "recipient_phone": clean_phone,
            "recipient_name": req.recipient_name,
            "template_name": req.template_name or "hello_world",
            "campaign_id": campaign.id,
            "message": f"Broadcast dispatch failed: {str(exc)}"
        }

    # 4. Process delivery result
    if msg.status in ("SENT", "DELIVERED"):
        campaign.status = "COMPLETED"
        campaign.sent_count = 1
        campaign.delivered_count = 1
        campaign.actual_cost = msg.cost
        campaign.attributed_revenue = 45.0
        db.commit()
        return {
            "success": True,
            "status": msg.status,
            "provider_message_id": msg.provider_message_id,
            "recipient_phone": clean_phone,
            "recipient_name": req.recipient_name,
            "template_name": req.template_name or "hello_world",
            "campaign_id": campaign.id,
            "cost": msg.cost,
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
            "message": f"WhatsApp broadcast successfully delivered to {clean_phone}!"
        }
    else:
        campaign.status = "FAILED"
        campaign.failed_count = 1
        db.commit()
        return {
            "success": False,
            "status": "FAILED",
            "failure_reason": msg.failure_reason or "Meta Cloud API returned an error",
            "recipient_phone": clean_phone,
            "recipient_name": req.recipient_name,
            "template_name": req.template_name or "hello_world",
            "campaign_id": campaign.id,
            "message": f"Meta Cloud API Error: {msg.failure_reason or 'Delivery failed'}"
        }

@router.get("/messages", response_model=List[WhatsAppMessageOut])
def get_messages(
    limit: int = 100,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    return db.query(WhatsAppMessage).filter(
        WhatsAppMessage.tenant_id == tenant.id
    ).order_by(WhatsAppMessage.created_at.desc()).limit(limit).all()

@router.get("/pricing", response_model=List[MessagePricingOut])
def get_message_pricing(db: Session = Depends(get_db)):
    return PricingService.list_pricing_rules(db)

@router.get("/export")
def export_message_logs(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Exports WhatsApp message logs as CSV"""
    messages = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.tenant_id == tenant.id
    ).order_by(WhatsAppMessage.created_at.desc()).limit(1000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Message ID", "Recipient Phone", "Direction", "Type", "Status", "Cost", "Currency", "Sent At", "Delivered At", "Failure Reason"])
    for m in messages:
        writer.writerow([
            m.provider_message_id or m.id,
            m.recipient_phone,
            m.direction,
            m.message_type,
            m.status,
            f"{m.cost:.2f}",
            m.currency,
            m.sent_at.isoformat() if m.sent_at else "",
            m.delivered_at.isoformat() if m.delivered_at else "",
            m.failure_reason or ""
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=whatsapp_logs_{tenant.slug}.csv"}
    )

class MockUserBroadcastRequest(BaseModel):
    token: Optional[str] = None
    phone_number_id: Optional[str] = "1380171298507513"
    template_name: Optional[str] = "reminderpet "
    language_code: Optional[str] = "en_US"
    api_version: Optional[str] = "v25.0"
    extra_phone_numbers: Optional[List[str]] = ["918590102027"]

@router.post("/broadcast-mockuser")
def broadcast_mockuser(
    req: MockUserBroadcastRequest,
    db: Session = Depends(get_db)
):
    """
    Broadcasts a Meta WhatsApp template message (e.g. reminderpet ) to all customers
    in the mockuser setup ('goagain-demo') and specified recipients like 918590102027.
    """
    return WhatsAppService.broadcast_to_mockuser_customers(
        db=db,
        token=req.token,
        phone_number_id=req.phone_number_id or "1380171298507513",
        template_name=req.template_name or "reminderpet ",
        language_code=req.language_code or "en_US",
        api_version=req.api_version or "v25.0",
        tenant_slug="goagain-demo",
        extra_phone_numbers=req.extra_phone_numbers
    )

