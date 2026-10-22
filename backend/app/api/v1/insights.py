from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timezone, timedelta
from typing import Dict, Any, Optional

from dateutil.relativedelta import relativedelta

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, Customer, CustomerLoyaltyAccount, Campaign, LoyaltyTransaction, Wallet
from app.schemas.schemas import DashboardMetricsOut
from app.services.insights_service import InsightsService
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/insights", tags=["Insights & Analytics"])

PERIOD_DAYS = {"WEEK": 7, "MONTH": 30, "YEAR": 365}


def _pct_delta(current: float, previous: float):
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


@router.get("/dashboard", response_model=DashboardMetricsOut)
def get_dashboard_metrics(
    period: str = "Week",
    start_date: Optional[date] = Query(None, description="Inclusive range start (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Inclusive range end (YYYY-MM-DD)"),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    # Naive UTC — matches how SQLite stores/returns DateTime values
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Explicit calendar range (from the date-range picker) takes precedence
    if start_date is not None and end_date is not None:
        if start_date > end_date:
            start_date, end_date = end_date, start_date
        range_start = datetime(start_date.year, start_date.month, start_date.day)
        range_end = datetime(end_date.year, end_date.month, end_date.day) + timedelta(days=1)
    else:
        period_key = period.upper()
        if period_key not in PERIOD_DAYS:
            period_key = "WEEK"
        period_days = PERIOD_DAYS[period_key]
        # Calendar-aligned: last N full days including today
        range_start = (now - timedelta(days=period_days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        range_end = now

    # Previous window: equally long, immediately before the selected range
    span = range_end - range_start
    prev_start = range_start - span
    prev_end = range_start

    # KPI totals within the selected range
    total_customers = db.query(Customer).filter(
        Customer.tenant_id == tenant.id,
        Customer.created_at >= range_start,
        Customer.created_at < range_end
    ).count()
    prev_customers = db.query(Customer).filter(
        Customer.tenant_id == tenant.id,
        Customer.created_at >= prev_start,
        Customer.created_at < prev_end
    ).count()

    loyalty_members = db.query(CustomerLoyaltyAccount).filter(
        CustomerLoyaltyAccount.tenant_id == tenant.id,
        CustomerLoyaltyAccount.created_at >= range_start,
        CustomerLoyaltyAccount.created_at < range_end
    ).count()
    prev_members = db.query(CustomerLoyaltyAccount).filter(
        CustomerLoyaltyAccount.tenant_id == tenant.id,
        CustomerLoyaltyAccount.created_at >= prev_start,
        CustomerLoyaltyAccount.created_at < prev_end
    ).count()

    points_issued = db.query(func.sum(LoyaltyTransaction.points)).filter(
        LoyaltyTransaction.tenant_id == tenant.id,
        LoyaltyTransaction.created_at >= range_start,
        LoyaltyTransaction.created_at < range_end,
        LoyaltyTransaction.points > 0
    ).scalar() or 0
    prev_points_issued = db.query(func.sum(LoyaltyTransaction.points)).filter(
        LoyaltyTransaction.tenant_id == tenant.id,
        LoyaltyTransaction.created_at >= prev_start,
        LoyaltyTransaction.created_at < prev_end,
        LoyaltyTransaction.points > 0
    ).scalar() or 0

    points_redeemed = db.query(func.sum(-LoyaltyTransaction.points)).filter(
        LoyaltyTransaction.tenant_id == tenant.id,
        LoyaltyTransaction.created_at >= range_start,
        LoyaltyTransaction.created_at < range_end,
        LoyaltyTransaction.points < 0
    ).scalar() or 0
    prev_points_redeemed = db.query(func.sum(-LoyaltyTransaction.points)).filter(
        LoyaltyTransaction.tenant_id == tenant.id,
        LoyaltyTransaction.created_at >= prev_start,
        LoyaltyTransaction.created_at < prev_end,
        LoyaltyTransaction.points < 0
    ).scalar() or 0

    campaign_rev = db.query(func.sum(Campaign.attributed_revenue)).filter(
        Campaign.tenant_id == tenant.id,
        Campaign.created_at >= range_start,
        Campaign.created_at < range_end
    ).scalar() or 0.0
    prev_campaign_rev = db.query(func.sum(Campaign.attributed_revenue)).filter(
        Campaign.tenant_id == tenant.id,
        Campaign.created_at >= prev_start,
        Campaign.created_at < prev_end
    ).scalar() or 0.0

    # Real period-over-period deltas (vs the equally-long previous window)
    deltas = {
        "total_customers": _pct_delta(total_customers, prev_customers),
        "loyalty_members": _pct_delta(loyalty_members, prev_members),
        "points_issued": _pct_delta(points_issued, prev_points_issued),
        "points_redeemed": _pct_delta(points_redeemed, prev_points_redeemed),
        "campaign_revenue": _pct_delta(campaign_rev, prev_campaign_rev),
    }

    # Wallet is a current snapshot, not period-filtered
    wallet = WalletService.get_or_create_wallet(db, tenant.id, tenant.currency)
    wallet_available = WalletService.get_available_balance(wallet)

    insights = InsightsService.generate_insights(db, tenant.id)

    recent_txns = db.query(LoyaltyTransaction).filter(
        LoyaltyTransaction.tenant_id == tenant.id,
        LoyaltyTransaction.created_at >= range_start,
        LoyaltyTransaction.created_at < range_end
    ).order_by(LoyaltyTransaction.created_at.desc()).limit(10).all()

    formatted_txns = []
    for t in recent_txns:
        c = db.query(Customer).filter(Customer.id == t.customer_id).first()
        formatted_txns.append({
            "id": t.id,
            "customer_name": f"{c.first_name or ''} {c.last_name or ''}".strip() or c.phone if c else "Customer",
            "phone": c.phone if c else "",
            "type": t.type,
            "points": t.points,
            "description": t.description,
            "created_at": t.created_at
        })

    # Real chart data bucketed adaptively by the selected range length:
    #   ≤ 1 day  → 4-hour blocks (6 bars)
    #   ≤ 14 days → daily bars
    #   ≤ 92 days → ~weekly bars (7-day blocks)
    #   else      → calendar-month bars
    txn_rows = db.query(
        LoyaltyTransaction.created_at, LoyaltyTransaction.points
    ).filter(
        LoyaltyTransaction.tenant_id == tenant.id,
        LoyaltyTransaction.created_at >= range_start,
        LoyaltyTransaction.created_at < range_end
    ).all()
    new_cust_rows = db.query(Customer.created_at).filter(
        Customer.tenant_id == tenant.id,
        Customer.created_at >= range_start,
        Customer.created_at < range_end
    ).all()
    rev_rows = db.query(
        Campaign.created_at, Campaign.attributed_revenue
    ).filter(
        Campaign.tenant_id == tenant.id,
        Campaign.created_at >= range_start,
        Campaign.created_at < range_end
    ).all()

    def _bucket(start, end, label):
        return {
            "date": label,
            "customers": sum(1 for (ca,) in new_cust_rows if start <= ca < end),
            "points_issued": sum(p for (ca, p) in txn_rows if start <= ca < end and p > 0),
            "revenue": round(sum(r or 0 for (ca, r) in rev_rows if start <= ca < end), 2),
        }

    range_days = max(span.total_seconds() / 86400.0, 0.0)
    chart_data = []
    if range_days <= 1.5:
        # Single day (or overnight edge) → 4-hour blocks
        day_start = range_start.replace(hour=0, minute=0, second=0, microsecond=0)
        for h in range(0, 24, 4):
            start = day_start + timedelta(hours=h)
            end = start + timedelta(hours=4)
            # Portable 12-hour label (Windows strftime lacks %-I)
            hour12 = ((h - 1) % 12) + 1
            ampm = "am" if h < 12 else "pm"
            chart_data.append(_bucket(max(start, range_start), min(end, range_end), f"{hour12}{ampm}"))
    elif range_days <= 14.5:
        # Up to ~2 weeks → one bar per day
        d = range_start.replace(hour=0, minute=0, second=0, microsecond=0)
        while d < range_end:
            start = max(d, range_start)
            end = min(d + timedelta(days=1), range_end)
            chart_data.append(_bucket(start, end, d.strftime("%b %d")))
            d += timedelta(days=1)
    elif range_days <= 92.5:
        # Up to ~3 months → 7-day blocks
        d = range_start
        while d < range_end:
            end = min(d + timedelta(days=7), range_end)
            chart_data.append(_bucket(d, end, d.strftime("%b %d")))
            d = end
    else:
        # Longer ranges → calendar-month buckets
        month_start = range_start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        while month_start < range_end:
            start = max(month_start, range_start)
            end = min(month_start + relativedelta(months=1), range_end)
            label = month_start.strftime("%b %y") if range_days > 400 else month_start.strftime("%b")
            chart_data.append(_bucket(start, end, label))
            month_start += relativedelta(months=1)

    return {
        "total_customers": total_customers,
        "loyalty_members": loyalty_members,
        "points_issued": int(points_issued),
        "points_redeemed": int(points_redeemed),
        "campaign_revenue": round(campaign_rev, 2),
        "wallet_balance": wallet.balance,
        "wallet_available": wallet_available,
        "recent_transactions": formatted_txns,
        "insights": insights,
        "chart_data": chart_data,
        "deltas": deltas,
        "range": {
            "start": range_start.date().isoformat(),
            "end": (range_end - timedelta(seconds=1)).date().isoformat(),
            "days": round(range_days, 1),
        }
    }
