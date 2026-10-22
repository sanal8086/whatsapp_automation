from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_platform_admin
from app.models.models import (
    Tenant, Subscription, Wallet, WhatsAppConnection,
    PlatformTemplate, User, TenantMember, WalletTransaction, Plan,
    PublicPage, LoyaltyProgram, LoyaltyReward
)
from app.schemas.schemas import (
    AdminCreditRequest, AdminAdjustmentRequest, ManualPaymentRequest, AuditLogOut,
    PublicPageOut, PublicPageUpdate
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
    pending_tenants = db.query(Tenant).filter(Tenant.status == "PENDING_APPROVAL").count()
    total_users = db.query(User).count()

    total_wallet_funds = db.query(Wallet).all()
    wallet_sum = sum(w.balance for w in total_wallet_funds)

    return {
        "total_businesses": total_tenants,
        "active_businesses": active_tenants,
        "pending_businesses": pending_tenants,
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
        
        # Get owner details
        owner_member = db.query(TenantMember).filter(
            TenantMember.tenant_id == t.id,
            TenantMember.role == "OWNER"
        ).first()
        owner_user = None
        if owner_member:
            owner_user = db.query(User).filter(User.id == owner_member.user_id).first()
        elif t.members:
            owner_user = db.query(User).filter(User.id == t.members[0].user_id).first()

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
            "created_at": t.created_at,
            "owner_name": owner_user.name if owner_user else "N/A",
            "owner_email": owner_user.email if owner_user else "N/A",
            "owner_phone": owner_user.phone if owner_user else None,
            "owner_id": owner_user.id if owner_user else None,
        })
    return out

@router.get("/users")
def list_users(
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Platform admin query to list all registered users with their business associations and status"""
    users = db.query(User).order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        membership = db.query(TenantMember).filter(TenantMember.user_id == u.id).first()
        tenant = None
        if membership:
            tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
            
        out.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "is_platform_admin": u.is_platform_admin,
            "user_status": u.status,
            "created_at": u.created_at,
            "tenant_id": tenant.id if tenant else None,
            "tenant_name": tenant.name if tenant else None,
            "tenant_slug": tenant.slug if tenant else None,
            "tenant_status": tenant.status if tenant else None,
            "business_type": tenant.business_type if tenant else None,
            "role": membership.role if membership else None
        })
    return out

@router.post("/users/{user_id}/approve")
def approve_user_and_business(
    user_id: str,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Approve a user's pending business application"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    membership = db.query(TenantMember).filter(TenantMember.user_id == user_id).first()
    if not membership:
        raise HTTPException(status_code=400, detail="User does not have an associated business")
        
    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
        
    tenant.status = "APPROVED"
    db.commit()
    db.refresh(tenant)
    AuditService.log(
        db=db,
        action="BUSINESS_APPROVED",
        tenant_id=tenant.id,
        user_email=user.email,
        resource_type="TENANT",
        details={"approved_user_email": target_user.email}
    )
    return {"status": "success", "tenant_id": tenant.id, "tenant_status": tenant.status, "user_id": target_user.id}

@router.post("/users/{user_id}/reject")
def reject_user_and_business(
    user_id: str,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Reject a user's pending business application"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    membership = db.query(TenantMember).filter(TenantMember.user_id == user_id).first()
    if not membership:
        raise HTTPException(status_code=400, detail="User does not have an associated business")
        
    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
        
    tenant.status = "REJECTED"
    db.commit()
    db.refresh(tenant)
    AuditService.log(
        db=db,
        action="BUSINESS_REJECTED",
        tenant_id=tenant.id,
        user_email=user.email,
        resource_type="TENANT",
        details={"rejected_user_email": target_user.email}
    )
    return {"status": "success", "tenant_id": tenant.id, "tenant_status": tenant.status, "user_id": target_user.id}

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

@router.post("/businesses/{tenant_id}/approve")
def approve_business(
    tenant_id: str,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Approve a pending business — transitions from PENDING_APPROVAL to APPROVED"""
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Business not found")
    if t.status != "PENDING_APPROVAL":
        raise HTTPException(status_code=400, detail=f"Cannot approve a business with status: {t.status}")
    t.status = "APPROVED"
    db.commit()
    db.refresh(t)
    AuditService.log(
        db=db,
        action="BUSINESS_APPROVED",
        tenant_id=tenant_id,
        user_email=user.email,
        resource_type="TENANT"
    )
    return {"id": t.id, "name": t.name, "status": t.status}

@router.post("/businesses/{tenant_id}/reject")
def reject_business(
    tenant_id: str,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Reject a pending business — transitions from PENDING_APPROVAL to REJECTED"""
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Business not found")
    if t.status != "PENDING_APPROVAL":
        raise HTTPException(status_code=400, detail=f"Cannot reject a business with status: {t.status}")
    t.status = "REJECTED"
    db.commit()
    db.refresh(t)
    AuditService.log(
        db=db,
        action="BUSINESS_REJECTED",
        tenant_id=tenant_id,
        user_email=user.email,
        resource_type="TENANT"
    )
    return {"id": t.id, "name": t.name, "status": t.status}

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
    ends_at = sub.ends_at
    if ends_at and ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    base_date = ends_at if (ends_at and ends_at > now) else now
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

# ---------------- Public Live Page Designer (Super Admin) ----------------

def _get_or_create_public_page(db: Session, tenant: Tenant) -> PublicPage:
    page = db.query(PublicPage).filter(PublicPage.tenant_id == tenant.id).first()
    if not page:
        page = PublicPage(
            tenant_id=tenant.id,
            slug=tenant.slug,
            business_name=tenant.name,
            hero_title=f"Welcome to {tenant.name} Rewards",
            hero_description="Earn points on every visit and unlock exclusive rewards!",
        )
        db.add(page)
        db.commit()
        db.refresh(page)
    return page

def _serialize_public_page(db: Session, page: PublicPage) -> dict:
    tenant = db.query(Tenant).filter(Tenant.id == page.tenant_id).first()
    program = db.query(LoyaltyProgram).filter(LoyaltyProgram.tenant_id == page.tenant_id).first()
    rewards = db.query(LoyaltyReward).filter(
        LoyaltyReward.tenant_id == page.tenant_id,
        LoyaltyReward.status == "ACTIVE"
    ).order_by(LoyaltyReward.points_required.asc()).all()

    program_data = {
        "name": program.name if program else "VIP Rewards",
        "points_currency_name": program.points_currency_name if program else "Points",
        "welcome_bonus_points": program.welcome_bonus_points if program else 100,
        "birthday_bonus_points": program.birthday_bonus_points if program else 200,
        "earn_type": program.earn_type if program else "SPEND_BASED"
    }
    rewards_data = [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "image_url": r.image_url,
            "items": r.items,
            "points_required": r.points_required,
            "cash_value": r.cash_value,
            "terms": r.terms
        } for r in rewards
    ]
    return {
        "slug": page.slug,
        "business_name": page.business_name,
        "hero_title": page.hero_title,
        "hero_description": page.hero_description,
        "logo_url": page.logo_url,
        "banner_url": page.banner_url,
        "primary_color": page.primary_color,
        "secondary_color": page.secondary_color,
        "header_subtitle": page.header_subtitle,
        "hero_cta_text": page.hero_cta_text,
        "how_it_works_json": page.how_it_works_json,
        "terms_text": page.terms_text,
        "contact_phone": page.contact_phone,
        "contact_email": page.contact_email,
        "social_links_json": page.social_links_json,
        "is_active": page.is_active,
        "program": program_data,
        "rewards": rewards_data
    }

@router.get("/businesses/{tenant_id}/public-page", response_model=PublicPageOut)
def get_business_public_page(
    tenant_id: str,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    page = _get_or_create_public_page(db, tenant)
    return _serialize_public_page(db, page)

@router.patch("/businesses/{tenant_id}/public-page", response_model=PublicPageOut)
def update_business_public_page(
    tenant_id: str,
    update: PublicPageUpdate,
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    page = _get_or_create_public_page(db, tenant)
    for field in ("hero_title", "hero_description", "logo_url", "banner_url",
                  "primary_color", "secondary_color", "header_subtitle",
                  "hero_cta_text", "how_it_works_json", "terms_text",
                  "contact_phone", "contact_email"):
        value = getattr(update, field)
        if value is not None:
            setattr(page, field, value)
    db.commit()
    AuditService.log(
        db=db,
        action="PUBLIC_PAGE_UPDATED",
        tenant_id=tenant_id,
        user_email=user.email,
        resource_type="PUBLIC_PAGE"
    )
    return _serialize_public_page(db, page)
