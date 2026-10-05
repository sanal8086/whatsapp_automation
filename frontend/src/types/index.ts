export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_platform_admin: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  country: string;
  currency: string;
  status: string;
  subscription_status: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  status: string;
  user_name?: string;
  user_email?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  phone_normalized: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  gender?: string;
  date_of_birth?: string;
  city?: string;
  source: string;
  marketing_consent: boolean;
  whatsapp_consent: boolean;
  visits_count: number;
  lifetime_spend: number;
  last_visit_at?: string;
  points_balance: number;
  tier: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  loyalty_transactions: LoyaltyTransaction[];
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  points_currency_name: string;
  earn_type: string;
  earn_rate: number;
  earn_spend_unit: number;
  points_expiry_days: number;
  welcome_bonus_points: number;
  birthday_bonus_points: number;
  status: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  points_required: number;
  cash_value: number;
  terms?: string;
  stock: number;
  expiry_days: number;
  status: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  phone?: string;
  type: string;
  points: number;
  balance_before?: number;
  balance_after?: number;
  description?: string;
  created_at: string;
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  rules_json: any;
  cached_count: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  segment_id?: string;
  segment_name?: string;
  template_id?: string;
  template_name?: string;
  channel: string;
  status: string;
  scheduled_at?: string;
  recipients_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  estimated_cost: number;
  actual_cost: number;
  attributed_revenue: number;
  created_at: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  conditions_json: any;
  template_id?: string;
  template_name?: string;
  delay_minutes: number;
  status: string;
  total_triggered: number;
  created_at: string;
}

export interface WhatsAppConnection {
  id: string;
  tenant_id: string;
  display_phone_number?: string;
  verified_name?: string;
  connection_status: string;
  business_verification_status: string;
  phone_verification_status: string;
  quality_rating: string;
  waba_id?: string;
  phone_number_id?: string;
  is_live_mode?: boolean;
  connected_at?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  header_text?: string;
  body_text: string;
  footer_text?: string;
  buttons_json?: any[];
}

export interface WhatsAppMessage {
  id: string;
  recipient_phone: string;
  direction?: string;
  message_type: string;
  status: string;
  cost: number;
  failure_reason?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  tenant_id: string;
  currency: string;
  balance: number;
  reserved_balance: number;
  available_balance: number;
  status: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type?: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface InsightItem {
  id: string;
  category: string;
  title: string;
  description: string;
  metric: string;
  action_label: string;
  action_type: string;
  action_payload?: any;
}

export interface DashboardMetrics {
  total_customers: number;
  loyalty_members: number;
  points_issued: number;
  points_redeemed: number;
  campaign_revenue: number;
  wallet_balance: number;
  wallet_available: number;
  recent_transactions: LoyaltyTransaction[];
  insights: InsightItem[];
  chart_data: { date: string; customers: number; points_issued: number; revenue: number }[];
}

export interface PublicPageData {
  slug: string;
  business_name: string;
  hero_title: string;
  hero_description: string;
  logo_url?: string;
  banner_url?: string;
  primary_color: string;
  secondary_color: string;
  terms_text?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  program?: {
    name: string;
    points_currency_name: string;
    welcome_bonus_points: number;
    birthday_bonus_points: number;
  };
  rewards?: LoyaltyReward[];
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details_json?: any;
  ip_address?: string;
  created_at: string;
}

export interface MessagePricing {
  id: string;
  country: string;
  category: string;
  currency: string;
  meta_cost: number;
  markup_margin: number;
  total_price: number;
}

export interface ImportPreview {
  file_token: string;
  filename: string;
  total_rows: number;
  headers: string[];
  sample_rows: any[];
}

