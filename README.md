# Multi-Tenant Loyalty & WhatsApp Marketing SaaS Platform

A production-ready, full-stack multi-tenant SaaS platform built for modern retail businesses and cafes to run digital loyalty programs, automated customer retention, and targeted WhatsApp campaigns with strict tenancy isolation and a prepaid messaging wallet system.

---

## 🌟 Key Platform Capabilities

1. **Strict Multi-Tenancy Architecture**
   - Every merchant operates within an isolated tenant workspace (`tenant_id`).
   - Tenant context is strictly extracted from cryptographic JWT tokens on the backend—never trusted from client query or body parameters.
   - Row-level isolation across customers, transactions, rewards, campaigns, WhatsApp connections, and messaging wallets.

2. **Prepaid Messaging Wallet & Ledger Safety**
   - Immutable double-entry transaction ledger tracking every credit top-up, deduction, refund, and campaign reservation.
   - Pre-flight wallet balance checks prevent campaigns from executing if projected costs exceed available credits.
   - Real-time wallet credit pill in the merchant navbar with instant top-up simulation modal.

3. **WhatsApp Cloud API Integration & Simulation Sandbox**
   - Supports Meta Graph API credentials (Phone Number ID, WABA ID, Permanent System User Token).
   - Built-in simulation sandbox for local testing without Meta credentials—simulates message dispatch, message statuses (`sent`, `delivered`, `read`), and inbound webhook events.

4. **Dynamic Customer Segmentation & Bulk Import**
   - Automatic customer tiering (Bronze, Silver, Gold, Platinum).
   - Dynamic customer segments: *VIP High Spenders*, *At Risk / Inactive*, *New Customers (<30d)*, *Points Rich*.
   - E.164 phone number auto-normalization with fallback handling and CSV/JSON tabular imports.

5. **Loyalty & Rewards Engine**
   - Customizable points earning ratio (e.g. 1 point per $1 spent).
   - Rewards catalog with points redemption validation and QR pass generation.
   - Real-time customer transaction ledger with points expiration and automated audit tracking.

6. **Automations Engine**
   - Event-driven triggers: Welcome on Join, Points Earned milestone, Tier Upgrades, Birthday specials, and Inactivity re-engagement.
   - WhatsApp template message dispatch with dynamic placeholder interpolation (`{{name}}`, `{{points}}`, `{{reward}}`).

7. **Public Consumer Loyalty Portal (`/l/:slug`)**
   - Merchant-branded mobile-friendly digital loyalty pass.
   - Phone number enrollment with demo OTP verification (`1234`).
   - Dynamic member QR code, real-time points balance, tier badge, and 1-click reward redemption with confetti celebrations.

8. **Super Admin Platform Console (`/admin/*`)**
   - Cross-tenant business directory management.
   - Subscription plan review & manual bank transfer approval workflow.
   - Direct messaging wallet credit grants.
   - Global WhatsApp template library management.

---

## 🏗️ Architecture & Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) with async endpoints and type hints
- **Database ORM**: SQLAlchemy 2.0 (Declarative Base, relational models, SQLite by default, PostgreSQL ready)
- **Authentication**: JWT tokens (HMAC-SHA256) with password hashing via `passlib[bcrypt]`
- **Data Validation**: Pydantic v2 schemas
- **Architecture**: Domain-driven service layer pattern (`services/` -> `api/v1/` -> `models/`)

### Frontend
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Routing**: `react-router-dom` v7 with role-based route guards (`MerchantGuard`, `AdminGuard`)
- **Icons**: Lucide React
- **Design System**: Hand-crafted CSS tokens with custom glassmorphism, vibrant dark palette (`#0B0F19`), responsive sidebar layout, and micro-animations.

---

## 📁 Repository Structure

```text
Goagain/
├── backend/
│   ├── app/
│   │   ├── api/v1/            # API Route handlers (auth, tenants, customers, loyalty, campaigns, etc.)
│   │   ├── core/              # Config, database session, JWT security, auth dependencies
│   │   ├── models/            # SQLAlchemy database models (16 tables)
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── services/          # Business logic (wallet, whatsapp, loyalty, segments, insights)
│   │   ├── seed.py            # Database seeder with sample merchant, customers, and templates
│   │   └── main.py            # FastAPI entry point with CORS and error handlers
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/               # Axios API client with automatic bearer token injection
│   │   ├── components/        # Layout, Sidebar, Navbar, WalletTopupModal, RouteGuards
│   │   ├── context/           # AuthContext (JWT management & tenant state)
│   │   ├── pages/             # Dashboard, Customers, Loyalty, Campaigns, WhatsApp, Settings, Admin, Public
│   │   ├── App.tsx            # Application routing configuration
│   │   └── index.css          # Design system, glassmorphism, animations, colors
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create & activate a virtual environment (optional but recommended)
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database with demo accounts, customers, campaigns & templates
python -m app.seed

# Start the development server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API docs will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/health`

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server
npm run dev
```
The frontend application will be running at: `http://localhost:5173/`

---

## 🔑 Pre-seeded Demo Credentials

The database seeder pre-populates the system with complete business records:

| Account Type | Email | Password | Role / Access |
| :--- | :--- | :--- | :--- |
| **Merchant Owner** | `merchant@brewandbite.com` | `merchant123` | Full Merchant Workspace for **Brew & Bite Artisan Cafe** |
| **Platform Super Admin**| `admin@loyaltysaas.com` | `admin123` | Platform Admin Console (`/admin`) |

### Consumer Public Loyalty Portal:
- **URL**: `http://localhost:5173/l/brew-and-bite`
- **Customer Phone**: `+1 555-0101` (or any customer phone)
- **Demo OTP**: `1234`

---

## 🧭 Platform Route Overview

### Merchant Console (`/app/*`)
- `/app/dashboard` - Real-time KPI cards, sales volume, WhatsApp broadcast deliverability graphs, and recent customer activity.
- `/app/customers` - Searchable customer database, segment filters (VIP, At Risk, Points Rich), manual customer creation & bulk CSV import.
- `/app/customers/:id` - Detailed customer 360 profile, loyalty balance, tier progression, and full transaction history.
- `/app/loyalty` - Rewards catalog management, redemption approval, points earning rules configuration.
- `/app/campaigns` - WhatsApp campaign wizard with audience targeting, template variable mapping, cost estimation, and wallet pre-flight check.
- `/app/automations` - Lifecycle automation recipes (Welcome message, points earned alert, tier upgrade congratulations).
- `/app/whatsapp` - Meta WABA connection status, API credentials configuration, and template sync status.
- `/app/insights` - Predictive analytics: Churn risk detection, revenue forecast, and top spender rankings.
- `/app/settings` - Business profile, custom public URL slug, points program rules, and subscription details.

### Super Admin Console (`/admin/*`)
- `/admin` - Platform-wide KPI overview, registered tenant business directory, subscription review, messaging credit allocations, and global template repository.

### Consumer Portal (`/l/:slug`)
- `/l/:slug` - Public branded member pass. Customers log in with phone OTP to check points, present their digital QR pass to baristas/cashiers, and redeem rewards with instant visual feedback.

---

## 🛡️ Security & Tenant Isolation Standards
- **Token Claims**: Access tokens carry `sub` (User ID), `tenant_id` (Tenant UUID), and `role` (`SUPER_ADMIN` or `TENANT_ADMIN`).
- **Dependencies**: `get_current_tenant_id` automatically verifies that the caller has a valid tenant association and injects it into service calls.
- **Ledger Invariance**: `WalletTransactions` cannot be edited or deleted; every change is an additive ledger record.
