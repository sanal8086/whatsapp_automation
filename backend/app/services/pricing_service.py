from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime, timezone
from app.models.models import MessagePricing
from app.core.config import settings

class PricingService:
    @staticmethod
    def seed_default_pricing_if_empty(db: Session):
        count = db.query(MessagePricing).count()
        if count > 0:
            return

        defaults = [
            {"country": "India", "category": "MARKETING", "currency": "INR", "meta_cost": 0.72, "markup_margin": 0.06, "total_price": 0.78},
            {"country": "India", "category": "UTILITY", "currency": "INR", "meta_cost": 0.30, "markup_margin": 0.05, "total_price": 0.35},
            {"country": "India", "category": "AUTHENTICATION", "currency": "INR", "meta_cost": 0.26, "markup_margin": 0.04, "total_price": 0.30},
            {"country": "India", "category": "SERVICE", "currency": "INR", "meta_cost": 0.20, "markup_margin": 0.05, "total_price": 0.25},
            {"country": "*", "category": "MARKETING", "currency": "USD", "meta_cost": 0.045, "markup_margin": 0.015, "total_price": 0.06},
            {"country": "*", "category": "UTILITY", "currency": "USD", "meta_cost": 0.020, "markup_margin": 0.005, "total_price": 0.025},
            {"country": "*", "category": "AUTHENTICATION", "currency": "USD", "meta_cost": 0.018, "markup_margin": 0.004, "total_price": 0.022},
            {"country": "*", "category": "SERVICE", "currency": "USD", "meta_cost": 0.015, "markup_margin": 0.005, "total_price": 0.020},
        ]
        for d in defaults:
            p = MessagePricing(
                country=d["country"],
                category=d["category"],
                currency=d["currency"],
                meta_cost=d["meta_cost"],
                markup_margin=d["markup_margin"],
                total_price=d["total_price"],
                effective_from=datetime.now(timezone.utc)
            )
            db.add(p)
        db.commit()

    @staticmethod
    def get_price(db: Session, country: str = "India", category: str = "MARKETING") -> float:
        """Determines price per message using country and message category rules"""
        PricingService.seed_default_pricing_if_empty(db)
        pricing = db.query(MessagePricing).filter(
            MessagePricing.country == country,
            MessagePricing.category == category.upper()
        ).first()

        if not pricing:
            # Fallback to wildcard country
            pricing = db.query(MessagePricing).filter(
                MessagePricing.country == "*",
                MessagePricing.category == category.upper()
            ).first()

        if pricing:
            return pricing.total_price

        # Fallback to config settings
        if category.upper() == "UTILITY":
            return settings.DEFAULT_MESSAGE_PRICE_UTILITY
        elif category.upper() == "AUTHENTICATION":
            return settings.DEFAULT_MESSAGE_PRICE_AUTHENTICATION
        return settings.DEFAULT_MESSAGE_PRICE_MARKETING

    @staticmethod
    def list_pricing_rules(db: Session) -> List[MessagePricing]:
        PricingService.seed_default_pricing_if_empty(db)
        return db.query(MessagePricing).all()
