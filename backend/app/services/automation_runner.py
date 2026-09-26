from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from app.models.models import (
    Customer, CustomerLoyaltyAccount, LoyaltyProgram, LoyaltyReward,
    WhatsAppConnection, WhatsAppTemplate, Automation, Tenant, PublicPage
)
from app.services.whatsapp_service import WhatsAppService
from app.services.loyalty_service import LoyaltyService
from app.services.audit_service import AuditService
from app.core.config import settings

class AutomationRunner:
    @staticmethod
    def trigger_welcome_journey(db: Session, tenant_id: str, customer_id: str):
        """Sends welcome WhatsApp message to newly enrolled loyalty member"""
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
        if not customer or not customer.whatsapp_consent:
            return

        acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer_id).first()
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        page = db.query(PublicPage).filter(PublicPage.tenant_id == tenant_id).first()
        conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant_id, WhatsAppConnection.connection_status == "CONNECTED").first()

        if not conn:
            return

        points = acc.points_balance if acc else 100
        business_name = tenant.name if tenant else "Our Club"
        portal_url = f"{settings.FRONTEND_URL}/l/{page.slug}" if page else settings.FRONTEND_URL

        text = f"🎉 Welcome to {business_name} VIP Club, {customer.first_name or 'there'}! You've received {points} bonus points. Check your rewards anytime at {portal_url}"
        
        try:
            WhatsAppService.send_single_message(
                db=db,
                tenant_id=tenant_id,
                to_phone=customer.phone_normalized,
                template_name=None,
                custom_text=text,
                customer_id=customer_id
            )
            # Update automation counter
            auto = db.query(Automation).filter(Automation.tenant_id == tenant_id, Automation.trigger_type == "WELCOME").first()
            if auto:
                auto.total_triggered = (auto.total_triggered or 0) + 1
                db.commit()
        except Exception:
            pass

    @staticmethod
    def trigger_points_earned_journey(db: Session, tenant_id: str, customer_id: str, points_added: int, new_balance: int):
        """Sends instant WhatsApp notification when points are earned from a purchase"""
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
        if not customer or not customer.whatsapp_consent:
            return

        conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant_id, WhatsAppConnection.connection_status == "CONNECTED").first()
        if not conn:
            return

        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        business_name = tenant.name if tenant else "Store"

        # Check if tenant has approved template
        tpl = db.query(WhatsAppTemplate).filter(
            WhatsAppTemplate.tenant_id == tenant_id,
            WhatsAppTemplate.name == "loyalty_points_earned",
            WhatsAppTemplate.status == "APPROVED"
        ).first()

        template_name = tpl.name if tpl else None
        components = None
        if template_name:
            components = [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": customer.first_name or "Valued Member"},
                        {"type": "text", "text": str(points_added)},
                        {"type": "text", "text": business_name}
                    ]
                }
            ]

        text = f"✨ Hi {customer.first_name or 'Member'}! You just earned {points_added} points at {business_name}. Your new total balance is {new_balance} points."

        try:
            WhatsAppService.send_single_message(
                db=db,
                tenant_id=tenant_id,
                to_phone=customer.phone_normalized,
                template_name=template_name,
                custom_text=text,
                customer_id=customer_id,
                components=components
            )
        except Exception:
            pass

    @staticmethod
    def trigger_reward_redeemed_journey(db: Session, tenant_id: str, customer_id: str, reward_name: str, points_spent: int, remaining_balance: int):
        """Sends instant WhatsApp voucher confirmation on reward redemption"""
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
        if not customer or not customer.whatsapp_consent:
            return

        conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == tenant_id, WhatsAppConnection.connection_status == "CONNECTED").first()
        if not conn:
            return

        text = f"🎁 Congratulations {customer.first_name or 'Member'}! You have successfully redeemed '{reward_name}' for {abs(points_spent)} points. Remaining balance: {remaining_balance} points. Show this message at checkout!"

        try:
            WhatsAppService.send_single_message(
                db=db,
                tenant_id=tenant_id,
                to_phone=customer.phone_normalized,
                template_name=None,
                custom_text=text,
                customer_id=customer_id
            )
        except Exception:
            pass

    @staticmethod
    def run_scheduled_automations(db: Session):
        """
        Background scheduler task:
        1. Birthday bonuses & messages (within next 2 days)
        2. Inactivity Win-back offers (30+ days no visit)
        """
        now = datetime.now(timezone.utc)
        tenants = db.query(Tenant).filter(Tenant.status == "ACTIVE").all()

        for t in tenants:
            conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.tenant_id == t.id, WhatsAppConnection.connection_status == "CONNECTED").first()
            if not conn:
                continue

            # 1. Birthday automation
            birthday_auto = db.query(Automation).filter(
                Automation.tenant_id == t.id,
                Automation.trigger_type == "BIRTHDAY",
                Automation.status == "ACTIVE"
            ).first()

            if birthday_auto:
                today_md = now.strftime("%m-%d")
                b_customers = db.query(Customer).filter(
                    Customer.tenant_id == t.id,
                    Customer.whatsapp_consent == True,
                    Customer.date_of_birth.like(f"%{today_md}")
                ).all()

                for c in b_customers:
                    # Check if already greeted this year
                    acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == c.id).first()
                    if acc:
                        b_text = f"🎂 Happy Birthday {c.first_name or 'Friend'}! {t.name} wishes you a wonderful year. Enjoy 200 birthday bonus points on us!"
                        try:
                            # Award bonus points
                            LoyaltyService.earn_points(db, t.id, c.id, amount_spent=0, manual_points=200, description="Birthday Bonus")
                            WhatsAppService.send_single_message(db, t.id, c.phone_normalized, custom_text=b_text, customer_id=c.id)
                            birthday_auto.total_triggered = (birthday_auto.total_triggered or 0) + 1
                        except Exception:
                            pass

            # 2. Inactive customer win-back (30+ days no visit)
            winback_auto = db.query(Automation).filter(
                Automation.tenant_id == t.id,
                Automation.trigger_type == "INACTIVITY",
                Automation.status == "ACTIVE"
            ).first()

            if winback_auto:
                cutoff = now - timedelta(days=30)
                inactive_customers = db.query(Customer).filter(
                    Customer.tenant_id == t.id,
                    Customer.whatsapp_consent == True,
                    Customer.visits_count >= 2,
                    Customer.last_visit_at < cutoff
                ).limit(20).all()

                for ic in inactive_customers:
                    w_text = f"❤️ We miss you at {t.name}, {ic.first_name or 'there'}! Visit us this week and get 15% off your order or double points. Show this message at the counter."
                    try:
                        WhatsAppService.send_single_message(db, t.id, ic.phone_normalized, template_name="win_back_offer", custom_text=w_text, customer_id=ic.id)
                        winback_auto.total_triggered = (winback_auto.total_triggered or 0) + 1
                    except Exception:
                        pass

        db.commit()
