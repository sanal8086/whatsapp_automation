from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant, require_roles
from app.models.models import Tenant, TenantMember, User, Subscription, Plan, PublicPage
from app.schemas.schemas import TenantOut, TenantUpdate, TenantMemberOut, SubscriptionOut, PublicPageOut, PublicPageUpdate

router = APIRouter(prefix="/tenants", tags=["Tenants & Settings"])

@router.get("/current", response_model=TenantOut)
def get_current_tenant_info(tenant: Tenant = Depends(get_current_tenant)):
    return tenant

@router.patch("/current", response_model=TenantOut)
def update_current_tenant(
    req: TenantUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    user: User = Depends(require_roles(["OWNER", "ADMIN"])),
    db: Session = Depends(get_db)
):
    if req.name: tenant.name = req.name
    if req.business_type: tenant.business_type = req.business_type
    if req.currency: tenant.currency = req.currency
    if req.timezone: tenant.timezone = req.timezone
    db.commit()
    db.refresh(tenant)
    return tenant

@router.get("/current/members", response_model=List[TenantMemberOut])
def list_tenant_members(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    members = db.query(TenantMember).filter(TenantMember.tenant_id == tenant.id).all()
    results = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        results.append({
            "id": m.id,
            "tenant_id": m.tenant_id,
            "user_id": m.user_id,
            "role": m.role,
            "status": m.status,
            "user_name": user.name if user else "Unknown",
            "user_email": user.email if user else "",
            "created_at": m.created_at
        })
    return results

@router.get("/current/subscription", response_model=SubscriptionOut)
def get_current_subscription(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    sub = db.query(Subscription).filter(Subscription.tenant_id == tenant.id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    plan = db.query(Plan).filter(Plan.id == sub.plan_id).first() if sub.plan_id else None
    return {
        "id": sub.id,
        "tenant_id": sub.tenant_id,
        "plan_id": sub.plan_id,
        "plan_name": plan.name if plan else "Free Trial",
        "status": sub.status,
        "payment_status": sub.payment_status,
        "amount": sub.amount,
        "currency": sub.currency,
        "starts_at": sub.starts_at,
        "ends_at": sub.ends_at,
        "notes": sub.notes
    }

@router.get("/current/public-page")
def get_tenant_public_page_settings(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    page = db.query(PublicPage).filter(PublicPage.tenant_id == tenant.id).first()
    if not page:
        page = PublicPage(
            tenant_id=tenant.id,
            slug=tenant.slug,
            business_name=tenant.name,
            hero_title=f"Welcome to {tenant.name} Rewards",
            hero_description="Earn points on every visit and unlock VIP rewards!",
            primary_color="#4F46E5",
            secondary_color="#06B6D4"
        )
        db.add(page)
        db.commit()
        db.refresh(page)
    return page

@router.patch("/current/public-page")
def update_tenant_public_page_settings(
    req: PublicPageUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    user: User = Depends(require_roles(["OWNER", "ADMIN"])),
    db: Session = Depends(get_db)
):
    page = db.query(PublicPage).filter(PublicPage.tenant_id == tenant.id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Public page not found")

    if req.hero_title is not None: page.hero_title = req.hero_title
    if req.hero_description is not None: page.hero_description = req.hero_description
    if req.logo_url is not None: page.logo_url = req.logo_url
    if req.banner_url is not None: page.banner_url = req.banner_url
    if req.primary_color is not None: page.primary_color = req.primary_color
    if req.secondary_color is not None: page.secondary_color = req.secondary_color
    if req.terms_text is not None: page.terms_text = req.terms_text
    if req.contact_phone is not None: page.contact_phone = req.contact_phone
    if req.contact_email is not None: page.contact_email = req.contact_email

    db.commit()
    db.refresh(page)
    return page
