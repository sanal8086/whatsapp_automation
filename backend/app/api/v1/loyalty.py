from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, LoyaltyProgram, LoyaltyReward, LoyaltyTransaction, Customer
from app.schemas.schemas import (
    LoyaltyProgramOut, LoyaltyProgramUpdate, RewardCreate, RewardUpdate, RewardOut,
    EarnPointsRequest, RedeemPointsRequest, LoyaltyTransactionOut
)
from app.services.loyalty_service import LoyaltyService, DEFAULT_TIER_CONFIG
from app.services.import_export_service import ImportExportService

router = APIRouter(prefix="/loyalty", tags=["Loyalty Engine"])

@router.get("/program", response_model=LoyaltyProgramOut)
def get_program(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    return LoyaltyService.get_or_create_program(db, tenant.id)

@router.patch("/program", response_model=LoyaltyProgramOut)
def update_program(
    req: LoyaltyProgramUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    prog = LoyaltyService.get_or_create_program(db, tenant.id)
    if req.name is not None: prog.name = req.name
    if req.points_currency_name is not None: prog.points_currency_name = req.points_currency_name
    if req.earn_type is not None: prog.earn_type = req.earn_type
    if req.earn_rate is not None: prog.earn_rate = req.earn_rate
    if req.earn_spend_unit is not None: prog.earn_spend_unit = req.earn_spend_unit
    if req.points_expiry_days is not None: prog.points_expiry_days = req.points_expiry_days
    if req.welcome_bonus_points is not None: prog.welcome_bonus_points = req.welcome_bonus_points
    if req.birthday_bonus_points is not None: prog.birthday_bonus_points = req.birthday_bonus_points
    db.commit()
    db.refresh(prog)
    return prog

@router.get("/tier-config")
def get_tier_config(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    return LoyaltyService.get_tier_config(db, tenant.id)

@router.put("/tier-config")
def update_tier_config(
    req: Dict[str, Any],
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    prog = LoyaltyService.get_or_create_program(db, tenant.id)
    
    # Validate thresholds
    thresholds = req.get("thresholds", {})
    if not isinstance(thresholds, dict):
        raise HTTPException(status_code=422, detail="thresholds must be an object")
    
    # Ensure required tier keys exist with defaults
    validated_thresholds = {
        "SILVER": int(thresholds.get("SILVER", DEFAULT_TIER_CONFIG["thresholds"]["SILVER"])),
        "GOLD": int(thresholds.get("GOLD", DEFAULT_TIER_CONFIG["thresholds"]["GOLD"])),
        "PLATINUM": int(thresholds.get("PLATINUM", DEFAULT_TIER_CONFIG["thresholds"]["PLATINUM"]))
    }
    
    # Validate order: SILVER < GOLD < PLATINUM
    if not (validated_thresholds["SILVER"] <= validated_thresholds["GOLD"] <= validated_thresholds["PLATINUM"]):
        raise HTTPException(status_code=422, detail="Thresholds must be in order: SILVER <= GOLD <= PLATINUM")
    
    # Validate names
    names = req.get("names", {})
    validated_names = {
        "BRONZE": str(names.get("BRONZE", "Bronze")),
        "SILVER": str(names.get("SILVER", "Silver")),
        "GOLD": str(names.get("GOLD", "Gold")),
        "PLATINUM": str(names.get("PLATINUM", "Platinum"))
    }
    
    prog.tier_config = {
        "thresholds": validated_thresholds,
        "names": validated_names
    }
    db.commit()
    db.refresh(prog)
    return prog.tier_config

@router.get("/rewards", response_model=List[RewardOut])
def get_rewards(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    return db.query(LoyaltyReward).filter(LoyaltyReward.tenant_id == tenant.id).order_by(LoyaltyReward.points_required.asc()).all()

@router.post("/rewards", response_model=RewardOut)
def create_reward(
    req: RewardCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    reward = LoyaltyReward(
        tenant_id=tenant.id,
        name=req.name,
        description=req.description,
        image_url=req.image_url,
        items=[i for i in (req.items or []) if i and i.strip()] or None,
        points_required=req.points_required,
        cash_value=req.cash_value,
        terms=req.terms,
        stock=req.stock,
        expiry_days=req.expiry_days,
        status="ACTIVE"
    )
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return reward

@router.patch("/rewards/{reward_id}", response_model=RewardOut)
def update_reward(
    reward_id: str,
    req: RewardUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    reward = db.query(LoyaltyReward).filter(LoyaltyReward.id == reward_id, LoyaltyReward.tenant_id == tenant.id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    if req.name is not None: reward.name = req.name
    if req.description is not None: reward.description = req.description
    if req.image_url is not None: reward.image_url = req.image_url
    if req.items is not None:
        cleaned = [i.strip() for i in req.items if i and i.strip()]
        reward.items = cleaned or None
    if req.points_required is not None: reward.points_required = req.points_required
    if req.cash_value is not None: reward.cash_value = req.cash_value
    if req.terms is not None: reward.terms = req.terms
    if req.stock is not None: reward.stock = req.stock
    if req.status is not None: reward.status = req.status
    db.commit()
    db.refresh(reward)
    return reward

@router.post("/earn", response_model=LoyaltyTransactionOut)
def earn_points(
    req: EarnPointsRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    txn = LoyaltyService.earn_points(
        db=db,
        tenant_id=tenant.id,
        customer_id=req.customer_id,
        amount_spent=req.amount_spent or 0.0,
        visits=req.visits or 1,
        manual_points=req.points,
        description=req.description or "In-store transaction",
        expiry_date=req.expiry_date
    )

    # Award Rewards: send the 'hellopets' WhatsApp template with the awarded
    # points to the customer's entered phone number (business-side Award Points page)
    customer = db.query(Customer).filter(
        Customer.id == req.customer_id,
        Customer.tenant_id == tenant.id
    ).first()

    whatsapp_sent = None
    whatsapp_error = None
    if customer:
        from app.services.whatsapp_service import WhatsAppService
        wa_result = WhatsAppService.send_award_rewards_whatsapp(
            db=db,
            tenant_id=tenant.id,
            to_phone=customer.phone_normalized or customer.phone,
            points=txn.points,
            balance=txn.balance_after,
            customer_id=customer.id,
            expiry_date=req.expiry_date
        )
        whatsapp_sent = wa_result.get("sent", False)
        if not whatsapp_sent:
            whatsapp_error = wa_result.get("error")

    return {
        "id": txn.id,
        "customer_id": txn.customer_id,
        "customer_phone": (customer.phone_normalized or customer.phone) if customer else None,
        "customer_name": (f"{customer.first_name or ''} {customer.last_name or ''}".strip() or None) if customer else None,
        "type": txn.type,
        "points": txn.points,
        "balance_before": txn.balance_before,
        "balance_after": txn.balance_after,
        "description": txn.description,
        "created_at": txn.created_at,
        "whatsapp_sent": whatsapp_sent,
        "whatsapp_error": whatsapp_error
    }

@router.post("/redeem", response_model=LoyaltyTransactionOut)
def redeem_points(
    req: RedeemPointsRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    txn = LoyaltyService.redeem_reward(
        db=db,
        tenant_id=tenant.id,
        customer_id=req.customer_id,
        reward_id=req.reward_id,
        custom_points=req.points,
        description=req.description
    )
    return txn

@router.get("/transactions", response_model=List[LoyaltyTransactionOut])
def get_transactions(
    customer_id: Optional[str] = None,
    limit: int = 200,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(LoyaltyTransaction).filter(LoyaltyTransaction.tenant_id == tenant.id)
    if customer_id:
        query = query.filter(LoyaltyTransaction.customer_id == customer_id)
    txns = query.order_by(LoyaltyTransaction.created_at.desc()).limit(limit).all()

    # Resolve customer phone/name for each txn
    customer_ids = {t.customer_id for t in txns}
    customers = {}
    if customer_ids:
        for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all():
            customers[c.id] = c

    out = []
    for t in txns:
        c = customers.get(t.customer_id)
        out.append({
            "id": t.id,
            "customer_id": t.customer_id,
            "customer_phone": (c.phone_normalized or c.phone) if c else None,
            "customer_name": (f"{c.first_name or ''} {c.last_name or ''}".strip() or None) if c else None,
            "type": t.type,
            "points": t.points,
            "balance_before": t.balance_before,
            "balance_after": t.balance_after,
            "description": t.description,
            "created_at": t.created_at,
        })
    return out

@router.get("/export")
def export_transactions(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Exports loyalty transactions ledger as CSV"""
    csv_data = ImportExportService.export_loyalty_transactions_csv(db, tenant.id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=loyalty_ledger_{tenant.slug}.csv"}
    )
