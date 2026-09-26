from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, Segment
from app.schemas.schemas import SegmentCreate, SegmentUpdate, SegmentOut
from app.services.segment_service import SegmentService

router = APIRouter(prefix="/segments", tags=["Segmentation"])

@router.get("", response_model=List[SegmentOut])
def get_segments(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    segments = db.query(Segment).filter(Segment.tenant_id == tenant.id).all()
    for s in segments:
        customers = SegmentService.get_segment_customers(db, tenant.id, s.id)
        s.cached_count = len(customers)
    db.commit()
    return segments

@router.post("", response_model=SegmentOut)
def create_segment(req: SegmentCreate, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    segment = Segment(
        tenant_id=tenant.id,
        name=req.name,
        description=req.description,
        rules_json=req.rules_json
    )
    db.add(segment)
    db.flush()
    customers = SegmentService.get_segment_customers(db, tenant.id, segment.id)
    segment.cached_count = len(customers)
    db.commit()
    db.refresh(segment)
    return segment

@router.post("/preview")
def preview_segment(rules: Dict[str, Any], tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    # Temporary segment object in memory for preview
    temp_segment = Segment(tenant_id=tenant.id, rules_json=rules)
    db.add(temp_segment)
    db.flush()
    customers = SegmentService.get_segment_customers(db, tenant.id, temp_segment.id)
    count = len(customers)
    db.rollback()
    return {"matched_count": count}

@router.delete("/{segment_id}")
def delete_segment(segment_id: str, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    s = db.query(Segment).filter(Segment.id == segment_id, Segment.tenant_id == tenant.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Segment not found")
    db.delete(s)
    db.commit()
    return {"status": "deleted"}
