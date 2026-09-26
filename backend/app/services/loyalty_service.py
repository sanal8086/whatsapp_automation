from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from app.models.models import (
    LoyaltyProgram, LoyaltyReward, LoyaltyTransaction,
    CustomerLoyaltyAccount, Customer
)

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
                status="ACTIVE"
            )
            db.add(program)
            db.commit()
            db.refresh(program)
        return program

    @staticmethod
    def calculate_tier(lifetime_earned: int) -> str:
        if lifetime_earned >= 3000:
            return "PLATINUM"
        elif lifetime_earned >= 1500:
            return "GOLD"
        elif lifetime_earned >= 500:
            return "SILVER"
        return "BRONZE"

    @staticmethod
    def earn_points(
        db: Session,
        tenant_id: str,
        customer_id: str,
        amount_spent: float = 0.0,
        manual_points: Optional[int] = None,
        description: str = "Store purchase"
    ) -> LoyaltyTransaction:
        program = LoyaltyService.get_or_create_program(db, tenant_id)
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

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
            points_to_add = int(program.earn_rate)
        else:
            points_to_add = int(amount_spent * 0.1)

        points_to_add = max(1, points_to_add)

        balance_before = acc.points_balance
        acc.points_balance += points_to_add
        acc.lifetime_earned += points_to_add
        acc.current_tier = LoyaltyService.calculate_tier(acc.lifetime_earned)

        # Update customer spend & visits
        customer.lifetime_spend += amount_spent
        customer.visits_count += 1
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
            expires_at=datetime.now(timezone.utc) + timedelta(days=program.points_expiry_days)
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        # Trigger WhatsApp notification & journey
        try:
            from app.services.automation_runner import AutomationRunner
            if description != "Birthday Bonus":
                AutomationRunner.trigger_points_earned_journey(
                    db=db,
                    tenant_id=tenant_id,
                    customer_id=customer_id,
                    points_added=points_to_add,
                    new_balance=acc.points_balance
                )
        except Exception:
            pass

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
