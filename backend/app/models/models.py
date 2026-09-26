from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON, Enum, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

# ----------------- User & Tenant -----------------

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    is_platform_admin = Column(Boolean, default=False)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    memberships = relationship("TenantMember", back_populates="user", cascade="all, delete-orphan")


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    business_type = Column(String(100), default="Restaurant")
    country = Column(String(50), default="India")
    timezone = Column(String(50), default="Asia/Kolkata")
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="ACTIVE")  # ACTIVE, SUSPENDED, PENDING
    subscription_status = Column(String(50), default="TRIAL")  # TRIAL, ACTIVE, PAST_DUE, SUSPENDED, EXPIRED
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    members = relationship("TenantMember", back_populates="tenant", cascade="all, delete-orphan")
    wallet = relationship("Wallet", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    whatsapp_connection = relationship("WhatsAppConnection", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    loyalty_program = relationship("LoyaltyProgram", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    public_page = relationship("PublicPage", back_populates="tenant", uselist=False, cascade="all, delete-orphan")


class TenantMember(Base):
    __tablename__ = "tenant_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="OWNER")  # OWNER, ADMIN, MANAGER, STAFF, VIEWER
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)

    tenant = relationship("Tenant", back_populates="members")
    user = relationship("User", back_populates="memberships")

    __table_args__ = (UniqueConstraint('tenant_id', 'user_id', name='_tenant_user_uc'),)


# ----------------- Subscription & Billing -----------------

class Plan(Base):
    __tablename__ = "plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    price = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    max_customers = Column(Integer, default=5000)
    features_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    plan_id = Column(String(36), ForeignKey("plans.id"), nullable=True)
    status = Column(String(50), default="TRIAL")  # TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED
    starts_at = Column(DateTime, default=utc_now)
    ends_at = Column(DateTime, nullable=True)
    payment_status = Column(String(50), default="PENDING")  # PENDING, PAID, MANUAL_VERIFIED, FAILED
    amount = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    tenant = relationship("Tenant", back_populates="subscription")
    plan = relationship("Plan")


# ----------------- WhatsApp Wallet & Transactions -----------------

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    currency = Column(String(10), default="INR")
    balance = Column(Float, default=0.0)
    reserved_balance = Column(Float, default=0.0)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    tenant = relationship("Tenant", back_populates="wallet")
    transactions = relationship("WalletTransaction", back_populates="wallet", cascade="all, delete-orphan", order_by="desc(WalletTransaction.created_at)")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    wallet_id = Column(String(36), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # CREDIT, DEBIT, REFUND, ADJUSTMENT, RESERVATION, RELEASE
    amount = Column(Float, nullable=False)
    balance_before = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    reference_type = Column(String(100), nullable=True)  # CAMPAIGN, MANUAL_ADMIN, AUTOMATION
    reference_id = Column(String(100), nullable=True)
    description = Column(String(255), nullable=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    wallet = relationship("Wallet", back_populates="transactions")


# ----------------- WhatsApp Connection & Templates -----------------

class WhatsAppConnection(Base):
    __tablename__ = "whatsapp_connections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    meta_business_id = Column(String(100), nullable=True)
    waba_id = Column(String(100), nullable=True)
    phone_number_id = Column(String(100), nullable=True)
    display_phone_number = Column(String(50), nullable=True)
    verified_name = Column(String(255), nullable=True)
    connection_status = Column(String(50), default="DISCONNECTED")  # DISCONNECTED, PENDING, CONNECTED, ERROR
    business_verification_status = Column(String(50), default="VERIFIED")
    phone_verification_status = Column(String(50), default="VERIFIED")
    access_token_encrypted = Column(Text, nullable=True)
    is_live_mode = Column(Boolean, default=False)
    quality_rating = Column(String(50), default="GREEN")
    connected_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    tenant = relationship("Tenant", back_populates="whatsapp_connection")


class PlatformTemplate(Base):
    __tablename__ = "platform_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    key = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(50), default="LOYALTY")  # LOYALTY, CRM, CAMPAIGNS
    language = Column(String(10), default="en")
    header_text = Column(String(255), nullable=True)
    body_text = Column(Text, nullable=False)
    footer_text = Column(String(255), nullable=True)
    buttons_json = Column(JSON, default=list)
    variables_json = Column(JSON, default=list)  # ["name", "points", "business_name"]
    created_at = Column(DateTime, default=utc_now)


class WhatsAppTemplate(Base):
    __tablename__ = "whatsapp_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    waba_id = Column(String(100), nullable=True)
    platform_template_id = Column(String(36), ForeignKey("platform_templates.id"), nullable=True)
    meta_template_id = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), default="MARKETING")
    language = Column(String(10), default="en")
    status = Column(String(50), default="APPROVED")  # APPROVED, PENDING, REJECTED
    header_text = Column(String(255), nullable=True)
    body_text = Column(Text, nullable=False)
    footer_text = Column(String(255), nullable=True)
    buttons_json = Column(JSON, default=list)
    rejection_reason = Column(Text, nullable=True)
    last_synced_at = Column(DateTime, default=utc_now)
    created_at = Column(DateTime, default=utc_now)

    platform_template = relationship("PlatformTemplate")


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    template_id = Column(String(36), ForeignKey("whatsapp_templates.id", ondelete="SET NULL"), nullable=True)
    provider_message_id = Column(String(100), unique=True, index=True, nullable=True)
    direction = Column(String(20), default="OUTBOUND")
    message_type = Column(String(50), default="TEMPLATE")
    recipient_phone = Column(String(50), nullable=False)
    status = Column(String(50), default="QUEUED")  # QUEUED, SENDING, SENT, DELIVERED, READ, FAILED
    cost = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    failure_code = Column(String(50), nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(50), default="META")
    event_type = Column(String(100), nullable=False)
    external_event_id = Column(String(255), unique=True, index=True, nullable=True)
    payload_json = Column(JSON, nullable=False)
    processing_status = Column(String(50), default="PROCESSED")  # PENDING, PROCESSED, FAILED
    error = Column(Text, nullable=True)
    received_at = Column(DateTime, default=utc_now)
    processed_at = Column(DateTime, default=utc_now)


# ----------------- Customers & Segments -----------------

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    phone = Column(String(50), nullable=False)
    phone_normalized = Column(String(50), nullable=False, index=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    gender = Column(String(20), nullable=True)
    date_of_birth = Column(String(20), nullable=True)  # YYYY-MM-DD
    anniversary_date = Column(String(20), nullable=True)
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(50), default="India")
    source = Column(String(100), default="MANUAL")  # EXCEL, PUBLIC_PAGE, MANUAL, POS
    marketing_consent = Column(Boolean, default=True)
    whatsapp_consent = Column(Boolean, default=True)
    visits_count = Column(Integer, default=0)
    lifetime_spend = Column(Float, default=0.0)
    last_visit_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    loyalty_account = relationship("CustomerLoyaltyAccount", back_populates="customer", uselist=False, cascade="all, delete-orphan")
    loyalty_transactions = relationship("LoyaltyTransaction", back_populates="customer", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint('tenant_id', 'phone_normalized', name='_tenant_phone_uc'),)


class Segment(Base):
    __tablename__ = "segments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rules_json = Column(JSON, nullable=False)  # {"operator": "AND", "conditions": [...]}
    cached_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# ----------------- Loyalty Program, Rules & Rewards -----------------

class LoyaltyProgram(Base):
    __tablename__ = "loyalty_programs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    name = Column(String(255), default="VIP Rewards")
    points_currency_name = Column(String(50), default="Points")
    earn_type = Column(String(50), default="SPEND_BASED")  # SPEND_BASED, VISIT_BASED, FLAT
    earn_rate = Column(Float, default=1.0)  # e.g. 1 point per 10 INR spent, or 10 points per visit
    earn_spend_unit = Column(Float, default=10.0)  # spent 10 currency = earn_rate points
    points_expiry_days = Column(Integer, default=365)
    welcome_bonus_points = Column(Integer, default=100)
    birthday_bonus_points = Column(Integer, default=200)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    tenant = relationship("Tenant", back_populates="loyalty_program")


class CustomerLoyaltyAccount(Base):
    __tablename__ = "customer_loyalty_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    points_balance = Column(Integer, default=0)
    lifetime_earned = Column(Integer, default=0)
    lifetime_redeemed = Column(Integer, default=0)
    current_tier = Column(String(50), default="BRONZE")  # BRONZE, SILVER, GOLD, PLATINUM
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    customer = relationship("Customer", back_populates="loyalty_account")


class LoyaltyReward(Base):
    __tablename__ = "loyalty_rewards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    points_required = Column(Integer, nullable=False)
    cash_value = Column(Float, default=0.0)
    terms = Column(Text, nullable=True)
    stock = Column(Integer, default=-1)  # -1 for unlimited
    expiry_days = Column(Integer, default=30)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # EARN, REDEEM, BONUS, ADJUSTMENT, EXPIRY, REFUND
    points = Column(Integer, nullable=False)
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    reference_type = Column(String(100), nullable=True)  # REWARD, VISIT, ORDER, CAMPAIGN
    reference_id = Column(String(100), nullable=True)
    description = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    customer = relationship("Customer", back_populates="loyalty_transactions")


# ----------------- Campaigns & Automations -----------------

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    segment_id = Column(String(36), ForeignKey("segments.id", ondelete="SET NULL"), nullable=True)
    template_id = Column(String(36), ForeignKey("whatsapp_templates.id", ondelete="SET NULL"), nullable=True)
    channel = Column(String(50), default="WHATSAPP")
    status = Column(String(50), default="DRAFT")  # DRAFT, SCHEDULED, SENDING, COMPLETED, CANCELLED, FAILED
    scheduled_at = Column(DateTime, nullable=True)
    variables_mapping_json = Column(JSON, default=dict)
    recipients_count = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    read_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)
    attributed_revenue = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    segment = relationship("Segment")
    template = relationship("WhatsAppTemplate")
    recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="PENDING")  # PENDING, SENT, DELIVERED, READ, FAILED
    message_id = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    campaign = relationship("Campaign", back_populates="recipients")
    customer = relationship("Customer")


class Automation(Base):
    __tablename__ = "automations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    trigger_type = Column(String(50), nullable=False)  # WELCOME, BIRTHDAY, ANNIVERSARY, INACTIVITY, POINTS_EXPIRING, TIER_UPGRADE
    conditions_json = Column(JSON, default=dict)  # e.g. {"inactivity_days": 30, "min_visits": 2}
    template_id = Column(String(36), ForeignKey("whatsapp_templates.id", ondelete="SET NULL"), nullable=True)
    delay_minutes = Column(Integer, default=0)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, PAUSED
    total_triggered = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    template = relationship("WhatsAppTemplate")


# ----------------- Branded Public Loyalty Page -----------------

class PublicPage(Base):
    __tablename__ = "public_pages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    business_name = Column(String(255), nullable=False)
    hero_title = Column(String(255), default="Welcome to VIP Rewards")
    hero_description = Column(Text, default="Earn points on every visit and unlock exclusive rewards!")
    logo_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    primary_color = Column(String(20), default="#4F46E5")  # Indigo/Purple vibrant
    secondary_color = Column(String(20), default="#06B6D4")  # Cyan vibrant
    terms_text = Column(Text, default="Points cannot be exchanged for cash. Standard terms apply.")
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(255), nullable=True)
    social_links_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    tenant = relationship("Tenant", back_populates="public_page")


# ----------------- Daily Metrics & Audit Logs -----------------

class DailyTenantMetric(Base):
    __tablename__ = "daily_tenant_metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    new_customers = Column(Integer, default=0)
    active_customers = Column(Integer, default=0)
    loyalty_members = Column(Integer, default=0)
    points_issued = Column(Integer, default=0)
    points_redeemed = Column(Integer, default=0)
    rewards_redeemed = Column(Integer, default=0)
    messages_sent = Column(Integer, default=0)
    messages_delivered = Column(Integer, default=0)
    messages_failed = Column(Integer, default=0)
    campaigns_sent = Column(Integer, default=0)
    campaign_revenue = Column(Float, default=0.0)

    __table_args__ = (UniqueConstraint('tenant_id', 'date', name='_tenant_date_uc'),)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=True, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    details_json = Column(JSON, default=dict)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now)


# ----------------- Dynamic Message Pricing & Consents -----------------

class MessagePricing(Base):
    __tablename__ = "message_pricing"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    country = Column(String(50), default="India", index=True)
    category = Column(String(50), default="MARKETING", index=True)  # MARKETING, UTILITY, AUTHENTICATION, SERVICE
    currency = Column(String(10), default="INR")
    meta_cost = Column(Float, default=0.72)
    markup_margin = Column(Float, default=0.06)
    total_price = Column(Float, default=0.78)
    effective_from = Column(DateTime, default=utc_now)


class CustomerConsent(Base):
    __tablename__ = "customer_consents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(20), default="WHATSAPP")  # WHATSAPP, SMS, EMAIL
    consent_type = Column(String(50), default="MARKETING")  # MARKETING, TRANSACTIONAL
    status = Column(String(20), default="OPT_IN")  # OPT_IN, OPT_OUT
    source = Column(String(100), default="MANUAL")  # PUBLIC_PAGE, WHATSAPP_INBOUND, EXCEL_IMPORT, API
    proof_reference = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now)
