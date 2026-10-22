from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ---------------- Auth Schemas ----------------

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    business_name: str
    business_type: Optional[str] = "Retail / Restaurant"
    currency: Optional[str] = "INR"

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    current_tenant: Optional[Dict[str, Any]] = None

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    is_platform_admin: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# ---------------- Tenant Schemas ----------------

class TenantOut(BaseModel):
    id: str
    name: str
    slug: str
    business_type: str
    country: str
    timezone: str
    currency: str
    status: str
    subscription_status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None

class TenantMemberOut(BaseModel):
    id: str
    tenant_id: str
    user_id: str
    role: str
    status: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    created_at: datetime

# ---------------- Subscription & Plan Schemas ----------------

class PlanOut(BaseModel):
    id: str
    name: str
    code: str
    price: float
    currency: str
    max_customers: int
    features_json: Dict[str, Any]

    class Config:
        from_attributes = True

class SubscriptionOut(BaseModel):
    id: str
    tenant_id: str
    plan_id: Optional[str] = None
    plan_name: Optional[str] = None
    status: str
    payment_status: str
    amount: float
    currency: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class ManualPaymentRequest(BaseModel):
    tenant_id: str
    amount: float
    months: int = 1
    notes: Optional[str] = None

# ---------------- Wallet Schemas ----------------

class WalletOut(BaseModel):
    id: str
    tenant_id: str
    currency: str
    balance: float
    reserved_balance: float
    available_balance: float
    status: str

class WalletTransactionOut(BaseModel):
    id: str
    type: str
    amount: float
    balance_before: float
    balance_after: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AdminCreditRequest(BaseModel):
    tenant_id: str
    amount: float
    description: str

class AdminAdjustmentRequest(BaseModel):
    tenant_id: str
    amount: float
    type: str  # CREDIT or DEBIT
    description: str

# ---------------- WhatsApp Schemas ----------------

class WhatsAppConnectionOut(BaseModel):
    id: str
    tenant_id: str
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None
    connection_status: str
    business_verification_status: str
    phone_verification_status: str
    quality_rating: str
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    is_live_mode: bool = False
    connected_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ConnectWhatsAppRequest(BaseModel):
    display_phone_number: str
    verified_name: str
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    access_token: Optional[str] = None
    is_live_mode: bool = False

class EmbeddedSignupCallbackRequest(BaseModel):
    code: str
    waba_id: str
    phone_number_id: str
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None

class WhatsAppTemplateOut(BaseModel):
    id: str
    name: str
    category: str
    language: str
    status: str
    header_text: Optional[str] = None
    body_text: str
    footer_text: Optional[str] = None
    buttons_json: List[Any] = []
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True

class WhatsAppTemplateCreate(BaseModel):
    name: str
    category: str = "MARKETING"
    language: str = "en"
    header_text: Optional[str] = None
    body_text: str
    footer_text: Optional[str] = None
    buttons_json: List[Any] = []

class SendTestMessageRequest(BaseModel):
    phone: str
    template_id: Optional[str] = None
    custom_text: Optional[str] = None

class WhatsAppMessageOut(BaseModel):
    id: str
    recipient_phone: str
    message_type: str
    status: str
    cost: float
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ---------------- Customer Schemas ----------------

class CustomerCreate(BaseModel):
    phone: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    address: Optional[str] = None
    marketing_consent: bool = True
    whatsapp_consent: bool = True

class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    address: Optional[str] = None
    marketing_consent: Optional[bool] = None
    whatsapp_consent: Optional[bool] = None

class CustomerOut(BaseModel):
    id: str
    phone: str
    phone_normalized: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    address: Optional[str] = None
    source: str
    marketing_consent: bool
    whatsapp_consent: bool
    visits_count: int
    lifetime_spend: float
    last_visit_at: Optional[datetime] = None
    points_balance: Optional[int] = 0
    tier: Optional[str] = "BRONZE"
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerDetailOut(CustomerOut):
    loyalty_transactions: List[Any] = []

class CustomerListOut(BaseModel):
    items: List[CustomerOut]
    total: int
    skip: int
    limit: int

# ---------------- Segment Schemas ----------------

class SegmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rules_json: Dict[str, Any]
    source: str = "MANUAL"  # MANUAL (owner saved) | AUTO (created by campaign service)

class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rules_json: Optional[Dict[str, Any]] = None

class SegmentOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    rules_json: Dict[str, Any]
    source: str = "MANUAL"
    cached_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class SegmentSampleCustomer(BaseModel):
    id: str
    name: str
    phone: str
    points_balance: int = 0
    current_tier: str = "BRONZE"
    whatsapp_consent: bool = False

class SegmentPreviewResponse(BaseModel):
    explain: str
    matched_count: int
    reachable_count: int
    excluded_no_consent: int
    total_customers: int
    sample: List[SegmentSampleCustomer] = []

# ---------------- Loyalty Program & Rewards Schemas ----------------

class LoyaltyProgramOut(BaseModel):
    id: str
    name: str
    points_currency_name: str
    earn_type: str
    earn_rate: float
    earn_spend_unit: float
    points_expiry_days: int
    welcome_bonus_points: int
    birthday_bonus_points: int
    tier_config: Optional[dict] = None
    status: str

    class Config:
        from_attributes = True

class LoyaltyProgramUpdate(BaseModel):
    name: Optional[str] = None
    points_currency_name: Optional[str] = None
    earn_type: Optional[str] = None
    earn_rate: Optional[float] = None
    earn_spend_unit: Optional[float] = None
    points_expiry_days: Optional[int] = None
    welcome_bonus_points: Optional[int] = None
    birthday_bonus_points: Optional[int] = None

class RewardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    items: Optional[List[str]] = None  # combo contents, e.g. ["Pizza", "Coke"]
    points_required: int
    cash_value: float = 0.0
    terms: Optional[str] = None
    stock: int = -1
    expiry_days: int = 30

class RewardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    items: Optional[List[str]] = None
    points_required: Optional[int] = None
    cash_value: Optional[float] = None
    terms: Optional[str] = None
    stock: Optional[int] = None
    status: Optional[str] = None

class RewardOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    items: Optional[List[str]] = None
    points_required: int
    cash_value: float
    terms: Optional[str] = None
    stock: int
    expiry_days: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class EarnPointsRequest(BaseModel):
    customer_id: str
    amount_spent: Optional[float] = 0.0
    visits: Optional[int] = None  # VISIT_BASED programs: number of visits to credit
    points: Optional[int] = None
    description: Optional[str] = "Store visit / Purchase"
    expiry_date: Optional[str] = None  # Custom expiry date for the awarded points (YYYY-MM-DD)

class RedeemPointsRequest(BaseModel):
    customer_id: str
    reward_id: Optional[str] = None
    points: Optional[int] = None
    description: Optional[str] = "Reward redemption"

class LoyaltyTransactionOut(BaseModel):
    id: str
    customer_id: str
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    type: str
    points: int
    balance_before: int
    balance_after: int
    description: Optional[str] = None
    created_at: datetime
    # Award Rewards: WhatsApp notification status for the 'hellopets' template send
    whatsapp_sent: Optional[bool] = None
    whatsapp_error: Optional[str] = None

    class Config:
        from_attributes = True

# ---------------- Campaign Schemas ----------------

class CampaignCreate(BaseModel):
    name: str
    segment_id: Optional[str] = None
    template_id: Optional[str] = None
    channel: str = "WHATSAPP"
    scheduled_at: Optional[datetime] = None
    variables_mapping_json: Optional[Dict[str, Any]] = None
    rules_json: Optional[Dict[str, Any]] = None
    image_url: Optional[str] = None

class CampaignEstimateRequest(BaseModel):
    segment_id: Optional[str] = None
    template_id: Optional[str] = None
    rules_json: Optional[Dict[str, Any]] = None

class CampaignEstimateResponse(BaseModel):
    recipients_count: int
    matched_count: Optional[int] = None
    excluded_no_consent: Optional[int] = None
    estimated_cost: float
    wallet_balance: float
    wallet_available: float
    can_afford: bool

class CampaignOut(BaseModel):
    id: str
    name: str
    segment_id: Optional[str] = None
    segment_name: Optional[str] = None
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    channel: str
    status: str
    scheduled_at: Optional[datetime] = None
    image_url: Optional[str] = None
    recipients_count: int
    sent_count: int
    delivered_count: int
    read_count: int
    failed_count: int
    estimated_cost: float
    actual_cost: float
    attributed_revenue: float
    created_at: datetime

    class Config:
        from_attributes = True

# ---------------- Automation Schemas ----------------

class AutomationCreate(BaseModel):
    name: str
    trigger_type: str
    conditions_json: Dict[str, Any]
    template_id: Optional[str] = None
    delay_minutes: int = 0

class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    conditions_json: Optional[Dict[str, Any]] = None
    template_id: Optional[str] = None
    delay_minutes: Optional[int] = None
    status: Optional[str] = None

class AutomationOut(BaseModel):
    id: str
    name: str
    trigger_type: str
    conditions_json: Dict[str, Any]
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    delay_minutes: int
    status: str
    total_triggered: int
    created_at: datetime

    class Config:
        from_attributes = True

# ---------------- Public Page Schemas ----------------

class PublicPageOut(BaseModel):
    slug: str
    business_name: str
    hero_title: str
    hero_description: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    primary_color: str
    secondary_color: str
    header_subtitle: Optional[str] = None
    hero_cta_text: Optional[str] = None
    how_it_works_json: Optional[Dict[str, Any]] = None
    terms_text: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    social_links_json: Dict[str, Any] = {}
    is_active: bool

    # Embed program & rewards
    program: Optional[Dict[str, Any]] = None
    rewards: List[Dict[str, Any]] = []

class PublicPageUpdate(BaseModel):
    hero_title: Optional[str] = None
    hero_description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    header_subtitle: Optional[str] = None
    hero_cta_text: Optional[str] = None
    how_it_works_json: Optional[Dict[str, Any]] = None
    terms_text: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

class PublicEnrollRequest(BaseModel):
    phone: str
    first_name: str
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    whatsapp_consent: bool = True

class PublicOtpRequest(BaseModel):
    phone: str

class PublicOtpVerify(BaseModel):
    phone: str
    otp: str

# ---------------- Insights & Analytics Schemas ----------------

class InsightItem(BaseModel):
    id: str
    category: str  # WIN_BACK, REWARD_USAGE, TIER_REVENUE, CELEBRATION
    title: str
    description: str
    metric: str
    action_label: str
    action_type: str  # CREATE_CAMPAIGN, VIEW_SEGMENT, VIEW_CUSTOMERS
    action_payload: Optional[Dict[str, Any]] = None

class DashboardMetricsOut(BaseModel):
    total_customers: int
    loyalty_members: int
    points_issued: int
    points_redeemed: int
    campaign_revenue: float
    wallet_balance: float
    wallet_available: float
    recent_transactions: List[Any] = []
    insights: List[InsightItem] = []
    chart_data: List[Dict[str, Any]] = []
    deltas: Dict[str, Optional[float]] = {}
    range: Optional[Dict[str, Any]] = None

# ----------------- Audit, Pricing & Import Schemas -----------------

class AuditLogOut(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details_json: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MessagePricingOut(BaseModel):
    id: str
    country: str
    category: str
    currency: str
    meta_cost: float
    markup_margin: float
    total_price: float
    effective_from: datetime

    class Config:
        from_attributes = True

class CustomerImportColumnMapping(BaseModel):
    phone_col: str
    first_name_col: Optional[str] = None
    last_name_col: Optional[str] = None

class CustomerImportExecuteRequest(BaseModel):
    file_token: str
    mapping: CustomerImportColumnMapping
