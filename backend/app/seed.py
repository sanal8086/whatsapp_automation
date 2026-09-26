from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import random

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.models import (
    User, Tenant, TenantMember, Plan, Subscription,
    Wallet, WalletTransaction, WhatsAppConnection,
    PlatformTemplate, WhatsAppTemplate, Customer, CustomerLoyaltyAccount,
    LoyaltyProgram, LoyaltyReward, LoyaltyTransaction, Segment,
    Campaign, CampaignRecipient, WhatsAppMessage, Automation, PublicPage
)

def run_seed():
    print("[INFO] Seeding database with rich multi-tenant loyalty data...")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Plans
        plans_data = [
            {"name": "Starter", "code": "STARTER", "price": 999.0, "max_customers": 1000, "features": {"whatsapp": True, "rewards": 5}},
            {"name": "Growth", "code": "GROWTH", "price": 2499.0, "max_customers": 10000, "features": {"whatsapp": True, "rewards": 25, "automations": True, "segments": True}},
            {"name": "Enterprise", "code": "ENTERPRISE", "price": 6999.0, "max_customers": 100000, "features": {"whatsapp": True, "rewards": -1, "automations": True, "segments": True, "priority_support": True}}
        ]
        for p in plans_data:
            if not db.query(Plan).filter(Plan.code == p["code"]).first():
                db.add(Plan(name=p["name"], code=p["code"], price=p["price"], max_customers=p["max_customers"], features_json=p["features"]))
        db.commit()

        # 2. Global Platform Templates
        global_templates = [
            {
                "key": "LOYALTY_WELCOME",
                "name": "Welcome to Loyalty Club",
                "category": "LOYALTY",
                "header_text": "Welcome to {{business_name}}! 🎉",
                "body_text": "Hi {{first_name}}, thanks for joining our rewards program! You've been credited with {{points}} bonus points to get you started. Check your rewards here: {{loyalty_url}}",
                "footer_text": "Reply STOP to unsubscribe",
                "buttons_json": [{"type": "URL", "text": "View My Rewards", "url": "{{loyalty_url}}"}]
            },
            {
                "key": "LOYALTY_POINTS_EARNED",
                "name": "Points Earned Notification",
                "category": "LOYALTY",
                "header_text": "Points Earned! ⭐",
                "body_text": "Hi {{first_name}}, you just earned {{points_earned}} points on your recent visit at {{business_name}}! Your new balance is {{points_balance}} points.",
                "footer_text": "Visit us again soon!",
                "buttons_json": [{"type": "URL", "text": "Redeem Rewards", "url": "{{loyalty_url}}"}]
            },
            {
                "key": "WIN_BACK_OFFER",
                "name": "Win Back Inactive Customer",
                "category": "CAMPAIGNS",
                "header_text": "We Miss You at {{business_name}}! ☕",
                "body_text": "Hi {{first_name}}, it's been a while since your last visit. Here is a special 20% discount coupon just for you: *COMEBACK20*. Valid this week only!",
                "footer_text": "Show this message at billing",
                "buttons_json": [{"type": "URL", "text": "Claim Offer", "url": "{{loyalty_url}}"}]
            },
            {
                "key": "BIRTHDAY_DELIGHT",
                "name": "Happy Birthday Bonus",
                "category": "CRM",
                "header_text": "Happy Birthday {{first_name}}! 🎂",
                "body_text": "The team at {{business_name}} wishes you a fantastic birthday! We added 200 birthday bonus points to your loyalty wallet. Enjoy a complimentary dessert on us!",
                "footer_text": "Valid for the next 14 days",
                "buttons_json": [{"type": "URL", "text": "See Birthday Perks", "url": "{{loyalty_url}}"}]
            },
            {
                "key": "POINTS_EXPIRING",
                "name": "Points Expiry Reminder",
                "category": "LOYALTY",
                "header_text": "Your Points Are Expiring Soon ⏳",
                "body_text": "Hi {{first_name}}, you have {{points_balance}} points expiring in 7 days at {{business_name}}. Don't let your free rewards slip away!",
                "footer_text": "Redeem in store or online",
                "buttons_json": [{"type": "URL", "text": "Redeem Now", "url": "{{loyalty_url}}"}]
            }
        ]
        for gt in global_templates:
            if not db.query(PlatformTemplate).filter(PlatformTemplate.key == gt["key"]).first():
                db.add(PlatformTemplate(
                    key=gt["key"],
                    name=gt["name"],
                    category=gt["category"],
                    header_text=gt["header_text"],
                    body_text=gt["body_text"],
                    footer_text=gt["footer_text"],
                    buttons_json=gt["buttons_json"]
                ))
        db.commit()

        # 3. Platform Admin User
        admin_user = db.query(User).filter(User.email == "admin@loyaltysaas.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@loyaltysaas.com",
                name="SaaS Super Admin",
                password_hash=get_password_hash("admin123"),
                is_platform_admin=True
            )
            db.add(admin_user)
            db.commit()

        # 4. Demo Merchant Tenant
        merchant_user = db.query(User).filter(User.email == "merchant@brewandbite.com").first()
        if not merchant_user:
            merchant_user = User(
                email="merchant@brewandbite.com",
                name="Arjun Mehta",
                phone="+919876500000",
                password_hash=get_password_hash("merchant123"),
                is_platform_admin=False
            )
            db.add(merchant_user)
            db.flush()

        tenant = db.query(Tenant).filter(Tenant.slug == "brew-and-bite").first()
        if not tenant:
            tenant = Tenant(
                name="Brew & Bite Artisan Cafe",
                slug="brew-and-bite",
                business_type="Cafe & Bakery",
                country="India",
                currency="INR",
                status="ACTIVE",
                subscription_status="ACTIVE"
            )
            db.add(tenant)
            db.flush()

            # Membership
            member = TenantMember(
                tenant_id=tenant.id,
                user_id=merchant_user.id,
                role="OWNER"
            )
            db.add(member)

            # Subscription
            growth_plan = db.query(Plan).filter(Plan.code == "GROWTH").first()
            sub = Subscription(
                tenant_id=tenant.id,
                plan_id=growth_plan.id if growth_plan else None,
                status="ACTIVE",
                payment_status="MANUAL_VERIFIED",
                amount=2499.0,
                currency="INR",
                starts_at=datetime.now(timezone.utc) - timedelta(days=15),
                ends_at=datetime.now(timezone.utc) + timedelta(days=75),
                notes="Quarterly Growth Plan - Verified by Admin"
            )
            db.add(sub)

            # Wallet & Ledger
            wallet = Wallet(
                tenant_id=tenant.id,
                currency="INR",
                balance=3450.0,
                reserved_balance=0.0,
                status="ACTIVE"
            )
            db.add(wallet)
            db.flush()

            txn1 = WalletTransaction(
                wallet_id=wallet.id,
                tenant_id=tenant.id,
                type="CREDIT",
                amount=3500.0,
                balance_before=0.0,
                balance_after=3500.0,
                reference_type="MANUAL_ADMIN_TOPUP",
                description="Prepaid messaging pack - 5,000 WhatsApp credits",
                created_by="Admin"
            )
            txn2 = WalletTransaction(
                wallet_id=wallet.id,
                tenant_id=tenant.id,
                type="DEBIT",
                amount=50.0,
                balance_before=3500.0,
                balance_after=3450.0,
                reference_type="CAMPAIGN_DISPATCH",
                description="Weekend Brew Alert WhatsApp campaign dispatch",
                created_by="SYSTEM"
            )
            db.add_all([txn1, txn2])

            # WhatsApp Connection
            wa = WhatsAppConnection(
                tenant_id=tenant.id,
                meta_business_id="meta_biz_99281726",
                waba_id="waba_brew_bite_01",
                phone_number_id="phone_num_998124",
                display_phone_number="+91 98765 43210",
                verified_name="Brew & Bite Artisan Cafe",
                connection_status="CONNECTED",
                business_verification_status="VERIFIED",
                phone_verification_status="VERIFIED",
                access_token_encrypted="meta_token_secure_demo_key",
                quality_rating="GREEN",
                connected_at=datetime.now(timezone.utc) - timedelta(days=30),
                last_synced_at=datetime.now(timezone.utc)
            )
            db.add(wa)

            # Provision merchant templates
            pts = db.query(PlatformTemplate).all()
            for pt in pts:
                db.add(WhatsAppTemplate(
                    tenant_id=tenant.id,
                    waba_id=wa.waba_id,
                    platform_template_id=pt.id,
                    meta_template_id=f"meta_{pt.key.lower()}",
                    name=pt.key.lower(),
                    category=pt.category,
                    language=pt.language,
                    status="APPROVED",
                    header_text=pt.header_text,
                    body_text=pt.body_text,
                    footer_text=pt.footer_text,
                    buttons_json=pt.buttons_json
                ))

            # Loyalty Program
            lp = LoyaltyProgram(
                tenant_id=tenant.id,
                name="Brew Perks Club",
                points_currency_name="Beans",
                earn_type="SPEND_BASED",
                earn_rate=1.0,
                earn_spend_unit=10.0,  # 10 spent = 1 bean
                points_expiry_days=365,
                welcome_bonus_points=100,
                birthday_bonus_points=200
            )
            db.add(lp)

            # Rewards
            rewards_list = [
                {"name": "Free Artisan Cappuccino", "description": "Single origin espresso with silky microfoam", "points": 150, "cash": 180.0, "img": "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&q=80"},
                {"name": "₹100 Off On Any Meal", "description": "Applicable on food bills above ₹300", "points": 300, "cash": 100.0, "img": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80"},
                {"name": "Avocado Tartine & Cold Brew", "description": "Sourdough toast with poached egg & cold brew", "points": 500, "cash": 380.0, "img": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80"},
                {"name": "VIP Sunday Brunch for Two", "description": "Unlimited pastries, two entrees and specialty coffee", "points": 1200, "cash": 1400.0, "img": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&q=80"}
            ]
            for r in rewards_list:
                db.add(LoyaltyReward(
                    tenant_id=tenant.id,
                    name=r["name"],
                    description=r["description"],
                    points_required=r["points"],
                    cash_value=r["cash"],
                    image_url=r["img"],
                    terms="Valid Monday to Sunday. Show in store at billing.",
                    stock=-1,
                    status="ACTIVE"
                ))

            # Public Branded Page
            pub = PublicPage(
                tenant_id=tenant.id,
                slug="brew-and-bite",
                business_name="Brew & Bite Artisan Cafe",
                hero_title="Sip, Savor & Earn Free Coffee ☕",
                hero_description="Join Brew Perks Club today. Earn Beans on every visit, unlock complimentary drinks and enjoy member-exclusive tastings!",
                primary_color="#059669",  # Artisan Emerald
                secondary_color="#D97706", # Amber Coffee
                terms_text="Beans expire after 365 days of inactivity. Cannot be exchanged for cash.",
                contact_phone="+91 98765 43210",
                contact_email="hello@brewandbitecafe.com"
            )
            db.add(pub)

            # Segments
            seg1 = Segment(
                tenant_id=tenant.id,
                name="Inactive VIPs (30+ days)",
                description="Customers with visits who haven't returned in 30 days",
                rules_json={
                    "operator": "AND",
                    "conditions": [
                        {"field": "inactivity_days", "operator": "greater_than", "value": 30},
                        {"field": "visits_count", "operator": "greater_than_or_equal", "value": 2}
                    ]
                }
            )
            seg2 = Segment(
                tenant_id=tenant.id,
                name="Coffee Enthusiasts (5+ visits)",
                description="Regular visitors with high loyalty frequency",
                rules_json={
                    "operator": "AND",
                    "conditions": [
                        {"field": "visits_count", "operator": "greater_than_or_equal", "value": 5}
                    ]
                }
            )
            seg3 = Segment(
                tenant_id=tenant.id,
                name="Reward Ready (200+ points)",
                description="Customers who can claim at least one instant reward",
                rules_json={
                    "operator": "AND",
                    "conditions": [
                        {"field": "points_balance", "operator": "greater_than_or_equal", "value": 200}
                    ]
                }
            )
            db.add_all([seg1, seg2, seg3])
            db.flush()

            # Automations
            auto1 = Automation(
                tenant_id=tenant.id,
                name="Birthday Delight Bonus",
                trigger_type="BIRTHDAY",
                conditions_json={"days_before": 2},
                delay_minutes=0,
                status="ACTIVE",
                total_triggered=48
            )
            auto2 = Automation(
                tenant_id=tenant.id,
                name="30-Day Inactivity Win-Back",
                trigger_type="INACTIVITY",
                conditions_json={"inactivity_days": 30},
                delay_minutes=60,
                status="ACTIVE",
                total_triggered=92
            )
            db.add_all([auto1, auto2])

            # Sample Customers
            customer_names = [
                ("Rohan", "Sharma", "+919811100001", "rohan@gmail.com", 12, 4200.0, 5, 420, "GOLD"),
                ("Priya", "Kapoor", "+919811100002", "priya.k@yahoo.com", 8, 2800.0, 12, 380, "SILVER"),
                ("Ananya", "Verma", "+919811100003", "ananya@gmail.com", 21, 9800.0, 3, 1180, "PLATINUM"),
                ("Vikram", "Malhotra", "+919811100004", "vikram@outlook.com", 3, 950.0, 42, 195, "BRONZE"),
                ("Sneha", "Reddy", "+919811100005", "sneha.r@gmail.com", 15, 6100.0, 2, 710, "GOLD"),
                ("Karan", "Singhania", "+919811100006", "karan@corp.in", 2, 600.0, 55, 160, "BRONZE"),
                ("Meera", "Joshi", "+919811100007", "meera@gmail.com", 7, 2400.0, 18, 340, "SILVER"),
                ("Aditya", "Patel", "+919811100008", "adi.patel@gmail.com", 18, 7900.0, 4, 890, "GOLD"),
                ("Divya", "Menon", "+919811100009", "divya@live.com", 4, 1400.0, 35, 240, "BRONZE"),
                ("Rahul", "Nair", "+919811100010", "rahul.nair@gmail.com", 26, 12500.0, 1, 1450, "PLATINUM")
            ]

            now = datetime.now(timezone.utc)

            for fn, ln, ph, em, visits, spend, days_ago, points, tier in customer_names:
                cust = Customer(
                    tenant_id=tenant.id,
                    phone=ph,
                    phone_normalized=ph,
                    first_name=fn,
                    last_name=ln,
                    email=em,
                    city="Mumbai",
                    source="PUBLIC_PAGE" if visits > 10 else "IN_STORE",
                    marketing_consent=True,
                    whatsapp_consent=True,
                    visits_count=visits,
                    lifetime_spend=spend,
                    last_visit_at=now - timedelta(days=days_ago)
                )
                db.add(cust)
                db.flush()

                acc = CustomerLoyaltyAccount(
                    tenant_id=tenant.id,
                    customer_id=cust.id,
                    points_balance=points,
                    lifetime_earned=points + (150 if visits > 5 else 0),
                    lifetime_redeemed=150 if visits > 5 else 0,
                    current_tier=tier
                )
                db.add(acc)

                txn = LoyaltyTransaction(
                    tenant_id=tenant.id,
                    customer_id=cust.id,
                    type="EARN",
                    points=int(spend / 10),
                    balance_before=points - int(spend / 10),
                    balance_after=points,
                    reference_type="PURCHASE",
                    description=f"Earned Beans on visit #{visits}",
                    created_at=now - timedelta(days=days_ago)
                )
                db.add(txn)

            # Sample Campaigns
            camp1 = Campaign(
                tenant_id=tenant.id,
                name="Monsoon Hot Chocolate Fest",
                channel="WHATSAPP",
                status="COMPLETED",
                recipients_count=250,
                sent_count=250,
                delivered_count=242,
                read_count=198,
                failed_count=8,
                estimated_cost=195.0,
                actual_cost=188.76,
                attributed_revenue=8420.0,
                created_at=now - timedelta(days=10)
            )
            camp2 = Campaign(
                tenant_id=tenant.id,
                name="Weekend Special Win-Back",
                channel="WHATSAPP",
                status="COMPLETED",
                recipients_count=180,
                sent_count=180,
                delivered_count=176,
                read_count=145,
                failed_count=4,
                estimated_cost=140.4,
                actual_cost=137.28,
                attributed_revenue=5940.0,
                created_at=now - timedelta(days=3)
            )
            db.add_all([camp1, camp2])

        db.commit()
        print("[SUCCESS] Seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
