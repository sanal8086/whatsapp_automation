from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from app.models.models import (
    Campaign, CampaignRecipient, WhatsAppTemplate, Customer,
    WhatsAppConnection, WhatsAppMessage
)
from app.services.wallet_service import WalletService
from app.services.segment_service import SegmentService
from app.integrations.meta.provider import get_whatsapp_provider
from app.core.config import settings

class CampaignService:
    @staticmethod
    def estimate_campaign(
        db: Session,
        tenant_id: str,
        segment_id: Optional[str] = None
    ) -> Dict[str, Any]:
        customers = SegmentService.get_segment_customers(db, tenant_id, segment_id)
        # Filter for reachable customers with WhatsApp consent
        reachable = [c for c in customers if c.whatsapp_consent]
        recipients_count = len(reachable)
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        country = tenant.country if tenant else "India"
        rate = PricingService.get_price(db, country=country, category="MARKETING")
        estimated_cost = round(recipients_count * rate, 2)

        wallet = WalletService.get_or_create_wallet(db, tenant_id)
        available = WalletService.get_available_balance(wallet)

        return {
            "recipients_count": recipients_count,
            "estimated_cost": estimated_cost,
            "wallet_balance": wallet.balance,
            "wallet_available": available,
            "can_afford": available >= estimated_cost
        }

    @staticmethod
    def create_campaign(
        db: Session,
        tenant_id: str,
        name: str,
        segment_id: Optional[str] = None,
        template_id: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        variables_mapping: Optional[Dict[str, Any]] = None
    ) -> Campaign:
        campaign = Campaign(
            tenant_id=tenant_id,
            name=name,
            segment_id=segment_id,
            template_id=template_id,
            scheduled_at=scheduled_at,
            variables_mapping_json=variables_mapping or {},
            status="SCHEDULED" if scheduled_at else "DRAFT"
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)

        AuditService.log(
            db=db,
            action="CAMPAIGN_CREATED",
            tenant_id=tenant_id,
            resource_type="CAMPAIGN",
            resource_id=campaign.id,
            details={"name": name, "status": campaign.status}
        )
        return campaign

    @staticmethod
    def execute_campaign(db: Session, tenant_id: str, campaign_id: str) -> Campaign:
        from app.workers.campaign_dispatcher import execute_campaign_batch
        execute_campaign_batch(tenant_id, campaign_id)
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id).first()
        return campaign
