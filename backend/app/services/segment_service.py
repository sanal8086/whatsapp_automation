from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from app.models.models import Customer, Segment, CustomerLoyaltyAccount

class SegmentService:
    @staticmethod
    def evaluate_condition(customer: Customer, loyalty: CustomerLoyaltyAccount, condition: Dict[str, Any]) -> bool:
        field = condition.get("field")
        op = condition.get("operator")
        val = condition.get("value")

        if field == "visits_count":
            c_val = customer.visits_count
            if op == "greater_than": return c_val > val
            if op == "greater_than_or_equal": return c_val >= val
            if op == "less_than": return c_val < val
            if op == "equals": return c_val == val

        elif field == "lifetime_spend":
            c_val = customer.lifetime_spend
            if op == "greater_than": return c_val > val
            if op == "greater_than_or_equal": return c_val >= val
            if op == "less_than": return c_val < val

        elif field == "points_balance":
            c_val = loyalty.points_balance if loyalty else 0
            if op == "greater_than": return c_val > val
            if op == "greater_than_or_equal": return c_val >= val
            if op == "less_than": return c_val < val

        elif field == "tier":
            c_val = loyalty.current_tier if loyalty else "BRONZE"
            if op == "equals": return c_val.upper() == str(val).upper()

        elif field == "last_visit_days" or field == "inactivity_days":
            if not customer.last_visit_at:
                return True
            # days since last visit
            diff_days = (datetime.now(timezone.utc) - customer.last_visit_at.replace(tzinfo=timezone.utc)).days
            if op == "greater_than" or op == "before_days": return diff_days >= val
            if op == "less_than": return diff_days <= val

        elif field == "city":
            c_val = (customer.city or "").lower()
            return str(val).lower() in c_val

        return True

    @staticmethod
    def get_segment_customers(db: Session, tenant_id: str, segment_id: Optional[str] = None) -> List[Customer]:
        customers = db.query(Customer).filter(Customer.tenant_id == tenant_id).all()
        if not segment_id:
            return customers

        segment = db.query(Segment).filter(Segment.id == segment_id, Segment.tenant_id == tenant_id).first()
        if not segment or not segment.rules_json:
            return customers

        rules = segment.rules_json
        conditions = rules.get("conditions", [])
        operator = rules.get("operator", "AND").upper()

        if not conditions:
            return customers

        matched = []
        for customer in customers:
            loyalty = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer.id).first()
            if operator == "AND":
                is_match = all(SegmentService.evaluate_condition(customer, loyalty, c) for c in conditions)
            else:
                is_match = any(SegmentService.evaluate_condition(customer, loyalty, c) for c in conditions)

            if is_match:
                matched.append(customer)

        return matched
