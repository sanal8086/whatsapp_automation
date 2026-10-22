from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from app.models.models import (
    Campaign, CampaignRecipient, WhatsAppTemplate, Customer,
    WhatsAppConnection, WhatsAppMessage, Tenant, Segment
)
from app.services.wallet_service import WalletService
from app.services.segment_service import SegmentService
from app.services.rule_registry import validate_rules
from app.services.pricing_service import PricingService
from app.services.audit_service import AuditService
from app.integrations.meta.provider import get_whatsapp_provider
from app.core.config import settings

class CampaignService:
    @staticmethod
    def estimate_campaign(
        db: Session,
        tenant_id: str,
        segment_id: Optional[str] = None,
        rules_json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        # Raises RuleValidationError (-> 422) for malformed ad-hoc rules.
        if segment_id:
            customers = SegmentService.get_segment_customers(db, tenant_id, segment_id)
        elif rules_json:
            customers = SegmentService.filter_customers(db, tenant_id, rules_json)
        else:
            customers = SegmentService.get_segment_customers(db, tenant_id, None)
        matched_count = len(customers)
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
            "matched_count": matched_count,
            "excluded_no_consent": matched_count - recipients_count,
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
        variables_mapping: Optional[Dict[str, Any]] = None,
        rules_json: Optional[Dict[str, Any]] = None,
        image_url: Optional[str] = None
    ) -> Campaign:
        # Ad-hoc audience rule: persist it as a segment so dispatch & history resolve correctly
        if rules_json and not segment_id:
            validated = validate_rules(rules_json)
            segment = Segment(
                tenant_id=tenant_id,
                name=f"Custom: {SegmentService.describe_rules(validated)}",
                description=f"Audience rule for campaign '{name}'",
                rules_json=validated,
                source="AUTO",
            )
            db.add(segment)
            db.flush()
            segment_id = segment.id

        campaign = Campaign(
            tenant_id=tenant_id,
            name=name,
            segment_id=segment_id,
            template_id=template_id,
            scheduled_at=scheduled_at,
            variables_mapping_json=variables_mapping or {},
            image_url=image_url,
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
        print(f"[OFFER_RUN] CampaignService.execute_campaign called: tenant={tenant_id}, campaign={campaign_id}", flush=True)
        execute_campaign_batch(tenant_id, campaign_id)
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id).first()
        print(f"[OFFER_RUN] execute_campaign finished: campaign={campaign_id}, status={campaign.status if campaign else 'NOT FOUND'}, sent={campaign.sent_count if campaign else '-'}, delivered={campaign.delivered_count if campaign else '-'}, failed={campaign.failed_count if campaign else '-'}", flush=True)
        return campaign
