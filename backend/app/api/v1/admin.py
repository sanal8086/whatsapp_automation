from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_platform_admin
from app.models.models import (
    Tenant, Subscription, Wallet, WhatsAppConnection,
    PlatformTemplate, User, WalletTransaction, Plan
)
from app.schemas.schemas import (
    AdminCreditRequest, AdminAdjustmentRequest, ManualPaymentRequest, AuditLogOut
)
from app.services.wallet_service import WalletService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/admin", tags=["Platform Admin"])

@router.get("/overview")
def get_platform_overview(
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    total_tenants = db.query(Tenant).count()
    active_tenants = db.query(Tenant).filter(Tenant.status == "ACTIVE").count()
    total_users = db.query(User).count()

    total_wallet_funds = db.query(Wallet).all()
    wallet_sum = sum(w.balance for w in total_wallet_funds)

    return {
        "total_businesses": total_tenants,
        "active_businesses": active_tenants,
        "total_users": total_users,
        "total_wallet_balance": round(wallet_sum, 2)
    }

@router.get("/businesses")
def list_businesses(
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    out = []
    for t in tenants:
        sub = db.query(Subscription).filter(Subscription.tenant_id == t.id).first()
        wal = db.query(Wallet).filter(Wallet.tenant_id == t.id).first()
        wa = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == t.id).first()
        out.append({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "business_type": t.business_type,
            "status": t.status,
            "subscription_status": sub.status if sub else "TRIAL",
            "subscription_payment": sub.payment_status if sub else "PENDING",
            "subscription_ends_at": sub.ends_at if sub else None,
            "wallet_balance": wal.balance if wal else 0.0,
            "whatsapp_status": wa.connection_status if wa else "DISCONNECTED",
            "created_at": t.created_at
        })
    return out

@router.post("/businesses/{tenant_id}/toggle-status")
def toggle_business_status(
    tenant_id: str,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Business not found")
    t.status = "SUSPENDED" if t.status == "ACTIVE" else "ACTIVE"
    db.commit()
    db.refresh(t)
    return {"id": t.id, "status": t.status}

@router.post("/subscriptions/mark-paid")
def mark_subscription_paid(
    req: ManualPaymentRequest,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    sub = db.query(Subscription).filter(Subscription.tenant_id == req.tenant_id).first()
    if not sub:
        sub = Subscription(
            tenant_id=req.tenant_id,
            status="ACTIVE",
            payment_status="MANUAL_VERIFIED",
            amount=req.amount,
            currency="INR",
            notes=req.notes
        )
        db.add(sub)
    else:
        sub.status = "ACTIVE"
        sub.payment_status = "MANUAL_VERIFIED"
        sub.amount = req.amount
        sub.notes = req.notes or "Manual payment verified by platform admin"

    now = datetime.now(timezone.utc)
    sub.starts_at = now
    sub.ends_at = now + timedelta(days=30 * req.months)
    db.commit()
    return {"status": "success", "tenant_id": req.tenant_id, "subscription_status": sub.status}

@router.post("/wallets/credit")
def admin_credit_wallet(
    req: AdminCreditRequest,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    txn = WalletService.credit_wallet(
        db=db,
        tenant_id=req.tenant_id,
        amount=req.amount,
        description=req.description or "Admin promotional credit",
        created_by=user.email,
        reference_type="ADMIN_ADJUSTMENT"
    )
    return {"status": "success", "new_balance": txn.balance_after, "transaction_id": txn.id}

@router.get("/global-templates")
def get_global_templates(
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    return db.query(PlatformTemplate).all()

@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    tenant_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Platform admin query for immutable audit logs"""
    return AuditService.get_logs(db, tenant_id=tenant_id, action=action, limit=limit, skip=skip)

@router.post("/wallets/adjustment")
def admin_adjust_wallet(
    req: AdminAdjustmentRequest,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Allows platform admin to adjust wallet balances (CREDIT or DEBIT) with audit ledger"""
    if req.type.upper() == "CREDIT":
        txn = WalletService.credit_wallet(
            db=db,
            tenant_id=req.tenant_id,
            amount=req.amount,
            description=req.description,
            created_by=user.email,
            reference_type="ADMIN_ADJUSTMENT"
        )
    else:
        txn = WalletService.debit_wallet(
            db=db,
            tenant_id=req.tenant_id,
            amount=req.amount,
            description=req.description,
            reference_type="ADMIN_ADJUSTMENT",
            created_by=user.email
        )
    AuditService.log(
        db=db,
        action="WALLET_ADJUSTED",
        tenant_id=req.tenant_id,
        user_email=user.email,
        resource_type="WALLET",
        details={"type": req.type, "amount": req.amount, "description": req.description}
    )
    return {"status": "success", "new_balance": txn.balance_after, "transaction_id": txn.id}

@router.post("/subscriptions/{tenant_id}/cancel")
def cancel_subscription(
    tenant_id: str,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    sub = db.query(Subscription).filter(Subscription.tenant_id == tenant_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "CANCELLED"
    db.commit()
    AuditService.log(
        db=db,
        action="SUBSCRIPTION_CANCELLED",
        tenant_id=tenant_id,
        user_email=user.email,
        resource_type="SUBSCRIPTION"
    )
    return {"status": "success", "subscription_status": sub.status}

@router.post("/subscriptions/{tenant_id}/extend")
def extend_subscription(
    tenant_id: str,
    days: int = 30,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    sub = db.query(Subscription).filter(Subscription.tenant_id == tenant_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    now = datetime.now(timezone.utc)
    base_date = sub.ends_at if (sub.ends_at and sub.ends_at > now) else now
    sub.ends_at = base_date + timedelta(days=days)
    sub.status = "ACTIVE"
    db.commit()
    AuditService.log(
        db=db,
        action="SUBSCRIPTION_EXTENDED",
        tenant_id=tenant_id,
        user_email=user.email,
        resource_type="SUBSCRIPTION",
        details={"days_added": days, "new_ends_at": sub.ends_at.isoformat()}
    )
    return {"status": "success", "new_ends_at": sub.ends_at}
