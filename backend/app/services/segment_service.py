import logging
import math
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.models import Customer, Segment, CustomerLoyaltyAccount
from app.services.rule_registry import (
    RULE_FIELDS,
    RuleValidationError,
    describe_rules,
    validate_rules,
    LEGACY_OPERATORS,
)

logger = logging.getLogger(__name__)


class SegmentService:
    # ------------------------------------------------------------------
    # Value extraction
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_dob(raw: Optional[str]) -> Optional[date]:
        if not raw:
            return None
        try:
            return datetime.strptime(str(raw)[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _extract(customer: Customer, loyalty: Optional[CustomerLoyaltyAccount], field: str) -> Any:
        """Resolve a rule field to its runtime value. None means 'unknown data'."""
        if field == "visits_count":
            return customer.visits_count or 0
        if field == "lifetime_spend":
            return customer.lifetime_spend or 0.0
        if field == "points_balance":
            return loyalty.points_balance if loyalty else 0
        if field == "lifetime_earned":
            return loyalty.lifetime_earned if loyalty else 0
        if field == "tier":
            return (loyalty.current_tier if loyalty else "BRONZE") or "BRONZE"
        if field == "inactivity_days":
            if not customer.last_visit_at:
                return math.inf
            last = customer.last_visit_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - last).days
        if field == "days_since_signup":
            if not customer.created_at:
                return None
            created = customer.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - created).days
        if field == "country":
            return (customer.country or "").strip()
        if field == "gender":
            return (customer.gender or "").strip()
        if field == "source":
            return (customer.source or "").strip()
        if field == "first_name":
            return (customer.first_name or "").strip()
        if field == "phone":
            return (customer.phone or customer.phone_normalized or "").strip()
        if field == "whatsapp_consent":
            return bool(customer.whatsapp_consent)
        if field == "marketing_consent":
            return bool(customer.marketing_consent)
        if field in ("age_years", "birthday_month"):
            dob = SegmentService._parse_dob(customer.date_of_birth)
            if not dob:
                return None
            today = date.today()
            if field == "birthday_month":
                return str(dob.month)
            return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return None

    # ------------------------------------------------------------------
    # Condition evaluation (fail closed)
    # ------------------------------------------------------------------
    @staticmethod
    def _compare(actual: Any, operator: str, expected: Any) -> bool:
        # Unknown data never matches: a broken rule must not silently target everyone.
        if actual is None:
            return False

        if operator in ("is_true", "is_false"):
            return bool(actual) is (operator == "is_true")

        if operator in ("contains", "not_contains", "starts_with", "eq", "neq") and isinstance(expected, str):
            left = str(actual).lower()
            right = expected.lower()
            if operator == "contains":
                return right in left
            if operator == "not_contains":
                return right not in left
            if operator == "starts_with":
                return left.startswith(right)
            if operator == "eq":
                return left == right
            return left != right

        if operator == "in":
            if not isinstance(expected, list):
                return False
            options = {str(v).lower() for v in expected}
            return str(actual).lower() in options

        # Numeric comparisons
        try:
            left = float(actual)
            right = float(expected)
        except (TypeError, ValueError):
            return False

        if operator == "gt":
            return left > right
        if operator == "gte":
            return left >= right
        if operator == "lt":
            return left < right
        if operator == "lte":
            return left <= right
        if operator == "eq":
            return left == right
        if operator == "neq":
            return left != right
        if operator == "between":
            if not isinstance(expected, (list, tuple)) or len(expected) != 2:
                return False
            try:
                low, high = float(expected[0]), float(expected[1])
            except (TypeError, ValueError):
                return False
            return low <= left <= high
        return False

    @staticmethod
    def evaluate_condition(
        customer: Customer,
        loyalty: Optional[CustomerLoyaltyAccount],
        condition: Dict[str, Any],
    ) -> bool:
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")
        if field not in RULE_FIELDS or operator not in RULE_FIELDS[field]["operators"]:
            logger.warning("Rejected unknown audience condition: %r", condition)
            return False
        return SegmentService._compare(SegmentService._extract(customer, loyalty, field), operator, value)

    # ------------------------------------------------------------------
    # Matching
    # ------------------------------------------------------------------
    @staticmethod
    def _load_rows(db: Session, tenant_id: str) -> List[Tuple[Customer, Optional[CustomerLoyaltyAccount]]]:
        """Single joined query (no N+1) for every tenant customer."""
        rows = (
            db.query(Customer, CustomerLoyaltyAccount)
            .outerjoin(CustomerLoyaltyAccount, CustomerLoyaltyAccount.customer_id == Customer.id)
            .filter(Customer.tenant_id == tenant_id)
            .all()
        )
        return [(c, l) for c, l in rows]

    @staticmethod
    def _match_all(
        rows: List[Tuple[Customer, Optional[CustomerLoyaltyAccount]]],
        rules: Dict[str, Any],
    ) -> List[Customer]:
        conditions = rules.get("conditions") or []
        joiner = str(rules.get("operator", "AND")).upper()
        matched: List[Customer] = []
        for customer, loyalty in rows:
            results = [SegmentService.evaluate_condition(customer, loyalty, c) for c in conditions]
            hit = any(results) if joiner == "OR" else all(results)
            if hit:
                matched.append(customer)
        return matched

    @staticmethod
    def filter_customers(db: Session, tenant_id: str, rules: Optional[Dict[str, Any]]) -> List[Customer]:
        """Evaluate an ad-hoc rules dict against all tenant customers (no saved segment required).

        Falsy rules mean an explicit "all customers" audience.
        Invalid rules raise RuleValidationError so API callers can return 422.
        """
        rows = SegmentService._load_rows(db, tenant_id)
        if not rules or not rules.get("conditions"):
            return [c for c, _ in rows]
        return SegmentService._match_all(rows, validate_rules(rules))

    @staticmethod
    def get_segment_customers(db: Session, tenant_id: str, segment_id: Optional[str] = None) -> List[Customer]:
        """Resolve a segment's audience.

        Fail closed: a deleted or corrupt segment yields an EMPTY audience, never
        'every customer' (that would blast the whole tenant base on dispatch).
        """
        if not segment_id:
            # Explicit "all customers" audience (segment_id is None on purpose).
            return db.query(Customer).filter(Customer.tenant_id == tenant_id).all()

        segment = db.query(Segment).filter(Segment.id == segment_id, Segment.tenant_id == tenant_id).first()
        if not segment:
            logger.error("Segment %s no longer exists; audience resolved to 0 customers.", segment_id)
            return []

        if not segment.rules_json or not segment.rules_json.get("conditions"):
            logger.warning("Segment %s has no conditions; audience resolved to 0 customers.", segment_id)
            return []

        try:
            validated = validate_rules(segment.rules_json)
        except RuleValidationError as exc:
            logger.error("Segment %s has invalid rules (%s); audience resolved to 0 customers.", segment_id, exc)
            return []

        rows = SegmentService._load_rows(db, tenant_id)
        return SegmentService._match_all(rows, validated)

    # ------------------------------------------------------------------
    # Preview (count + consent split + sample)
    # ------------------------------------------------------------------
    @staticmethod
    def preview_rules(db: Session, tenant_id: str, rules: Dict[str, Any]) -> Dict[str, Any]:
        validated = validate_rules(rules)  # raises RuleValidationError -> 422 upstream
        rows = SegmentService._load_rows(db, tenant_id)
        matched = SegmentService._match_all(rows, validated)
        reachable = [c for c in matched if c.whatsapp_consent]
        excluded = len(matched) - len(reachable)

        loyalty_by_customer = {c.id: l for c, l in rows}
        sample = []
        for c in matched[:10]:
            loyalty = loyalty_by_customer.get(c.id)
            sample.append({
                "id": c.id,
                "name": " ".join(p for p in [c.first_name, c.last_name] if p) or "Unnamed",
                "phone": c.phone,
                "points_balance": loyalty.points_balance if loyalty else 0,
                "current_tier": loyalty.current_tier if loyalty else "BRONZE",
                "whatsapp_consent": bool(c.whatsapp_consent),
            })

        return {
            "explain": describe_rules(validated),
            "matched_count": len(matched),
            "reachable_count": len(reachable),
            "excluded_no_consent": excluded,
            "total_customers": len(rows),
            "sample": sample,
        }

    @staticmethod
    def describe_rules(rules: Dict[str, Any]) -> str:
        """Human readable one-liner for a rules dict."""
        return describe_rules(rules)
