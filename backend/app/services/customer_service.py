import re
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.models.models import Customer, CustomerLoyaltyAccount, LoyaltyProgram, LoyaltyTransaction

class CustomerService:
    @staticmethod
    def normalize_phone(phone: str) -> str:
        # Strip all non-numeric characters except leading plus
        cleaned = re.sub(r"[^\d+]", "", phone.strip())
        if cleaned.startswith("+"):
            return cleaned
        # Default Indian number prefix if 10 digits
        if len(cleaned) == 10:
            return "+91" + cleaned
        if len(cleaned) == 12 and cleaned.startswith("91"):
            return "+" + cleaned
        return "+" + cleaned

    @staticmethod
    def get_customers(
        db: Session,
        tenant_id: str,
        search: Optional[str] = None,
        tier: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        query = db.query(Customer).filter(Customer.tenant_id == tenant_id)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Customer.first_name.ilike(search_term)) |
                (Customer.last_name.ilike(search_term)) |
                (Customer.phone.ilike(search_term)) |
                (Customer.email.ilike(search_term))
            )
        customers = query.order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()
        return customers

    @staticmethod
    def create_customer(
        db: Session,
        tenant_id: str,
        phone: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        email: Optional[str] = None,
        gender: Optional[str] = None,
        date_of_birth: Optional[str] = None,
        anniversary_date: Optional[str] = None,
        city: Optional[str] = None,
        source: str = "MANUAL",
        marketing_consent: bool = True,
        whatsapp_consent: bool = True
    ) -> Customer:
        normalized = CustomerService.normalize_phone(phone)
        existing = db.query(Customer).filter(
            Customer.tenant_id == tenant_id,
            Customer.phone_normalized == normalized
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail=f"Customer with phone {phone} already exists")

        customer = Customer(
            tenant_id=tenant_id,
            phone=phone,
            phone_normalized=normalized,
            first_name=first_name,
            last_name=last_name,
            email=email,
            gender=gender,
            date_of_birth=date_of_birth,
            anniversary_date=anniversary_date,
            city=city,
            source=source,
            marketing_consent=marketing_consent,
            whatsapp_consent=whatsapp_consent,
            visits_count=1,
            lifetime_spend=0.0,
            last_visit_at=datetime.now(timezone.utc)
        )
        db.add(customer)
        db.flush()

        # Initialize loyalty account with welcome bonus
        program = db.query(LoyaltyProgram).filter(LoyaltyProgram.tenant_id == tenant_id).first()
        welcome_points = program.welcome_bonus_points if program else 100

        loyalty_acc = CustomerLoyaltyAccount(
            tenant_id=tenant_id,
            customer_id=customer.id,
            points_balance=welcome_points,
            lifetime_earned=welcome_points,
            lifetime_redeemed=0,
            current_tier="BRONZE"
        )
        db.add(loyalty_acc)

        if welcome_points > 0:
            txn = LoyaltyTransaction(
                tenant_id=tenant_id,
                customer_id=customer.id,
                type="BONUS",
                points=welcome_points,
                balance_before=0,
                balance_after=welcome_points,
                reference_type="WELCOME_BONUS",
                description="Welcome bonus points upon enrollment"
            )
            db.add(txn)

        db.commit()
        db.refresh(customer)
        return customer

    @staticmethod
    def bulk_import(
        db: Session,
        tenant_id: str,
        rows: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Processes parsed tabular data with validation & duplicate resolution
        """
        imported = 0
        updated = 0
        skipped = 0
        invalid = 0
        errors = []

        program = db.query(LoyaltyProgram).filter(LoyaltyProgram.tenant_id == tenant_id).first()
        welcome_points = program.welcome_bonus_points if program else 100

        for idx, row in enumerate(rows):
            raw_phone = str(row.get("phone") or row.get("mobile") or row.get("Phone") or row.get("Mobile") or "").strip()
            if not raw_phone or len(raw_phone) < 8:
                invalid += 1
                errors.append(f"Row {idx+1}: Missing or invalid phone number")
                continue

            try:
                norm_phone = CustomerService.normalize_phone(raw_phone)
            except Exception:
                invalid += 1
                errors.append(f"Row {idx+1}: Unable to normalize phone {raw_phone}")
                continue

            existing = db.query(Customer).filter(
                Customer.tenant_id == tenant_id,
                Customer.phone_normalized == norm_phone
            ).first()

            first_name = row.get("first_name") or row.get("name") or row.get("Name")
            email = row.get("email") or row.get("Email")
            city = row.get("city") or row.get("City")
            spend = float(row.get("spend") or row.get("lifetime_spend") or 0.0)
            visits = int(row.get("visits") or row.get("visits_count") or 1)

            if existing:
                if first_name: existing.first_name = first_name
                if email: existing.email = email
                if city: existing.city = city
                existing.lifetime_spend += spend
                existing.visits_count += visits
                updated += 1
            else:
                customer = Customer(
                    tenant_id=tenant_id,
                    phone=raw_phone,
                    phone_normalized=norm_phone,
                    first_name=first_name,
                    email=email,
                    city=city,
                    source="EXCEL_IMPORT",
                    visits_count=visits,
                    lifetime_spend=spend,
                    last_visit_at=datetime.now(timezone.utc)
                )
                db.add(customer)
                db.flush()

                loyalty_acc = CustomerLoyaltyAccount(
                    tenant_id=tenant_id,
                    customer_id=customer.id,
                    points_balance=welcome_points,
                    lifetime_earned=welcome_points,
                    lifetime_redeemed=0,
                    current_tier="BRONZE"
                )
                db.add(loyalty_acc)
                imported += 1

        db.commit()
        return {
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "invalid": invalid,
            "errors": errors[:10]
        }
