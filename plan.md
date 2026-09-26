

# Loyalty SaaS — Full Technical & Product Plan

## 1. Product vision

Build a multi-tenant SaaS where businesses can:

* Connect their own WhatsApp Business account through Meta Embedded Signup.
* Import/manage their customers.
* Build a loyalty program.
* Award and redeem points.
* Create customer groups/segments.
* Create WhatsApp campaigns.
* Schedule campaigns.
* Create automated loyalty/customer journeys.
* Manage WhatsApp templates.
* Maintain a prepaid messaging credit/wallet.
* Host a branded public loyalty page.
* Export customer/loyalty/campaign data.
* View business, customer, loyalty and campaign insights.
* Eventually integrate POS systems.
* Eventually add SMS/email and other channels.

The core principle should be:

> **One SaaS platform, many isolated businesses, each business owns its own customer data, loyalty program, WhatsApp Business Account and WhatsApp phone number.**

---

# 2. Recommended technology stack

### Frontend

**React + TypeScript**

Recommended:

* React
* TypeScript
* Vite
* React Router
* TanStack Query
* React Hook Form
* Zod
* Tailwind CSS
* shadcn/ui or equivalent component system
* Recharts / ECharts for analytics
* SheetJS/ExcelJS only where appropriate for client-side Excel handling

### Backend

**FastAPI + Python**

Recommended:

* FastAPI
* Pydantic v2
* SQLAlchemy 2
* Alembic
* PostgreSQL
* Redis
* Celery / Dramatiq / Arq for background jobs

I would personally use:

```text
FastAPI
PostgreSQL
Redis
Celery
```

for a proven architecture.

### Infrastructure

Start with:

```text
                    Cloud / VPS
                        │
          ┌─────────────┴─────────────┐
          │                           │
      React SPA                  FastAPI API
                                      │
                          ┌───────────┼───────────┐
                          │           │           │
                       PostgreSQL   Redis      Workers
                                                  │
                                             Celery jobs
```

Object storage:

* S3-compatible storage for imports, exports, logos, banners and media.

---

# 3. Multi-tenant architecture

This is the most important architectural decision.

Every business is a **tenant**.

Do not create separate application deployments/databases initially.

Use:

```text
Single application
       +
Single PostgreSQL database
       +
tenant_id on tenant-owned records
```

Example:

```text
tenants
customers
loyalty_programs
loyalty_transactions
campaigns
whatsapp_connections
whatsapp_templates
wallets
wallet_transactions
```

Every tenant-owned table should have:

```text
tenant_id
```

and backend authorization must enforce it.

### Never trust tenant_id from the frontend

For example, don't allow:

```http
GET /customers?tenant_id=123
```

to determine authorization.

Instead:

```text
JWT
 ↓
current_user
 ↓
current_membership
 ↓
tenant_id
 ↓
query filtered by tenant_id
```

The frontend can know the tenant, but the backend must determine the tenant from authenticated context.

---

# 4. Tenant model

Use:

```text
users
tenants
tenant_members
roles
```

Example:

```text
users
-----
id
email
password_hash
name
phone
status
created_at
```

```text
tenants
-------
id
name
slug
business_type
country
timezone
currency
status
subscription_status
created_at
updated_at
```

```text
tenant_members
--------------
id
tenant_id
user_id
role
status
created_at
```

Roles:

```text
OWNER
ADMIN
MANAGER
STAFF
VIEWER
```

Later:

```text
CAMPAIGN_MANAGER
LOYALTY_MANAGER
```

if granular permissions become necessary.

---

# 5. Platform admin vs business user

You have two completely different application areas.

## Business application

```text
/app/*
```

Used by merchants.

## Platform admin

```text
/admin/*
```

Used by your internal team.

Platform admins can:

* View businesses.
* Approve/suspend accounts.
* Enable/disable tenants.
* View subscription status.
* Mark subscription payment received.
* Add/remove messaging credits.
* View wallet history.
* View WhatsApp connection status.
* View campaign/message usage.
* Investigate failed messages.
* View system logs.
* Impersonate business users only through an audited support mechanism.
* Manage global templates.
* Manage global campaign suggestions.
* Manage pricing.
* Manage feature flags.

---

# 6. Subscription system — V1

You specifically don't want online subscription payment initially.

That's sensible for V1.

Don't build Stripe/Razorpay/etc. yet.

Use:

```text
Subscription
      ↓
Manual payment
      ↓
Admin marks payment received
      ↓
Account activated
```

Database:

```text
subscriptions
-------------
id
tenant_id
plan_id
status
starts_at
ends_at
payment_status
amount
currency
notes
created_at
updated_at
```

Statuses:

```text
TRIAL
ACTIVE
PAST_DUE
SUSPENDED
CANCELLED
EXPIRED
```

Admin actions:

```text
Mark Payment Received
Extend Subscription
Suspend Account
Activate Account
Cancel Subscription
```

### Important

Subscription and WhatsApp credit should be **separate balances**.

Don't mix:

```text
₹5,000 subscription
```

with:

```text
₹500 WhatsApp wallet
```

---

# 7. WhatsApp credit/wallet system

I strongly recommend a wallet abstraction.

Example:

```text
WhatsApp Wallet
Balance: ₹437.50
```

Business adds money through your manual billing process.

Admin can:

```text
+ ₹500
- ₹100
Refund ₹50
Adjustment ₹20
```

Database:

```text
wallets
-------
id
tenant_id
currency
balance
status
```

```text
wallet_transactions
-------------------
id
wallet_id
tenant_id
type
amount
balance_before
balance_after
reference_type
reference_id
description
created_at
created_by
```

Transaction types:

```text
CREDIT
DEBIT
REFUND
ADJUSTMENT
EXPIRY
```

### Do NOT simply decrement a `balance` column

Use a ledger.

Balance should be derived/maintained from immutable transactions.

This gives you an audit trail.

---

# 8. Messaging cost model

Do **not** hard-code:

```text
₹0.50/message
```

into the messaging service.

Create a pricing configuration:

```text
message_pricing
---------------
id
country
category
price
currency
effective_from
effective_to
```

Because Meta pricing can change and WhatsApp conversation/template pricing rules can change.

Your own SaaS can then charge:

```text
Meta cost
+
your margin
=
merchant debit
```

or simply:

```text
₹X per message
```

depending on your commercial model.

Create a pricing engine:

```text
MessagingRequest
       ↓
Determine message type/category
       ↓
Determine applicable price
       ↓
Check wallet
       ↓
Reserve credit
       ↓
Send
       ↓
Confirm debit
```

---

# 9. Wallet reservation

This is important.

Suppose wallet balance is:

```text
₹100
```

and the user starts a campaign for 500 customers.

Don't allow five simultaneous campaigns to spend the same ₹100.

Use:

```text
available_balance
reserved_balance
```

or a ledger-based reservation system.

Example:

```text
Balance:       ₹1000
Reserved:       ₹300
Available:     ₹700
```

Campaign starts:

```text
500 messages × ₹0.50
= ₹250

Reserve ₹250
```

Then actual delivery determines final accounting.

---

# 10. WhatsApp architecture

Each tenant has its own:

```text
Meta Business Portfolio
WABA
Phone Number
```

Your platform has:

```text
Meta App
Embedded Signup
system/user authorization
webhooks
Cloud API integration
```

Architecture:

```text
                         META
                          │
                 Embedded Signup
                          │
                          ▼
                    Your Backend
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
       KFC              Store A           Store B
       WABA              WABA              WABA
        │                 │                 │
      Phone              Phone             Phone
```

Do **not** put all merchant phone numbers into one WABA.

---

# 11. WhatsApp connection table

```text
whatsapp_connections
--------------------
id
tenant_id

meta_business_id
waba_id
phone_number_id

display_phone_number
verified_name

connection_status
business_verification_status
phone_verification_status

access_token_reference

connected_at
last_synced_at
created_at
updated_at
```

Potential status:

```text
PENDING
CONNECTED
PHONE_PENDING
VERIFICATION_REQUIRED
SUSPENDED
DISCONNECTED
ERROR
```

### Token security

Never put Meta access tokens in PostgreSQL plaintext.

Use:

```text
encrypted_secret
```

or preferably a proper secrets/KMS mechanism.

---

# 12. Embedded Signup flow

Business user clicks:

> **Connect WhatsApp**

Frontend:

```text
React
  ↓
open Embedded Signup
  ↓
Meta
```

Backend handles the server-side portion.

Conceptually:

```text
Merchant
   ↓
Embedded Signup
   ↓
Meta authorization
   ↓
WABA / phone information
   ↓
Backend
   ↓
Store connection
   ↓
Subscribe webhook
   ↓
Register/sync phone
   ↓
Sync templates
   ↓
CONNECTED
```

The merchant should **never provide your platform with their Meta password**.

---

# 13. WhatsApp webhook architecture

Create one central webhook endpoint:

```http
POST /webhooks/meta/whatsapp
```

Meta sends events there.

The webhook processor should:

```text
Receive webhook
      ↓
Validate signature
      ↓
Store raw event
      ↓
Return 200 quickly
      ↓
Queue processing
      ↓
Worker processes event
```

Don't do heavy processing inside the HTTP webhook request.

Database:

```text
webhook_events
--------------
id
provider
event_type
external_event_id
payload
received_at
processed_at
processing_status
error
```

This gives you idempotency.

---

# 14. Message model

Create:

```text
messages
--------
id
tenant_id
campaign_id
customer_id

whatsapp_connection_id
phone_number_id

template_id
provider_message_id

direction
message_type
status

cost
currency

sent_at
delivered_at
read_at
failed_at

failure_code
failure_reason

created_at
```

Statuses:

```text
QUEUED
SENDING
SENT
DELIVERED
READ
FAILED
CANCELLED
```

---

# 15. Template architecture

As we discussed earlier:

**Templates are WABA-specific.**

But your platform should maintain reusable logical templates.

```text
platform_templates
------------------
id
key
name
category
language
components
status
```

Then:

```text
merchant_templates
------------------
id
tenant_id
waba_id
platform_template_id
meta_template_id
name
language
status
rejection_reason
last_synced_at
```

Example:

```text
Platform template:

LOYALTY_POINTS_EARNED
```

gets provisioned into:

```text
KFC WABA
Pizza WABA
Fashion Store WABA
```

Each has its own Meta template ID/status.

---

# 16. Template management UI

Business dashboard:

```text
Templates

[ All ] [ Approved ] [ Pending ] [ Rejected ]

┌──────────────────────────────┐
│ Loyalty Points Earned        │
│ WhatsApp                     │
│ Approved                     │
│                              │
│ Hi {{1}}, you earned {{2}}   │
│ points at {{3}}.             │
│                              │
│ [View] [Test]                │
└──────────────────────────────┘
```

Actions:

* Create template
* Edit where Meta permits
* Delete
* Sync status
* Preview
* View rejection reason
* Submit template
* Test send

---

# 17. Global template library

This is an excellent SaaS feature.

Platform admin manages:

```text
Global Templates
```

Categories:

### Loyalty

* Welcome
* Points earned
* Points balance
* Reward unlocked
* Reward redeemed
* Points expiring
* Tier upgraded

### CRM

* Birthday
* Anniversary
* Win-back
* Inactive customer
* Thank you
* First purchase

### Campaigns

* Weekend offer
* Festival offer
* New product
* Special discount
* Referral

When a merchant connects WhatsApp:

```text
Global template library
          ↓
Provision selected templates
          ↓
Merchant WABA
```

This gives you the "ready to go" experience that makes products like Reelo attractive. Reelo currently promotes large ready-made template libraries and campaign templates. ([Reelo -][1])

---

# 18. Customer management

Core customer entity:

```text
customers
---------
id
tenant_id

phone
phone_normalized

first_name
last_name
email
gender

date_of_birth
anniversary_date

address
city
country

source

marketing_consent
whatsapp_consent

created_at
updated_at
```

Then customer attributes:

```text
customer_metadata
```

for flexible custom fields.

---

# 19. Customer profile

Customer detail page:

```text
John Mathew

Phone
Email
Birthday

────────────────────

Loyalty
Points: 1,250
Tier: Gold
Lifetime Earned: 4,500
Lifetime Redeemed: 3,250

────────────────────

Visits
Orders
Spend

────────────────────

Campaign history

────────────────────

WhatsApp history

────────────────────

Rewards

────────────────────

Activity timeline
```

This becomes your CRM foundation.

Reelo similarly positions customer profiles around visits, spend, preferences, campaign activity and customer insights. ([Reelo -][1])

---

# 20. Excel import

Build a proper import pipeline.

```text
Upload Excel
     ↓
Read columns
     ↓
Column mapping
     ↓
Validate
     ↓
Preview
     ↓
Import
     ↓
Background processing
     ↓
Import report
```

Example:

```text
Excel column        → System field

Mobile              → phone
Customer Name       → first_name
Email               → email
DOB                 → date_of_birth
Total Spend         → lifetime_spend
```

Validation:

* Invalid phone
* Duplicate phone
* Missing phone
* Invalid email
* Invalid date
* Unsupported fields

Import result:

```text
Imported: 8,423
Updated: 1,201
Skipped: 73
Invalid: 19
```

---

# 21. Export

Allow:

```text
Export Customers
Export Loyalty Transactions
Export Campaign Results
Export Message Logs
Export Wallet Transactions
```

Large exports should be asynchronous:

```text
Request export
     ↓
Background worker
     ↓
Generate CSV/XLSX
     ↓
S3
     ↓
Download link
```

---

# 22. Customer segmentation

This is one of the most valuable parts of the platform.

Build a segment builder.

Example:

```text
Customers where:

Last visit > 30 days
AND
Lifetime spend > ₹5,000
AND
Loyalty points > 500
```

Another:

```text
Visits >= 5
AND
Last visit <= 14 days
```

Another:

```text
Birthday within next 7 days
```

Support:

### Demographic

* Gender
* Age
* City

### Behavioral

* Visit count
* Last visit
* Average order value
* Lifetime spend
* Purchase frequency

### Loyalty

* Points balance
* Tier
* Rewards redeemed
* Points expiring

### Campaign

* Opened
* Clicked
* Redeemed
* Received

### Engagement

* WhatsApp reachable
* Last message
* Last interaction

---

# 23. Segment engine

Don't store every segment as a huge list initially.

Store the rule:

```json
{
  "operator": "AND",
  "conditions": [
    {
      "field": "last_visit",
      "operator": "before_days",
      "value": 30
    },
    {
      "field": "lifetime_spend",
      "operator": "greater_than",
      "value": 5000
    }
  ]
}
```

Then execute it against the customer database.

Later, introduce materialized segments for very large tenants.

---

# 24. Loyalty program

A tenant can have:

```text
loyalty_program
```

with:

```text
name
description
currency/points name
earning rules
redemption rules
expiry rules
tier rules
status
```

Example:

> ₹100 spent = 10 points

or:

> 1 visit = 10 points

or:

> ₹1 = 1 point

Reelo currently supports points, visit and spend-based loyalty structures and tiered programs, so those are useful reference models. ([Reelo -][1])

---

# 25. Loyalty ledger

Never directly update:

```text
customer.points = 500
```

without a ledger.

Use:

```text
loyalty_transactions
--------------------
id
tenant_id
customer_id

type
points

reference_type
reference_id

description

balance_before
balance_after

expires_at
created_at
```

Transaction types:

```text
EARN
REDEEM
BONUS
ADJUSTMENT
EXPIRY
REFUND
REVERSAL
```

This makes your loyalty system auditable.

---

# 26. Rewards

```text
rewards
-------
id
tenant_id
name
description
image
points_required
cash_value
terms
stock
expiry_days
status
```

Example:

```text
100 points
→ Free coffee

500 points
→ ₹100 off

1,000 points
→ Free meal
```

---

# 27. Loyalty public page

This is a major feature.

Your URL:

```text
https://yourapp.com/l/{slug}
```

Example:

```text
https://yourapp.com/l/kfc-rewards
```

Your supplied Reelo page is useful as a reference, although the current page itself renders as a JS application rather than exposing its visual structure to the crawler. ([Reelo.io][3])

Build a configurable landing page.

```text
┌───────────────────────────────┐
│          [LOGO]               │
│                               │
│      KFC Rewards              │
│                               │
│   [Banner / Hero Image]       │
│                               │
│  Earn points every time       │
│  you visit                    │
│                               │
│       [Join Now]              │
│                               │
├───────────────────────────────┤
│ How it works                  │
│                               │
│ ① Join                        │
│ ② Earn                        │
│ ③ Redeem                      │
│                               │
├───────────────────────────────┤
│ Rewards                       │
│                               │
│ ₹100 OFF       500 points     │
│ Free Coffee    250 points     │
└───────────────────────────────┘
```

Business can customize:

* Logo
* Business name
* Banner
* Primary color
* Secondary color
* Font
* Hero text
* Description
* CTA
* Rewards
* Terms
* Social links
* Contact details

---

# 28. Loyalty enrollment flow

Public page:

```text
Customer
   ↓
Enter phone
   ↓
OTP
   ↓
Verify
   ↓
Name/email/birthday
   ↓
Accept terms/consent
   ↓
Create loyalty account
   ↓
Show points/rewards
```

If WhatsApp opt-in is required, record consent separately.

Do not assume:

> "Customer gave phone number = WhatsApp marketing consent."

Keep explicit consent records.

---

# 29. Customer loyalty page

After login:

```text
Welcome John 👋

1,250 Points

Gold Member

██████████░░ 75%
250 points to Platinum

Available Rewards

₹100 OFF
500 points

FREE COFFEE
250 points

Activity

+100 Points
Visit

-500 Points
₹100 Reward
```

---

# 30. Campaign management

Campaign creation should be wizard-based.

### Step 1

```text
Campaign Name
```

### Step 2

Audience:

```text
All Customers
Segment
Upload list
Manual selection
```

### Step 3

Channel:

```text
WhatsApp
```

Eventually:

```text
WhatsApp
SMS
Email
```

### Step 4

Template:

```text
Choose approved WhatsApp template
```

### Step 5

Variables:

```text
{{customer_name}}
{{points}}
{{reward}}
{{business_name}}
```

### Step 6

Schedule:

```text
Send now
Schedule
```

### Step 7

Estimate:

```text
Recipients: 4,230
Estimated cost: ₹2,115
Wallet balance: ₹4,200

[Send Campaign]
```

---

# 31. Campaign engine

Don't send 10,000 messages inside a FastAPI request.

Use:

```text
Campaign
   ↓
Create recipients
   ↓
Queue jobs
   ↓
Workers
   ↓
WhatsApp API
   ↓
Webhook status
```

Celery:

```text
campaign_dispatch_queue
message_send_queue
webhook_processing_queue
scheduled_campaign_queue
automation_queue
```

---

# 32. Campaign throttling

Implement rate limiting.

Per tenant:

```text
messages/minute
messages/day
```

Also respect Meta's limits.

Don't let a merchant accidentally launch:

```text
100,000 messages
```

in one second.

Use:

```text
Campaign
 ↓
Batch 100
 ↓
Queue
 ↓
Rate limiter
 ↓
Send
```

---

# 33. Campaign safety confirmation

Before sending:

```text
You're about to send:

4,238 messages

Estimated wallet usage:
₹2,119

Audience:
Inactive Customers

Template:
Win Back Customer

[Cancel]
[Confirm & Send]
```

This is especially important because your system is spending real wallet balance.

---

# 34. Automated campaigns

This should be a separate feature from one-time campaigns.

Examples:

```text
Welcome
Birthday
Anniversary
Points Expiring
Reward Unlocked
Win Back
Inactive Customer
Tier Upgrade
First Purchase
```

Reelo's current product similarly emphasizes automated birthday, anniversary, win-back and welcome campaigns, along with behavior-triggered campaigns. ([Reelo -][1])

Architecture:

```text
Event
 ↓
Rule engine
 ↓
Audience condition
 ↓
Template
 ↓
Delay/schedule
 ↓
Wallet check
 ↓
WhatsApp
```

---

# 35. Example automation

```text
WHEN

customer has not visited for 30 days

AND

customer has visited at least 3 times

THEN

wait 30 minutes

SEND

WIN_BACK template
```

Another:

```text
WHEN

customer's points expire in 7 days

THEN

send points-expiry template
```

---

# 36. Home dashboard

Don't make the dashboard just a collection of numbers.

It should answer:

> **"How is my business doing, and what should I do next?"**

### Top cards

```text
Customers
12,482

Loyalty Members
8,392

Points Issued
124K

Points Redeemed
87K

Campaign Revenue
₹2.4L
```

### Customer growth

Chart:

```text
New customers
Loyalty members
Active members
```

### Loyalty

```text
Points issued
Points redeemed
Redemption rate
Top rewards
```

### Campaigns

```text
Messages sent
Delivered
Failed
Clicked
Conversions
Revenue
```

### WhatsApp

```text
Wallet balance
Messages this month
Messages remaining
Connection status
Template status
```

---

# 37. "Insights" section

This is where I'd differentiate the product.

Instead of merely:

> 12,000 customers

generate insights:

```text
💡 1,284 customers haven't visited in 30+ days.

A win-back campaign could target this group.
```

```text
💡 Your Gold members generate 2.3× more revenue
than your average loyalty member.
```

```text
💡 38% of your rewards remain unused.
Consider a points-expiry reminder.
```

```text
💡 426 customers have enough points for a reward
but haven't redeemed one.
```

```text
💡 Your birthday campaign generated 182 visits
this month.
```

These should initially be deterministic SQL/business rules.

**Don't make AI responsible for the numbers.**

AI can later turn verified metrics into natural-language recommendations.

---

# 38. Analytics data model

Create daily aggregates:

```text
daily_tenant_metrics
--------------------
tenant_id
date
new_customers
active_customers
loyalty_members
points_issued
points_redeemed
rewards_redeemed
messages_sent
messages_delivered
messages_failed
campaigns_sent
campaign_revenue
```

This keeps dashboards fast.

---

# 39. Campaign attribution

This is a major opportunity.

When a campaign contains:

```text
campaign_id
```

associate redemption/order with it.

For example:

```text
Campaign
WIN_BACK_JULY

Customer receives message
       ↓
Clicks loyalty page
       ↓
Redeems ₹100 reward
       ↓
Purchase recorded
       ↓
Revenue attributed
```

Dashboard:

```text
Campaign

Recipients      4,320
Delivered       4,190
Redeemed          182
Revenue       ₹48,200

Campaign Cost    ₹2,095

Attributed ROI   23.0x
```

This aligns with the campaign analytics/ROI emphasis seen in Reelo's current product. ([Reelo -][2])

---

# 40. Navigation

I'd structure the merchant dashboard like:

```text
HOME

CUSTOMERS
  ├── All Customers
  ├── Segments
  ├── Import
  └── Export

LOYALTY
  ├── Overview
  ├── Program
  ├── Rewards
  ├── Transactions
  └── Public Page

CAMPAIGNS
  ├── All Campaigns
  ├── Create Campaign
  ├── Scheduled
  └── Reports

AUTOMATIONS
  ├── Journeys
  ├── Templates
  └── Events

WHATSAPP
  ├── Connection
  ├── Templates
  ├── Messages
  └── Wallet

INSIGHTS
  ├── Customers
  ├── Loyalty
  ├── Campaigns
  └── Revenue

SETTINGS
  ├── Business
  ├── Team
  ├── Branding
  ├── WhatsApp
  └── Subscription
```

---

# 41. Admin navigation

```text
ADMIN

Dashboard

Businesses
  ├── All Businesses
  ├── Active
  ├── Suspended
  └── Pending

Subscriptions
  ├── Active
  ├── Pending Payment
  └── Expired

WhatsApp
  ├── Connections
  ├── Templates
  ├── Messages
  └── Failures

Wallets
  ├── Balances
  ├── Transactions
  └── Adjustments

Global Templates

Plans & Pricing

Platform Analytics

Audit Logs

System Settings
```

---

# 42. Database overview

A reasonable V1 schema:

```text
users
tenants
tenant_members
roles

plans
subscriptions

wallets
wallet_transactions

whatsapp_connections
whatsapp_templates
platform_templates
whatsapp_messages
webhook_events

customers
customer_metadata
customer_consents
customer_tags
tags

segments
segment_memberships

loyalty_programs
loyalty_rules
loyalty_rewards
loyalty_transactions
customer_loyalty_accounts

campaigns
campaign_recipients
campaign_messages

automations
automation_triggers
automation_actions
automation_executions

public_pages
public_page_events

daily_tenant_metrics

imports
exports

audit_logs
```

---

# 43. API structure

FastAPI:

```text
/api/v1/auth/*
/api/v1/tenants/*
/api/v1/customers/*
/api/v1/segments/*
/api/v1/loyalty/*
/api/v1/rewards/*
/api/v1/campaigns/*
/api/v1/automations/*
/api/v1/templates/*
/api/v1/whatsapp/*
/api/v1/wallet/*
/api/v1/analytics/*
/api/v1/imports/*
/api/v1/exports/*
```

Admin:

```text
/api/v1/admin/tenants/*
/api/v1/admin/subscriptions/*
/api/v1/admin/wallets/*
/api/v1/admin/whatsapp/*
/api/v1/admin/templates/*
/api/v1/admin/audit/*
```

Webhook:

```text
/webhooks/meta/whatsapp
```

Public:

```text
/public/l/{slug}
/public/l/{slug}/join
/public/l/{slug}/otp
/public/l/{slug}/rewards
```

---

# 44. Background jobs

Create explicit worker tasks.

```text
send_whatsapp_message
process_whatsapp_webhook
sync_whatsapp_templates
sync_whatsapp_connection
create_merchant_template
refresh_template_status

process_customer_import
generate_customer_export

execute_campaign
dispatch_campaign_batch

execute_automation
process_automation_event

calculate_daily_metrics
generate_insights
```

---

# 45. Idempotency

This is critical.

WhatsApp/webhooks and payment operations can be retried.

Every external event should have:

```text
external_event_id
```

and a unique constraint.

Every message should have:

```text
provider_message_id
```

Campaign jobs should also be idempotent.

Never send the same message twice simply because a worker retried.

---

# 46. Security

Implement from day one:

### Authentication

* Secure password hashing
* JWT access tokens
* Refresh tokens
* Token rotation

### Authorization

RBAC + tenant isolation.

### Secrets

Encrypt:

* Meta tokens
* API credentials
* webhook secrets

### Audit

Record:

```text
who
what
tenant
when
before
after
IP
```

for important admin actions.

Especially:

* Wallet adjustments
* Account suspension
* Subscription changes
* WhatsApp connection/disconnection
* Loyalty point adjustments

---

# 47. Consent & privacy

For customer data, build consent into the model.

```text
customer_consents
-----------------
customer_id
channel
consent_type
status
source
timestamp
proof/reference
```

Channels:

```text
WHATSAPP
SMS
EMAIL
```

Types:

```text
MARKETING
TRANSACTIONAL
```

Also support:

```text
OPT_IN
OPT_OUT
```

This becomes important as you scale and as you operate in India/other jurisdictions.

---

# 48. Don't build POS integration in V1

I would deliberately keep this out of the first release.

Instead, design:

```text
Order
Visit
Purchase
```

as future entities.

Then later:

```text
POS
 ↓
Integration layer
 ↓
Orders
 ↓
Customer
 ↓
Loyalty engine
```

Reelo's current product gets substantial value from POS integrations, but that is a separate integration project. ([Reelo -][1])

---

# 49. V1 scope

I would define V1 as:

### Authentication

* Business signup/login
* Team members
* Password reset
* Tenant isolation

### Business

* Business profile
* Branding
* Logo/banner/colors

### WhatsApp

* Embedded Signup
* WABA connection
* Phone connection
* Template synchronization
* Template creation
* Template status
* Webhooks
* Message sending
* Message logs

### Wallet

* Balance
* Admin credit
* Debit
* Ledger
* Message cost
* Low-balance warning

### Customers

* CRUD
* Import Excel
* Export
* Search
* Filtering
* Customer profile

### Segments

* Basic dynamic segmentation

### Loyalty

* Program setup
* Points
* Rewards
* Earn
* Redeem
* Transactions
* Expiry

### Campaigns

* Create
* Audience
* Template
* Preview
* Cost estimate
* Send now
* Schedule
* Results

### Public loyalty page

* Branded page
* Customer enrollment
* OTP
* Points balance
* Rewards
* Activity

### Dashboard

* Customer metrics
* Loyalty metrics
* WhatsApp metrics
* Campaign metrics
* Insights

### Admin

* Business management
* Subscription management
* Wallet management
* WhatsApp monitoring
* Audit logs

---

# 50. V2

After V1 is stable:

```text
POS integrations
SMS
Email
Referral programs
Memberships
QR codes
Feedback
Review management
Advanced automation
A/B testing
Campaign attribution
AI campaign assistant
AI insights
WhatsApp interactive messages
WhatsApp flows
WhatsApp carousel campaigns
```

Reelo's current product demonstrates the breadth you could eventually reach: loyalty, CRM, campaigns, automated marketing, WhatsApp, QR codes, feedback/reviews, referrals, memberships and mobile experiences. ([Reelo -][1])

---

# 51. V3 — intelligence layer

Once you have enough customer behavior data:

```text
Customer behavior
       ↓
Segmentation
       ↓
Prediction
       ↓
Recommendation
       ↓
Campaign
       ↓
Revenue attribution
       ↓
Learning
```

Example:

> "You have 842 customers who usually visit on weekends but haven't visited in 21 days."

Then:

> **Create win-back campaign**

One click:

```text
[Create Campaign]
```

Automatically chooses:

* segment
* template
* variables
* offer
* timing

Reelo's recent product direction already includes an AI Campaign Copilot that recommends audience, messaging and offers from a campaign objective. ([Reelo -][2])

---

# 52. Recommended frontend layout

Desktop:

```text
┌───────────────────────────────────────────────────────────────┐
│ Logo        Search              Notifications   Business ▼   │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│ Home          │                                               │
│ Customers     │                  CONTENT                      │
│ Loyalty       │                                               │
│ Campaigns     │                                               │
│ Automations   │                                               │
│ WhatsApp      │                                               │
│ Insights      │                                               │
│               │                                               │
│ Settings      │                                               │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

Mobile should use bottom navigation or a compact drawer.

---

# 53. Design direction

I'd avoid making it look like an enterprise ERP.

The product should feel:

**Modern + simple + marketing-oriented.**

Use:

* generous whitespace
* large metric cards
* strong visual hierarchy
* charts
* customer avatars
* campaign cards
* reward cards
* clear CTAs
* mobile-friendly public loyalty pages

The public loyalty page should be much more consumer-oriented than the admin dashboard.

---

# 54. Important architectural principle: separate domains

Don't make one giant `services.py`.

Structure FastAPI approximately:

```text
backend/
  app/
    api/
      auth/
      tenants/
      customers/
      loyalty/
      campaigns/
      whatsapp/
      wallet/
      analytics/
      admin/

    domain/
      customers/
      loyalty/
      campaigns/
      whatsapp/
      billing/

    models/
    schemas/
    repositories/
    services/
    workers/
    integrations/
      meta/
    core/
      auth/
      security/
      tenancy/
      database/
    tasks/
```

Especially:

```text
integrations/meta/
```

should contain Meta-specific logic.

Your loyalty engine should **not know anything about Meta APIs**.

---

# 55. Messaging abstraction

This is very important for future expansion.

Don't write:

```python
loyalty_service -> meta_whatsapp_api
```

Instead:

```text
Loyalty Engine
      ↓
Messaging Service
      ↓
Message Provider Interface
      ↓
WhatsApp Provider
```

Later:

```text
Messaging Service
   ├── WhatsApp
   ├── SMS
   └── Email
```

So:

```python
send_message(
    tenant_id,
    customer_id,
    channel="WHATSAPP",
    template="LOYALTY_POINTS_EARNED"
)
```

The loyalty engine doesn't care how WhatsApp works.

---

# 56. Campaign abstraction

Likewise:

```text
Campaign
  ↓
Audience
  ↓
Message
  ↓
Channel
```

rather than:

```text
Campaign = WhatsAppCampaign
```

This gives you:

```text
WhatsApp campaign
SMS campaign
Email campaign
```

later without rewriting the campaign engine.

---

# 57. Public page architecture

Don't create a separate React app initially.

Use the same React application:

```text
/app/*
```

for authenticated business dashboard.

```text
/l/*
```

for public loyalty pages.

Public page loads:

```http
GET /api/v1/public/loyalty-pages/{slug}
```

Return:

```json
{
  "business_name": "...",
  "logo": "...",
  "banner": "...",
  "theme": {...},
  "program": {...},
  "rewards": [...]
}
```

---

# 58. Suggested project structure

```text
project/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── customers/
│   │   │   ├── loyalty/
│   │   │   ├── campaigns/
│   │   │   ├── whatsapp/
│   │   │   ├── wallet/
│   │   │   ├── insights/
│   │   │   └── admin/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── api/
│   │
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── integrations/
│   │   │   └── meta/
│   │   ├── workers/
│   │   └── main.py
│   │
│   ├── migrations/
│   └── requirements.txt
│
├── docker-compose.yml
├── .env.example
├── README.md
└── docs/
    ├── architecture.md
    ├── whatsapp.md
    ├── tenancy.md
    ├── loyalty.md
    └── campaigns.md
```

---

# 59. Build order

I would **not** ask a coding agent to build all of this at once.

Build in vertical slices.

### Phase 1 — Foundation

```text
Auth
Tenant
RBAC
Business profile
Admin
Database
```

### Phase 2 — Customers

```text
Customer CRUD
Search
Import
Export
Profile
```

### Phase 3 — WhatsApp

```text
Meta app integration
Embedded Signup
WABA connection
Phone number
Webhook
Templates
Message service
```

### Phase 4 — Wallet

```text
Wallet
Ledger
Admin credits
Message cost
Reservations
```

### Phase 5 — Loyalty

```text
Program
Points ledger
Rewards
Redemption
Expiry
```

### Phase 6 — Campaigns

```text
Segments
Campaign builder
Template variables
Scheduling
Queue
Sending
Analytics
```

### Phase 7 — Public loyalty page

```text
Branding
Enrollment
OTP
Points
Rewards
Redemption
```

### Phase 8 — Insights

```text
Metrics
Charts
Recommendations
```

### Phase 9 — Automation

```text
Triggers
Rules
Actions
Scheduled journeys
```

---

# 60. Critical V1 engineering rules

Give these rules directly to the coding agent:

### Rule 1

**Every tenant-owned database row must be tenant-scoped.**

### Rule 2

**Never trust tenant IDs supplied by clients for authorization.**

### Rule 3

**Never store Meta credentials in plaintext.**

### Rule 4

**Never send WhatsApp messages synchronously from an API request.**

### Rule 5

**Every WhatsApp webhook must be idempotent.**

### Rule 6

**Every loyalty point change must create a ledger transaction.**

### Rule 7

**Every wallet change must create a ledger transaction.**

### Rule 8

**Never allow negative wallet balances unless explicitly configured.**

### Rule 9

**Never send a campaign without checking estimated wallet cost.**

### Rule 10

**Never assume a template is approved just because it exists.**

### Rule 11

**Meta-specific code belongs behind a provider abstraction.**

### Rule 12

**Don't couple loyalty logic to WhatsApp.**

---

# 61. The most important domain relationships

The core system should ultimately look like:

```text
TENANT
 │
 ├── USERS
 │
 ├── SUBSCRIPTION
 │
 ├── WALLET
 │
 ├── WHATSAPP CONNECTION
 │       │
 │       ├── WABA
 │       ├── PHONE
 │       └── TEMPLATES
 │
 ├── CUSTOMERS
 │       │
 │       ├── CONSENTS
 │       ├── LOYALTY ACCOUNT
 │       └── ACTIVITY
 │
 ├── SEGMENTS
 │
 ├── LOYALTY PROGRAM
 │       │
 │       ├── RULES
 │       ├── REWARDS
 │       └── TRANSACTIONS
 │
 ├── CAMPAIGNS
 │       │
 │       ├── RECIPIENTS
 │       └── MESSAGES
 │
 ├── AUTOMATIONS
 │
 └── PUBLIC LOYALTY PAGE
```

That is the backbone I'd use.

---

# 62. Product differentiation I'd prioritize

Don't try to beat established platforms by having 100 features immediately.

Your strongest V1 story can be:

> **"Turn your customer list into a loyalty program and reach customers automatically on WhatsApp."**

Three killer workflows:

### Workflow 1 — Capture

```text
QR / Link
 ↓
Customer joins
 ↓
Loyalty account created
```

### Workflow 2 — Reward

```text
Purchase
 ↓
Points
 ↓
Reward unlocked
 ↓
WhatsApp notification
```

### Workflow 3 — Retain

```text
Customer becomes inactive
 ↓
Segment detects it
 ↓
Win-back campaign
 ↓
WhatsApp
 ↓
Customer returns
 ↓
Revenue attributed
```

That gives the entire product a coherent loop rather than being a collection of unrelated CRM screens.

---

## Final architecture

The architecture I would hand to the coding agent is essentially:

```text
                         ┌───────────────────────┐
                         │       REACT           │
                         │                       │
                         │ Dashboard             │
                         │ Customers             │
                         │ Loyalty               │
                         │ Campaigns             │
                         │ Automations           │
                         │ WhatsApp              │
                         │ Wallet                │
                         │ Insights              │
                         │ Settings              │
                         └───────────┬───────────┘
                                     │
                                  REST API
                                     │
                         ┌───────────▼───────────┐
                         │       FASTAPI         │
                         │                       │
                         │ Auth / RBAC           │
                         │ Tenant Isolation      │
                         │ Customer Service      │
                         │ Loyalty Engine        │
                         │ Campaign Engine       │
                         │ Messaging Service     │
                         │ Wallet Service        │
                         │ Analytics             │
                         └──────┬────────┬───────┘
                                │        │
                    ┌───────────▼─┐    ┌─▼────────────┐
                    │ PostgreSQL  │    │    Redis     │
                    │             │    │              │
                    │ Multi-tenant│    │ queues/cache │
                    └─────────────┘    └──────┬───────┘
                                              │
                                          Celery
                                              │
                       ┌──────────────────────┼────────────────────┐
                       │                      │                    │
                       ▼                      ▼                    ▼
                Campaign jobs          Automation jobs       Import/export
                       │
                       ▼
                Messaging Service
                       │
                       ▼
                WhatsApp Provider
                       │
                       ▼
                  Meta Cloud API
                       │
                       ▼
                Merchant's WABA
                       │
                       ▼
                Merchant's number
                       │
                       ▼
                   Customer
```

And independently:

```text
Customer
   │
   ▼
Public Loyalty Page
   │
   ▼
Loyalty API
   │
   ▼
Tenant Loyalty Account
```

This structure gives you a clean path from **V1 manual billing + WhatsApp + loyalty** to eventually adding **POS integrations, SMS/email, automated journeys, referrals, feedback, AI campaign generation and deeper revenue attribution** without having to rewrite the core platform. Reelo's current product breadth and recent updates support those as sensible future expansion areas rather than things you need to cram into V1. ([Reelo -][1])

### One Meta-specific thing I would lock down before implementation

Because your commercial model appears to be **merchant → your platform → Meta**, I'd treat the WhatsApp partner/billing configuration as a separate infrastructure milestone. Your application architecture above should work either way, but the exact Meta onboarding/credit-line arrangement needs to be configured correctly before production. Meta's Embedded Signup materials distinguish the partner flows and document line-of-credit sharing for client WABAs. ([Reelo -][1])

This plan is also intentionally designed so that **Meta is just one messaging provider**—if Meta changes its API, pricing, or partner requirements, you can replace the adapter without rewriting customers, loyalty, campaigns, or the rest of the SaaS.

[1]: https://reelo.io/?utm_source=chatgpt.com "Reelo - #1 Customer Loyalty & CRM for Restaurants"
[2]: https://reelo.io/category/blogs/product/?utm_source=chatgpt.com "Product – Reelo - Reelo"
[3]: https://app.reelo.io/l/CPHfx "Reelo"
