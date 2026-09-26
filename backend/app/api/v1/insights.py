from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_tenant
from app.models.models import Tenant, Customer, CustomerLoyaltyAccount, Campaign, LoyaltyTransaction, Wallet
from app.schemas.schemas import DashboardMetricsOut
from app.services.insights_service import InsightsService
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/insights", tags=["Insights & Analytics"])

@router.get("/dashboard", response_model=DashboardMetricsOut)
def get_dashboard_metrics(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    total_customers = db.query(Customer).filter(Customer.tenant_id == tenant.id).count()
    loyalty_members = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.tenant_id == tenant.id).count()

    # Points issued & redeemed
    points_issued = db.query(func.sum(CustomerLoyaltyAccount.lifetime_earned)).filter(
        CustomerLoyaltyAccount.tenant_id == tenant.id
    ).scalar() or 0

    points_redeemed = db.query(func.sum(CustomerLoyaltyAccount.lifetime_redeemed)).filter(
        CustomerLoyaltyAccount.tenant_id == tenant.id
    ).scalar() or 0

    # Campaign revenue
    campaign_rev = db.query(func.sum(Campaign.attributed_revenue)).filter(
        Campaign.tenant_id == tenant.id
    ).scalar() or 0.0

    # Wallet
    wallet = WalletService.get_or_create_wallet(db, tenant.id, tenant.currency)
    wallet_available = WalletService.get_available_balance(wallet)

    # Actionable insights
    insights = InsightsService.generate_insights(db, tenant.id)

    # Recent activity
    recent_txns = db.query(LoyaltyTransaction).filter(
        LoyaltyTransaction.tenant_id == tenant.id
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

    # Synthetic chart data for last 7 days
    chart_data = []
    today = datetime.now(timezone.utc).date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%b %d")
        chart_data.append({
            "date": day_str,
            "customers": max(12, int(total_customers * (0.8 + (6-i)*0.03))),
            "points_issued": int((points_issued / 14) * (0.7 + (i % 3)*0.2)),
            "revenue": round(float(campaign_rev / 7) * (0.8 + (i % 4)*0.15), 2)
        })

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
        "chart_data": chart_data
    }
