from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import re

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.models.models import User, Tenant, TenantMember, Wallet, LoyaltyProgram, PublicPage, Subscription, Plan
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])

def slugify(text: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', text).strip().lower()
    return re.sub(r'[\s_-]+', '-', slug)

@router.post("/register", response_model=TokenResponse)
def register(req: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Create User
    user = User(
        name=req.name,
        email=req.email.lower(),
        phone=req.phone,
        password_hash=get_password_hash(req.password),
        is_platform_admin=False
    )
    db.add(user)
    db.flush()

    # Generate unique tenant slug
    base_slug = slugify(req.business_name)
    slug = base_slug
    counter = 1
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create Tenant
    tenant = Tenant(
        name=req.business_name,
        slug=slug,
        business_type=req.business_type or "Retail / Restaurant",
        currency=req.currency or "INR",
        status="ACTIVE",
        subscription_status="TRIAL"
    )
    db.add(tenant)
    db.flush()

    # Tenant Member (Owner)
    member = TenantMember(
        tenant_id=tenant.id,
        user_id=user.id,
        role="OWNER"
    )
    db.add(member)

    # Initialize Wallet with welcome ₹200 promotional credit for WhatsApp testing!
    wallet = Wallet(
        tenant_id=tenant.id,
        currency=tenant.currency,
        balance=250.0,
        reserved_balance=0.0,
        status="ACTIVE"
    )
    db.add(wallet)

    # Initialize Loyalty Program
    loyalty_prog = LoyaltyProgram(
        tenant_id=tenant.id,
        name=f"{tenant.name} Rewards",
        points_currency_name="Points",
        earn_type="SPEND_BASED",
        earn_rate=1.0,
        earn_spend_unit=10.0,
        points_expiry_days=365,
        welcome_bonus_points=100,
        birthday_bonus_points=200
    )
    db.add(loyalty_prog)

    # Initialize Branded Public Page
    public_page = PublicPage(
        tenant_id=tenant.id,
        slug=slug,
        business_name=tenant.name,
        hero_title=f"Welcome to {tenant.name} Rewards",
        hero_description="Earn points on every visit and unlock VIP perks & discounts on WhatsApp!",
        primary_color="#4F46E5",
        secondary_color="#06B6D4"
    )
    db.add(public_page)

    # Initialize Subscription (Trial)
    default_plan = db.query(Plan).filter(Plan.code == "GROWTH").first()
    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=default_plan.id if default_plan else None,
        status="TRIAL",
        payment_status="PENDING",
        amount=1999.0,
        currency=tenant.currency,
        notes="14-Day Free Growth Trial"
    )
    db.add(sub)

    db.commit()
    db.refresh(user)
    db.refresh(tenant)

    token = create_access_token({"sub": user.id, "email": user.email, "tenant_id": tenant.id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "is_platform_admin": user.is_platform_admin
        },
        "current_tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "role": "OWNER"
        }
    }


@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Your account has been deactivated")

    membership = db.query(TenantMember).filter(
        TenantMember.user_id == user.id,
        TenantMember.status == "ACTIVE"
    ).first()

    tenant_info = None
    tenant_id = None
    if membership:
        tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
        if tenant:
            tenant_id = tenant.id
            tenant_info = {
                "id": tenant.id,
                "name": tenant.name,
                "slug": tenant.slug,
                "role": membership.role
            }

    token = create_access_token({"sub": user.id, "email": user.email, "tenant_id": tenant_id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "is_platform_admin": user.is_platform_admin
        },
        "current_tenant": tenant_info
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(TenantMember).filter(TenantMember.user_id == current_user.id).all()
    tenants = []
    for m in memberships:
        t = db.query(Tenant).filter(Tenant.id == m.tenant_id).first()
        if t:
            tenants.append({
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "role": m.role,
                "status": t.status
            })

    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "is_platform_admin": current_user.is_platform_admin,
            "created_at": current_user.created_at
        },
        "tenants": tenants
    }
