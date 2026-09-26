from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, WhatsAppConnection, WhatsAppTemplate, WhatsAppMessage
from app.schemas.schemas import (
    WhatsAppConnectionOut, ConnectWhatsAppRequest, WhatsAppTemplateOut,
    WhatsAppTemplateCreate, SendTestMessageRequest, WhatsAppMessageOut,
    EmbeddedSignupCallbackRequest, MessagePricingOut
)
from app.services.whatsapp_service import WhatsAppService
from app.services.pricing_service import PricingService
from app.integrations.meta.provider import get_whatsapp_provider

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Cloud API"])

@router.get("/connection", response_model=WhatsAppConnectionOut)
def get_connection(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    return WhatsAppService.get_or_create_connection(db, tenant.id)

@router.post("/connect", response_model=WhatsAppConnectionOut)
def connect_account(
    req: ConnectWhatsAppRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    conn = WhatsAppService.connect_account(
        db=db,
        tenant_id=tenant.id,
        display_phone_number=req.display_phone_number,
        verified_name=req.verified_name,
        waba_id=req.waba_id,
        phone_number_id=req.phone_number_id,
        access_token=req.access_token,
        is_live_mode=req.is_live_mode
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
