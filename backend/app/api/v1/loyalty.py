from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, LoyaltyProgram, LoyaltyReward, LoyaltyTransaction
from app.schemas.schemas import (
    LoyaltyProgramOut, LoyaltyProgramUpdate, RewardCreate, RewardUpdate, RewardOut,
    EarnPointsRequest, RedeemPointsRequest, LoyaltyTransactionOut
)
from app.services.loyalty_service import LoyaltyService
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
        manual_points=req.points,
        description=req.description or "In-store transaction"
    )
    return txn

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
    limit: int = 50,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(LoyaltyTransaction).filter(LoyaltyTransaction.tenant_id == tenant.id)
    if customer_id:
        query = query.filter(LoyaltyTransaction.customer_id == customer_id)
    return query.order_by(LoyaltyTransaction.created_at.desc()).limit(limit).all()

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
