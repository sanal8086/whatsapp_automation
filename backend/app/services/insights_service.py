from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from app.models.models import (
    Customer, CustomerLoyaltyAccount, LoyaltyReward, Campaign,
    DailyTenantMetric, LoyaltyTransaction
)

class InsightsService:
    @staticmethod
    def generate_insights(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
        insights = []
        now = datetime.now(timezone.utc)

        # 1. Inactive customers (30+ days no visit)
        thirty_days_ago = now - timedelta(days=30)
        inactive_count = db.query(Customer).filter(
            Customer.tenant_id == tenant_id,
            (Customer.last_visit_at < thirty_days_ago) | (Customer.last_visit_at == None)
        ).count()

        if inactive_count > 0:
            insights.append({
                "id": "insight_inactive_winback",
                "category": "WIN_BACK",
                "title": f"{inactive_count} customers haven't visited in 30+ days",
                "description": "Launching a win-back campaign with a 15% discount or bonus points can recover lost revenue.",
                "metric": f"{inactive_count} Dormant Customers",
                "action_label": "Create Win-Back Campaign",
                "action_type": "CREATE_CAMPAIGN",
                "action_payload": {"campaign_name": "We Miss You Special", "suggested_discount": 15}
            })

        # 2. Customers eligible for rewards who haven't redeemed
        min_reward = db.query(LoyaltyReward).filter(
            LoyaltyReward.tenant_id == tenant_id,
            LoyaltyReward.status == "ACTIVE"
        ).order_by(LoyaltyReward.points_required.asc()).first()

        if min_reward:
            eligible_count = db.query(CustomerLoyaltyAccount).filter(
                CustomerLoyaltyAccount.tenant_id == tenant_id,
                CustomerLoyaltyAccount.points_balance >= min_reward.points_required
            ).count()

            if eligible_count > 0:
                insights.append({
                    "id": "insight_unredeemed_rewards",
                    "category": "REWARD_USAGE",
                    "title": f"{eligible_count} members have enough points to claim '{min_reward.name}'",
                    "description": "Unclaimed points lead to churn. Send a reward reminder to encourage store visits.",
                    "metric": f"{eligible_count} Members Ready",
                    "action_label": "Send Reward Reminder",
                    "action_type": "CREATE_CAMPAIGN",
                    "action_payload": {"campaign_name": f"Claim your {min_reward.name}"}
                })

        # 3. Gold / Platinum Tier value comparison
        gold_members = db.query(CustomerLoyaltyAccount).filter(
            CustomerLoyaltyAccount.tenant_id == tenant_id,
            CustomerLoyaltyAccount.current_tier.in_(["GOLD", "PLATINUM"])
        ).all()

        if gold_members:
            gold_ids = [m.customer_id for m in gold_members]
            gold_customers = db.query(Customer).filter(Customer.id.in_(gold_ids)).all()
            all_customers = db.query(Customer).filter(Customer.tenant_id == tenant_id).all()

            if gold_customers and len(all_customers) > len(gold_customers):
                avg_gold_spend = sum(c.lifetime_spend for c in gold_customers) / len(gold_customers)
                avg_all_spend = sum(c.lifetime_spend for c in all_customers) / len(all_customers)
                ratio = round(avg_gold_spend / max(1.0, avg_all_spend), 1)

                if ratio > 1.2:
                    insights.append({
                        "id": "insight_tier_revenue",
                        "category": "TIER_REVENUE",
                        "title": f"VIP members spend {ratio}x more than your average customer",
                        "description": f"Your {len(gold_customers)} Gold & Platinum members drive high repeat sales. Consider an exclusive VIP appreciation event.",
                        "metric": f"{ratio}x Spend Multiplier",
                        "action_label": "View VIP Customers",
                        "action_type": "VIEW_CUSTOMERS",
                        "action_payload": {"tier": "GOLD"}
                    })

        # 4. Birthday upcoming opportunities
        insights.append({
            "id": "insight_birthdays",
            "category": "CELEBRATION",
            "title": "Automated Birthday Delight is active",
            "description": "Customers receive birthday wishes and 200 bonus points automatically 2 days before their special day.",
            "metric": "Auto-Delivered",
            "action_label": "View Automations",
            "action_type": "VIEW_AUTOMATIONS",
            "action_payload": {}
        })

        return insights
