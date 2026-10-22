from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict, Any

from app.core.database import get_db
from app.models.models import (
    Tenant, PublicPage, LoyaltyProgram, LoyaltyReward,
    Customer, CustomerLoyaltyAccount, LoyaltyTransaction
)
from app.schemas.schemas import (
    PublicPageOut, PublicEnrollRequest, PublicOtpRequest, PublicOtpVerify
)
from app.services.customer_service import CustomerService
from app.services.loyalty_service import LoyaltyService

router = APIRouter(prefix="/public/l", tags=["Branded Public Loyalty Portal"])

@router.get("/{slug}", response_model=PublicPageOut)
def get_public_page_data(slug: str, db: Session = Depends(get_db)):
    page = db.query(PublicPage).filter(PublicPage.slug == slug, PublicPage.is_active == True).first()
    if not page:
        raise HTTPException(status_code=404, detail="Loyalty page not found")

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

@router.post("/{slug}/otp")
def send_otp(slug: str, req: PublicOtpRequest, db: Session = Depends(get_db)):
    page = db.query(PublicPage).filter(PublicPage.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Loyalty page not found")

    norm_phone = CustomerService.normalize_phone(req.phone)
    customer = db.query(Customer).filter(
        Customer.tenant_id == page.tenant_id,
        Customer.phone_normalized == norm_phone
    ).first()

    # For testing/demo, mock OTP is 1234
    return {
        "status": "sent",
        "phone": norm_phone,
        "is_existing": customer is not None,
        "demo_otp": "1234"
    }

@router.post("/{slug}/join")
def public_join_program(slug: str, req: PublicEnrollRequest, db: Session = Depends(get_db)):
    page = db.query(PublicPage).filter(PublicPage.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Loyalty page not found")

    norm = CustomerService.normalize_phone(req.phone)
    existing = db.query(Customer).filter(
        Customer.tenant_id == page.tenant_id,
        Customer.phone_normalized == norm
    ).first()

    if existing:
        customer = existing
        acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer.id).first()
    else:
        customer = CustomerService.create_customer(
            db=db,
            tenant_id=page.tenant_id,
            phone=req.phone,
            first_name=req.first_name,
            last_name=req.last_name,
            date_of_birth=req.date_of_birth,
            source="PUBLIC_PAGE",
            marketing_consent=True,
            whatsapp_consent=req.whatsapp_consent
        )
        acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer.id).first()
        try:
            from app.services.automation_runner import AutomationRunner
            AutomationRunner.trigger_welcome_journey(db, page.tenant_id, customer.id)
        except Exception:
            pass

    return {
        "customer_id": customer.id,
        "first_name": customer.first_name,
        "points_balance": acc.points_balance if acc else 0,
        "tier": acc.current_tier if acc else "BRONZE",
        "welcome_bonus_awarded": not existing
    }

@router.get("/{slug}/member/{phone}")
def get_member_portal_data(slug: str, phone: str, db: Session = Depends(get_db)):
    page = db.query(PublicPage).filter(PublicPage.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Loyalty page not found")

    norm = CustomerService.normalize_phone(phone)
    customer = db.query(Customer).filter(
        Customer.tenant_id == page.tenant_id,
        Customer.phone_normalized == norm
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not enrolled")

    acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer.id).first()
    txns = db.query(LoyaltyTransaction).filter(
        LoyaltyTransaction.customer_id == customer.id
    ).order_by(LoyaltyTransaction.created_at.desc()).limit(20).all()

    rewards = db.query(LoyaltyReward).filter(
        LoyaltyReward.tenant_id == page.tenant_id,
        LoyaltyReward.status == "ACTIVE"
    ).order_by(LoyaltyReward.points_required.asc()).all()

    return {
        "customer": {
            "id": customer.id,
            "name": f"{customer.first_name or ''} {customer.last_name or ''}".strip(),
            "phone": customer.phone,
            "visits": customer.visits_count,
            "points_balance": acc.points_balance if acc else 0,
            "tier": acc.current_tier if acc else "BRONZE"
        },
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "points": t.points,
                "balance_after": t.balance_after,
                "description": t.description,
                "created_at": t.created_at
            } for t in txns
        ],
        "available_rewards": [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "image_url": r.image_url,
                "items": r.items,
                "points_required": r.points_required,
                "can_redeem": (acc.points_balance >= r.points_required) if acc else False
            } for r in rewards
        ]
    }

@router.post("/{slug}/redeem")
def public_redeem(slug: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    page = db.query(PublicPage).filter(PublicPage.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Loyalty page not found")

    customer_id = payload.get("customer_id")
    reward_id = payload.get("reward_id")

    txn = LoyaltyService.redeem_reward(
        db=db,
        tenant_id=page.tenant_id,
        customer_id=customer_id,
        reward_id=reward_id
    )

    acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer_id).first()
    return {
        "success": True,
        "new_balance": acc.points_balance if acc else 0,
        "transaction_id": txn.id
    }
