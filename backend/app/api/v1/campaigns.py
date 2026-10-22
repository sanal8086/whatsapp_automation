from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, Campaign, Segment, WhatsAppTemplate
from app.schemas.schemas import CampaignCreate, CampaignOut, CampaignEstimateRequest, CampaignEstimateResponse
from app.services.campaign_service import CampaignService
from app.services.rule_registry import RuleValidationError
from app.services.import_export_service import ImportExportService

router = APIRouter(prefix="/campaigns", tags=["Campaigns & Broadcasts"])

@router.get("", response_model=List[CampaignOut])
def get_campaigns(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(Campaign.tenant_id == tenant.id).order_by(Campaign.created_at.desc()).all()
    out = []
    for c in campaigns:
        seg = db.query(Segment).filter(Segment.id == c.segment_id).first() if c.segment_id else None
        tpl = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == c.template_id).first() if c.template_id else None
        out.append({
            "id": c.id,
            "name": c.name,
            "segment_id": c.segment_id,
            "segment_name": seg.name if seg else "All Customers",
            "template_id": c.template_id,
            "template_name": tpl.name if tpl else None,
            "channel": c.channel,
            "status": c.status,
            "scheduled_at": c.scheduled_at,
            "recipients_count": c.recipients_count,
            "sent_count": c.sent_count,
            "delivered_count": c.delivered_count,
            "read_count": c.read_count,
            "failed_count": c.failed_count,
            "estimated_cost": c.estimated_cost,
            "actual_cost": c.actual_cost,
            "attributed_revenue": c.attributed_revenue,
            "created_at": c.created_at
        })
    return out

@router.get("/export")
def export_campaigns(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Exports campaign dispatches as CSV"""
    csv_data = ImportExportService.export_campaigns_csv(db, tenant.id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=campaigns_{tenant.slug}.csv"}
    )

@router.post("/estimate", response_model=CampaignEstimateResponse)
def estimate_campaign(
    req: CampaignEstimateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    try:
        return CampaignService.estimate_campaign(db, tenant.id, req.segment_id, req.rules_json)
    except RuleValidationError as exc:
        raise HTTPException(status_code=422, detail={"message": "Invalid audience rules", "errors": exc.errors})

@router.post("", response_model=CampaignOut)
def create_campaign(
    req: CampaignCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    print(f"\n[OFFER_RUN] POST /campaigns received: name={req.name!r}, segment_id={req.segment_id}, template_id={req.template_id}, scheduled_at={req.scheduled_at}, rules_json={req.rules_json}, tenant={tenant.id}", flush=True)
    try:
        campaign = CampaignService.create_campaign(
            db=db,
            tenant_id=tenant.id,
            name=req.name,
            segment_id=req.segment_id,
            template_id=req.template_id,
            scheduled_at=req.scheduled_at,
            variables_mapping=req.variables_mapping_json,
            rules_json=req.rules_json,
            image_url=req.image_url
        )
    except RuleValidationError as exc:
        raise HTTPException(status_code=422, detail={"message": "Invalid audience rules", "errors": exc.errors})
    seg = db.query(Segment).filter(Segment.id == campaign.segment_id).first() if campaign.segment_id else None
    tpl = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == campaign.template_id).first() if campaign.template_id else None
    return {
        "id": campaign.id,
        "name": campaign.name,
        "segment_id": campaign.segment_id,
        "segment_name": seg.name if seg else "All Customers",
        "template_id": campaign.template_id,
        "template_name": tpl.name if tpl else None,
        "channel": campaign.channel,
        "status": campaign.status,
        "scheduled_at": campaign.scheduled_at,
        "image_url": campaign.image_url,
        "recipients_count": campaign.recipients_count,
        "sent_count": campaign.sent_count,
        "delivered_count": campaign.delivered_count,
        "read_count": campaign.read_count,
        "failed_count": campaign.failed_count,
        "estimated_cost": campaign.estimated_cost,
        "actual_cost": campaign.actual_cost,
        "attributed_revenue": campaign.attributed_revenue,
        "created_at": campaign.created_at
    }

@router.post("/{campaign_id}/send", response_model=CampaignOut)
def execute_campaign(
    campaign_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    print(f"\n[OFFER_RUN] POST /campaigns/{campaign_id}/send received: tenant={tenant.id} ({tenant.name})", flush=True)
    campaign = CampaignService.execute_campaign(db, tenant.id, campaign_id)
    print(f"[OFFER_RUN] POST /campaigns/{campaign_id}/send finished: status={campaign.status if campaign else 'NOT FOUND'}, sent={campaign.sent_count if campaign else '-'}, delivered={campaign.delivered_count if campaign else '-'}, failed={campaign.failed_count if campaign else '-'}", flush=True)
    seg = db.query(Segment).filter(Segment.id == campaign.segment_id).first() if campaign.segment_id else None
    tpl = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == campaign.template_id).first() if campaign.template_id else None
    return {
        "id": campaign.id,
        "name": campaign.name,
        "segment_id": campaign.segment_id,
        "segment_name": seg.name if seg else "All Customers",
        "template_id": campaign.template_id,
        "template_name": tpl.name if tpl else None,
        "channel": campaign.channel,
        "status": campaign.status,
        "scheduled_at": campaign.scheduled_at,
        "image_url": campaign.image_url,
        "recipients_count": campaign.recipients_count,
        "sent_count": campaign.sent_count,
        "delivered_count": campaign.delivered_count,
        "read_count": campaign.read_count,
        "failed_count": campaign.failed_count,
        "estimated_cost": campaign.estimated_cost,
        "actual_cost": campaign.actual_cost,
        "attributed_revenue": campaign.attributed_revenue,
        "created_at": campaign.created_at
    }
