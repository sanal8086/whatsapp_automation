from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, Automation, WhatsAppTemplate
from app.schemas.schemas import AutomationCreate, AutomationUpdate, AutomationOut

router = APIRouter(prefix="/automations", tags=["Automations & Journeys"])

@router.get("", response_model=List[AutomationOut])
def get_automations(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    automations = db.query(Automation).filter(Automation.tenant_id == tenant.id).all()
    out = []
    for a in automations:
        tpl = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == a.template_id).first() if a.template_id else None
        out.append({
            "id": a.id,
            "name": a.name,
            "trigger_type": a.trigger_type,
            "conditions_json": a.conditions_json,
            "template_id": a.template_id,
            "template_name": tpl.name if tpl else None,
            "delay_minutes": a.delay_minutes,
            "status": a.status,
            "total_triggered": a.total_triggered,
            "created_at": a.created_at
        })
    return out

@router.post("", response_model=AutomationOut)
def create_automation(
    req: AutomationCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    automation = Automation(
        tenant_id=tenant.id,
        name=req.name,
        trigger_type=req.trigger_type,
        conditions_json=req.conditions_json,
        template_id=req.template_id,
        delay_minutes=req.delay_minutes,
        status="ACTIVE"
    )
    db.add(automation)
    db.commit()
    db.refresh(automation)

    tpl = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == automation.template_id).first() if automation.template_id else None
    return {
        "id": automation.id,
        "name": automation.name,
        "trigger_type": automation.trigger_type,
        "conditions_json": automation.conditions_json,
        "template_id": automation.template_id,
        "template_name": tpl.name if tpl else None,
        "delay_minutes": automation.delay_minutes,
        "status": automation.status,
        "total_triggered": automation.total_triggered,
        "created_at": automation.created_at
    }

@router.patch("/{automation_id}", response_model=AutomationOut)
def update_automation(
    automation_id: str,
    req: AutomationUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    a = db.query(Automation).filter(Automation.id == automation_id, Automation.tenant_id == tenant.id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Automation not found")
    if req.name is not None: a.name = req.name
    if req.conditions_json is not None: a.conditions_json = req.conditions_json
    if req.template_id is not None: a.template_id = req.template_id
    if req.delay_minutes is not None: a.delay_minutes = req.delay_minutes
    if req.status is not None: a.status = req.status
    db.commit()
    db.refresh(a)

    tpl = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == a.template_id).first() if a.template_id else None
    return {
        "id": a.id,
        "name": a.name,
        "trigger_type": a.trigger_type,
        "conditions_json": a.conditions_json,
        "template_id": a.template_id,
        "template_name": tpl.name if tpl else None,
        "delay_minutes": a.delay_minutes,
        "status": a.status,
        "total_triggered": a.total_triggered,
        "created_at": a.created_at
    }

@router.delete("/{automation_id}")
def delete_automation(automation_id: str, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    a = db.query(Automation).filter(Automation.id == automation_id, Automation.tenant_id == tenant.id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Automation not found")
    db.delete(a)
    db.commit()
    return {"status": "deleted"}
