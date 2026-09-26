from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, Wallet, WalletTransaction
from app.schemas.schemas import WalletOut, WalletTransactionOut
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/wallet", tags=["WhatsApp Wallet & Credits"])

@router.get("", response_model=WalletOut)
def get_wallet(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    wallet = WalletService.get_or_create_wallet(db, tenant.id, tenant.currency)
    return {
        "id": wallet.id,
        "tenant_id": wallet.tenant_id,
        "currency": wallet.currency,
        "balance": wallet.balance,
        "reserved_balance": wallet.reserved_balance,
        "available_balance": WalletService.get_available_balance(wallet),
        "status": wallet.status
    }

@router.get("/transactions", response_model=List[WalletTransactionOut])
def get_transactions(
    limit: int = 50,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    wallet = WalletService.get_or_create_wallet(db, tenant.id)
    return db.query(WalletTransaction).filter(
        WalletTransaction.wallet_id == wallet.id
    ).order_by(WalletTransaction.created_at.desc()).limit(limit).all()

@router.post("/topup-demo", response_model=WalletOut)
def demo_topup(
    payload: Dict[str, Any],
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    amount = float(payload.get("amount", 500.0))
    WalletService.credit_wallet(
        db=db,
        tenant_id=tenant.id,
        amount=amount,
        description=f"Prepaid messaging credit top-up (₹{amount})",
        reference_type="ONLINE_MOCK_BILLING",
        created_by="MERCHANT"
    )
    wallet = WalletService.get_or_create_wallet(db, tenant.id)
    return {
        "id": wallet.id,
        "tenant_id": wallet.tenant_id,
        "currency": wallet.currency,
        "balance": wallet.balance,
        "reserved_balance": wallet.reserved_balance,
        "available_balance": WalletService.get_available_balance(wallet),
        "status": wallet.status
    }
