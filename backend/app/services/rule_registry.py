"""Canonical registry for customer audience rules.

Single source of truth for:
  * which customer fields can be targeted
  * which operators each field type accepts
  * value coercion + validation (fail closed: bad rules never silently match everyone)

The registry is exposed to the frontend via `GET /api/v1/segments/fields` so the
RuleBuilder UI is always in sync with what the backend can actually evaluate.

Rule JSON (v2):
    {"version": 2, "operator": "AND"|"OR", "conditions": [
        {"field": "visits_count", "operator": "gte", "value": 3}, ...
    ]}

v1 rules (greater_than / equals / last_visit_days / ...) are normalized on input.
"""

from __future__ import annotations

from typing import Any, Dict, List

MAX_CONDITIONS = 25

NUMBER = "number"
TEXT = "text"
ENUM = "enum"
BOOLEAN = "boolean"

# ---------------------------------------------------------------------------
# Operators
# ---------------------------------------------------------------------------

OPERATORS: Dict[str, Dict[str, Any]] = {
    "gt": {"label": "is more than", "symbol": ">", "types": [NUMBER]},
    "gte": {"label": "is at least", "symbol": "\u2265", "types": [NUMBER]},
    "lt": {"label": "is less than", "symbol": "<", "types": [NUMBER]},
    "lte": {"label": "is at most", "symbol": "\u2264", "types": [NUMBER]},
    "eq": {"label": "is exactly", "symbol": "=", "types": [NUMBER, TEXT, ENUM]},
    "neq": {"label": "is not", "symbol": "\u2260", "types": [NUMBER, TEXT, ENUM]},
    "between": {"label": "is between", "symbol": "between", "types": [NUMBER]},
    "contains": {"label": "contains", "symbol": "contains", "types": [TEXT]},
    "not_contains": {"label": "does not contain", "symbol": "not contains", "types": [TEXT]},
    "starts_with": {"label": "starts with", "symbol": "starts with", "types": [TEXT]},
    "in": {"label": "is any of", "symbol": "in", "types": [ENUM]},
    "is_true": {"label": "is enabled", "symbol": "is enabled", "types": [BOOLEAN]},
    "is_false": {"label": "is disabled", "symbol": "is disabled", "types": [BOOLEAN]},
}

# Legacy v1 operator -> v2 operator
LEGACY_OPERATORS: Dict[str, str] = {
    "greater_than": "gt",
    "greater_than_or_equal": "gte",
    "before_days": "gte",
    "less_than": "lt",
    "less_than_or_equal": "lte",
    "equals": "eq",
    "not_equals": "neq",
}

LEGACY_FIELDS: Dict[str, str] = {
    "last_visit_days": "inactivity_days",
}

# ---------------------------------------------------------------------------
# Fields
# ---------------------------------------------------------------------------

_TIER_OPTIONS = [
    {"value": "BRONZE", "label": "Bronze"},
    {"value": "SILVER", "label": "Silver"},
    {"value": "GOLD", "label": "Gold"},
    {"value": "PLATINUM", "label": "Platinum"},
]

_GENDER_OPTIONS = [
    {"value": "FEMALE", "label": "Female"},
    {"value": "MALE", "label": "Male"},
    {"value": "OTHER", "label": "Other"},
]

_SOURCE_OPTIONS = [
    {"value": "MANUAL", "label": "Added manually"},
    {"value": "EXCEL_IMPORT", "label": "Imported (Excel/CSV)"},
    {"value": "PUBLIC_PAGE", "label": "Public loyalty page"},
    {"value": "IN_STORE", "label": "In store / POS"},
    {"value": "WHATSAPP_INBOUND", "label": "WhatsApp inbound"},
]

_MONTH_OPTIONS = [
    {"value": str(m), "label": label}
    for m, label in enumerate(
        ["January", "February", "March", "April", "May", "June",
         "July", "August", "September", "October", "November", "December"],
        start=1,
    )
]

_NUMBER_OPS = ["gte", "gt", "lte", "lt", "eq", "neq", "between"]
_TEXT_OPS = ["contains", "not_contains", "starts_with", "eq", "neq"]
_ENUM_OPS = ["eq", "neq", "in"]

RULE_FIELDS: Dict[str, Dict[str, Any]] = {
    # ---- Behavior ----
    "visits_count": {
        "label": "Visit Count", "short_label": "Visits", "group": "Behavior",
        "type": NUMBER, "operators": _NUMBER_OPS, "placeholder": "e.g. 3",
        "help": "Total recorded visits for this customer.",
    },
    "lifetime_spend": {
        "label": "Lifetime Spend (\u20b9)", "short_label": "Spend \u20b9", "group": "Behavior",
        "type": NUMBER, "operators": _NUMBER_OPS, "placeholder": "e.g. 5000",
        "help": "Sum of all recorded transaction amounts.",
    },
    "inactivity_days": {
        "label": "Days Since Last Visit", "short_label": "Inactive days", "group": "Behavior",
        "type": NUMBER, "operators": ["gte", "gt", "lte", "lt", "eq", "between"],
        "placeholder": "e.g. 30",
        "help": "Customers who never visited are treated as infinitely inactive.",
    },
    "days_since_signup": {
        "label": "Days Since Signup", "short_label": "New/old account", "group": "Behavior",
        "type": NUMBER, "operators": ["lte", "lt", "gte", "gt", "eq", "between"],
        "placeholder": "e.g. 30",
        "help": "Age of the customer record in days. Use \u2264 30 for recent signups.",
    },
    # ---- Loyalty ----
    "points_balance": {
        "label": "Points Balance", "short_label": "Points", "group": "Loyalty",
        "type": NUMBER, "operators": _NUMBER_OPS, "placeholder": "e.g. 200",
        "help": "Redeemable points currently available.",
    },
    "lifetime_earned": {
        "label": "Lifetime Points Earned", "short_label": "Earned pts", "group": "Loyalty",
        "type": NUMBER, "operators": _NUMBER_OPS, "placeholder": "e.g. 1000",
        "help": "Total points ever earned (including redeemed).",
    },
    "tier": {
        "label": "Loyalty Tier", "short_label": "Tier", "group": "Loyalty",
        "type": ENUM, "operators": _ENUM_OPS, "options": _TIER_OPTIONS,
        "help": "Current tier assigned by the loyalty program.",
    },
    # ---- Demographics ----
    "country": {
        "label": "Country", "short_label": "Country", "group": "Demographics",
        "type": TEXT, "operators": _TEXT_OPS, "placeholder": "e.g. India",
        "help": "Case-insensitive match against the stored country.",
    },
    "gender": {
        "label": "Gender", "short_label": "Gender", "group": "Demographics",
        "type": ENUM, "operators": _ENUM_OPS, "options": _GENDER_OPTIONS,
        "help": "Profile gender, if provided.",
    },
    "source": {
        "label": "Customer Source", "short_label": "Source", "group": "Demographics",
        "type": ENUM, "operators": _ENUM_OPS, "options": _SOURCE_OPTIONS,
        "help": "Where the customer was captured.",
    },
    "age_years": {
        "label": "Age (years)", "short_label": "Age", "group": "Demographics",
        "type": NUMBER, "operators": _NUMBER_OPS, "placeholder": "e.g. 30",
        "help": "Derived from date of birth. Customers without a DOB never match.",
    },
    "birthday_month": {
        "label": "Birthday Month", "short_label": "Birthday", "group": "Demographics",
        "type": ENUM, "operators": ["eq", "in"], "options": _MONTH_OPTIONS,
        "help": "Derived from date of birth. Great for birthday campaigns.",
    },
    # ---- Contact ----
    "first_name": {
        "label": "First Name", "short_label": "Name", "group": "Contact",
        "type": TEXT, "operators": _TEXT_OPS, "placeholder": "e.g. Priya",
        "help": "Case-insensitive match on the first name.",
    },
    "phone": {
        "label": "Phone Number", "short_label": "Phone", "group": "Contact",
        "type": TEXT, "operators": ["contains", "eq", "neq", "starts_with"],
        "placeholder": "e.g. 98765",
        "help": "Digits as stored on the customer record.",
    },
    # ---- Consent ----
    "whatsapp_consent": {
        "label": "WhatsApp Opt-in", "short_label": "WhatsApp opt-in", "group": "Consent",
        "type": BOOLEAN, "operators": ["is_true", "is_false"],
        "help": "Only opted-in customers are reachable on WhatsApp.",
    },
    "marketing_consent": {
        "label": "Marketing Opt-in", "short_label": "Marketing opt-in", "group": "Consent",
        "type": BOOLEAN, "operators": ["is_true", "is_false"],
        "help": "General marketing permission flag.",
    },
}

FIELD_ORDER: List[str] = list(RULE_FIELDS.keys())

GROUP_ORDER: List[str] = ["Behavior", "Loyalty", "Demographics", "Contact", "Consent"]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class RuleValidationError(ValueError):
    """Raised when an audience rule payload is malformed."""

    def __init__(self, errors: List[Dict[str, str]]):
        self.errors = errors
        super().__init__("; ".join(f"{e['path']}: {e['message']}" for e in errors))


def _err(path: str, message: str) -> Dict[str, str]:
    return {"path": path, "message": message}


def _coerce_number(value: Any) -> float:
    if isinstance(value, bool):
        raise ValueError("expected a number")
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValueError("value is empty")
        return float(text)
    raise ValueError("expected a number")


def _pretty_number(num: float) -> Any:
    return int(num) if float(num).is_integer() else num


def _normalize_condition(index: int, raw: Any, errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    path = f"conditions[{index}]"
    if not isinstance(raw, dict):
        errors.append(_err(path, "Each condition must be an object."))
        return {}

    field_raw = raw.get("field")
    field = LEGACY_FIELDS.get(str(field_raw), str(field_raw)) if field_raw is not None else None
    if field not in RULE_FIELDS:
        errors.append(_err(f"{path}.field", f"Unknown field '{field_raw}'."))
        return {}
    spec = RULE_FIELDS[field]

    op_raw = raw.get("operator")
    operator = LEGACY_OPERATORS.get(str(op_raw), str(op_raw)) if op_raw is not None else None
    if operator not in OPERATORS:
        errors.append(_err(f"{path}.operator", f"Unknown operator '{op_raw}'."))
        return {}
    if operator not in spec["operators"]:
        allowed = ", ".join(OPERATORS[o]["label"] for o in spec["operators"])
        errors.append(_err(
            f"{path}.operator",
            f"'{spec['label']}' does not support '{OPERATORS[operator]['label']}'. Allowed: {allowed}.",
        ))
        return {}

    value = raw.get("value")
    ftype = spec["type"]

    try:
        if operator in ("is_true", "is_false"):
            normalized: Any = operator == "is_true"
        elif operator == "between":
            if not isinstance(value, (list, tuple)) or len(value) != 2:
                raise ValueError("needs exactly two numbers, e.g. [100, 500]")
            low = _coerce_number(value[0])
            high = _coerce_number(value[1])
            if low > high:
                low, high = high, low
            normalized = [_pretty_number(low), _pretty_number(high)]
        elif operator == "in":
            if isinstance(value, str):
                value = [v.strip() for v in value.split(",")]
            if not isinstance(value, (list, tuple)) or not value:
                raise ValueError("needs a list of values")
            if len(value) > 50:
                raise ValueError("supports at most 50 values")
            items = [str(v).strip() for v in value if str(v).strip()]
            if not items:
                raise ValueError("needs at least one non-empty value")
            normalized = items if ftype == ENUM else [str(v) for v in value]
        elif ftype == NUMBER:
            normalized = _pretty_number(_coerce_number(value))
        elif ftype == BOOLEAN:
            if not isinstance(value, bool):
                raise ValueError("expected true or false")
            normalized = value
        else:  # TEXT / ENUM
            if value is None or (isinstance(value, str) and not value.strip()):
                raise ValueError("value is empty")
            if isinstance(value, (list, tuple, dict, bool)):
                raise ValueError("expected text")
            normalized = str(value).strip()
    except (ValueError, TypeError) as exc:
        friendly = str(exc) or "invalid value"
        if ftype == NUMBER and not isinstance(value, (list, tuple)):
            friendly = "expected a number" if friendly == "invalid value" else friendly
        errors.append(_err(f"{path}.value", f"Invalid value: {friendly}."))
        return {}

    return {"field": field, "operator": operator, "value": normalized}


def validate_rules(rules: Any) -> Dict[str, Any]:
    """Validate + normalize a rules payload. Raises RuleValidationError on problems."""
    errors: List[Dict[str, str]] = []

    if not isinstance(rules, dict):
        raise RuleValidationError([_err("rules", "Audience rules must be an object.")])

    operator = str(rules.get("operator", "AND")).upper()
    if operator not in ("AND", "OR"):
        errors.append(_err("operator", "Joiner must be 'AND' or 'OR'."))

    conditions = rules.get("conditions")
    if not isinstance(conditions, list) or not conditions:
        errors.append(_err("conditions", "Add at least one condition."))
        conditions = []
    elif len(conditions) > MAX_CONDITIONS:
        errors.append(_err("conditions", f"Maximum {MAX_CONDITIONS} conditions allowed."))

    normalized: List[Dict[str, Any]] = []
    for idx, raw in enumerate(conditions):
        item = _normalize_condition(idx, raw, errors)
        if item:
            normalized.append(item)

    if errors:
        raise RuleValidationError(errors)

    return {"version": 2, "operator": operator, "conditions": normalized}


# ---------------------------------------------------------------------------
# Human readable summary
# ---------------------------------------------------------------------------

def _format_value(condition: Dict[str, Any]) -> str:
    value = condition.get("value")
    operator = condition.get("operator")
    if operator == "between":
        return f"{value[0]} and {value[1]}"
    if operator == "in":
        return ", ".join(str(v) for v in value)
    if operator == "is_true":
        return "enabled"
    if operator == "is_false":
        return "disabled"
    return str(value)


def describe_rules(rules: Any) -> Dict[str, Any] | str:
    """One-line human summary, e.g. 'Visits >= 3 AND Tier equals GOLD'."""
    if not rules or not isinstance(rules, dict):
        return "All Customers"
    conditions = rules.get("conditions") or []
    if not conditions:
        return "All Customers"

    parts: List[str] = []
    for c in conditions:
        field = LEGACY_FIELDS.get(c.get("field", ""), c.get("field", ""))
        spec = RULE_FIELDS.get(field)
        if not spec:
            continue
        operator = LEGACY_OPERATORS.get(c.get("operator", ""), c.get("operator", ""))
        symbol = OPERATORS.get(operator, {}).get("symbol", operator)
        parts.append(f"{spec['short_label']} {symbol} {_format_value({'value': c.get('value'), 'operator': operator})}")

    if not parts:
        return "All Customers"

    joiner = f" {str(rules.get('operator', 'AND')).upper()} "
    summary = joiner.join(parts)
    if len(summary) > 90:
        summary = summary[:87] + "..."
    return summary


# ---------------------------------------------------------------------------
# Payload for `GET /segments/fields`
# ---------------------------------------------------------------------------

def fields_payload() -> Dict[str, Any]:
    fields = []
    for key in FIELD_ORDER:
        spec = RULE_FIELDS[key]
        fields.append({
            "key": key,
            "label": spec["label"],
            "short_label": spec["short_label"],
            "group": spec["group"],
            "type": spec["type"],
            "operators": spec["operators"],
            "options": spec.get("options"),
            "placeholder": spec.get("placeholder"),
            "help": spec.get("help"),
        })
    return {
        "fields": fields,
        "groups": GROUP_ORDER,
        "operators": {k: {"label": v["label"], "symbol": v["symbol"]} for k, v in OPERATORS.items()},
        "max_conditions": MAX_CONDITIONS,
    }
