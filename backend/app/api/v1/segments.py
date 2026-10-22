from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, Segment, Campaign
from app.schemas.schemas import (
    SegmentCreate,
    SegmentUpdate,
    SegmentOut,
    SegmentPreviewResponse,
)
from app.services.segment_service import SegmentService
from app.services.rule_registry import RuleValidationError, fields_payload, validate_rules

router = APIRouter(prefix="/segments", tags=["Segmentation"])


def _validated(rules: Any) -> Dict[str, Any]:
    """Validate a rules payload, translating errors into an HTTP 422."""
    try:
        return validate_rules(rules)
    except RuleValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"message": "Invalid audience rules", "errors": exc.errors},
        )


def _count(db: Session, segment: Segment) -> int:
    return len(SegmentService.get_segment_customers(db, segment.tenant_id, segment.id))


@router.get("", response_model=List[SegmentOut])
def get_segments(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    segments = db.query(Segment).filter(Segment.tenant_id == tenant.id).all()
    changed = False
    for s in segments:
        count = _count(db, s)
        if s.cached_count != count:
            s.cached_count = count
            changed = True
    if changed:
        db.commit()
    return segments


@router.get("/fields")
def get_rule_fields(tenant: Tenant = Depends(get_current_tenant)):
    """Field/operator registry that drives the frontend rule builder UI."""
    return fields_payload()


@router.post("", response_model=SegmentOut)
def create_segment(req: SegmentCreate, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    rules = _validated(req.rules_json)
    segment = Segment(
        tenant_id=tenant.id,
        name=req.name,
        description=req.description,
        rules_json=rules,
        source=req.source if req.source in ("MANUAL", "AUTO") else "MANUAL",
    )
    db.add(segment)
    db.flush()
    segment.cached_count = _count(db, segment)
    db.commit()
    db.refresh(segment)
    return segment


@router.post("/preview", response_model=SegmentPreviewResponse)
def preview_segment(rules: Dict[str, Any], tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Dry-run a rule payload: counts, WhatsApp reachability split and a sample."""
    try:
        return SegmentService.preview_rules(db, tenant.id, rules)
    except RuleValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"message": "Invalid audience rules", "errors": exc.errors},
        )


@router.get("/{segment_id}", response_model=SegmentOut)
def get_segment(segment_id: str, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == segment_id, Segment.tenant_id == tenant.id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    count = _count(db, segment)
    if segment.cached_count != count:
        segment.cached_count = count
        db.commit()
    return segment


@router.put("/{segment_id}", response_model=SegmentOut)
def update_segment(segment_id: str, req: SegmentUpdate, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == segment_id, Segment.tenant_id == tenant.id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    if req.name is not None:
        segment.name = req.name
    if req.description is not None:
        segment.description = req.description
    if req.rules_json is not None:
        segment.rules_json = _validated(req.rules_json)

    db.flush()
    segment.cached_count = _count(db, segment)
    db.commit()
    db.refresh(segment)
    return segment


@router.delete("/{segment_id}")
def delete_segment(segment_id: str, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    s = db.query(Segment).filter(Segment.id == segment_id, Segment.tenant_id == tenant.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Segment not found")

    # Allow deleting segments even if referenced by campaigns/automations —
    # campaign history gracefully falls back to "All Customers".
    db.delete(s)
    db.commit()
    return {"status": "deleted"}
