from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from app.models.models import (
    LoyaltyProgram, LoyaltyReward, LoyaltyTransaction,
    CustomerLoyaltyAccount, Customer
)

DEFAULT_TIER_CONFIG = {
    "thresholds": {
        "SILVER": 500,
        "GOLD": 1500,
        "PLATINUM": 3000
    },
    "names": {
        "BRONZE": "Bronze",
        "SILVER": "Silver",
        "GOLD": "Gold",
        "PLATINUM": "Platinum"
    }
}

class LoyaltyService:
    @staticmethod
    def get_or_create_program(db: Session, tenant_id: str) -> LoyaltyProgram:
        program = db.query(LoyaltyProgram).filter(LoyaltyProgram.tenant_id == tenant_id).first()
        if not program:
            program = LoyaltyProgram(
                tenant_id=tenant_id,
                name="VIP Rewards",
                points_currency_name="Points",
                earn_type="SPEND_BASED",
                earn_rate=1.0,
                earn_spend_unit=10.0,
                points_expiry_days=365,
                welcome_bonus_points=100,
                birthday_bonus_points=200,
                tier_config=DEFAULT_TIER_CONFIG,
                status="ACTIVE"
            )
            db.add(program)
            db.commit()
            db.refresh(program)
        return program

    @staticmethod
    def get_tier_config(db: Session, tenant_id: str) -> dict:
        program = LoyaltyService.get_or_create_program(db, tenant_id)
        if program.tier_config:
            return program.tier_config
        return DEFAULT_TIER_CONFIG

    @staticmethod
    def calculate_tier(lifetime_earned: int, tier_config: dict = None) -> str:
        config = tier_config or DEFAULT_TIER_CONFIG
        thresholds = config.get("thresholds", DEFAULT_TIER_CONFIG["thresholds"])
        
        if lifetime_earned >= thresholds.get("PLATINUM", 3000):
            return "PLATINUM"
        elif lifetime_earned >= thresholds.get("GOLD", 1500):
            return "GOLD"
        elif lifetime_earned >= thresholds.get("SILVER", 500):
            return "SILVER"
        return "BRONZE"

    @staticmethod
    def earn_points(
        db: Session,
        tenant_id: str,
        customer_id: str,
        amount_spent: float = 0.0,
        visits: int = 1,
        manual_points: Optional[int] = None,
        description: str = "Store purchase",
        expiry_date: Optional[str] = None
    ) -> LoyaltyTransaction:
        program = LoyaltyService.get_or_create_program(db, tenant_id)
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        visits = max(1, int(visits or 1))

        acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer_id).first()
        if not acc:
            acc = CustomerLoyaltyAccount(
                tenant_id=tenant_id,
                customer_id=customer_id,
                points_balance=0,
                lifetime_earned=0,
                lifetime_redeemed=0,
                current_tier="BRONZE"
            )
            db.add(acc)
            db.flush()

        # Calculate points
        if manual_points is not None:
            points_to_add = manual_points
        elif program.earn_type == "SPEND_BASED" and program.earn_spend_unit > 0:
            points_to_add = int((amount_spent / program.earn_spend_unit) * program.earn_rate)
        elif program.earn_type == "VISIT_BASED":
            visit_unit = program.earn_spend_unit if program.earn_spend_unit > 0 else 1.0
            points_per_visit = int((1 / visit_unit) * program.earn_rate)
            points_to_add = points_per_visit * visits
        else:
            points_to_add = int(amount_spent * 0.1)

        points_to_add = max(1, points_to_add)

        balance_before = acc.points_balance
        acc.points_balance += points_to_add
        acc.lifetime_earned += points_to_add
        tier_config = LoyaltyService.get_tier_config(db, tenant_id)
        acc.current_tier = LoyaltyService.calculate_tier(acc.lifetime_earned, tier_config)

        # Update customer spend & visits
        customer.lifetime_spend += amount_spent
        customer.visits_count += visits
        customer.last_visit_at = datetime.now(timezone.utc)

        txn = LoyaltyTransaction(
            tenant_id=tenant_id,
            customer_id=customer_id,
            type="EARN",
            points=points_to_add,
            balance_before=balance_before,
            balance_after=acc.points_balance,
            reference_type="PURCHASE",
            description=description,
            expires_at=(
                datetime.fromisoformat(expiry_date).replace(tzinfo=timezone.utc)
                if expiry_date
                else datetime.now(timezone.utc) + timedelta(days=program.points_expiry_days)
            )
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        # WhatsApp notification is now handled by the /loyalty/earn API endpoint
        # (sends 'hellopetsn' template via send_award_rewards_whatsapp)
        return txn

    @staticmethod
    def redeem_reward(
        db: Session,
        tenant_id: str,
        customer_id: str,
        reward_id: Optional[str] = None,
        custom_points: Optional[int] = None,
        description: Optional[str] = None
    ) -> LoyaltyTransaction:
        acc = db.query(CustomerLoyaltyAccount).filter(
            CustomerLoyaltyAccount.customer_id == customer_id,
            CustomerLoyaltyAccount.tenant_id == tenant_id
        ).first()

        if not acc:
            raise HTTPException(status_code=404, detail="Customer loyalty account not found")

        points_required = 0
        desc = description or "Reward Redemption"
        reward_item_name = "Custom Reward"

        if reward_id:
            reward = db.query(LoyaltyReward).filter(
                LoyaltyReward.id == reward_id,
                LoyaltyReward.tenant_id == tenant_id
            ).first()
            if not reward or reward.status != "ACTIVE":
                raise HTTPException(status_code=400, detail="Reward is not available")
            if reward.stock == 0:
                raise HTTPException(status_code=400, detail="Reward is out of stock")

            points_required = reward.points_required
            reward_item_name = reward.name
            desc = f"Redeemed: {reward.name}"
            if reward.stock > 0:
                reward.stock -= 1
        elif custom_points:
            points_required = custom_points
        else:
            raise HTTPException(status_code=400, detail="Specify either reward_id or points to redeem")

        if acc.points_balance < points_required:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient points. Required: {points_required}, Available: {acc.points_balance}"
            )

        balance_before = acc.points_balance
        acc.points_balance -= points_required
        acc.lifetime_redeemed += points_required

        txn = LoyaltyTransaction(
            tenant_id=tenant_id,
            customer_id=customer_id,
            type="REDEEM",
            points=-points_required,
            balance_before=balance_before,
            balance_after=acc.points_balance,
            reference_type="REWARD_REDEMPTION",
            reference_id=reward_id,
            description=desc
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        # Trigger WhatsApp voucher notification
        try:
            from app.services.automation_runner import AutomationRunner
            AutomationRunner.trigger_reward_redeemed_journey(
                db=db,
                tenant_id=tenant_id,
                customer_id=customer_id,
                reward_name=reward_item_name,
                points_spent=points_required,
                remaining_balance=acc.points_balance
            )
        except Exception:
            pass

        return txn
