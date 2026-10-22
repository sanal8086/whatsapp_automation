# Skip Button on WhatsApp Cloud API Onboarding Step

## Goal

Add a **Skip for now** action to the `Connect WhatsApp Cloud API` onboarding step
(`frontend/src/pages/onboarding/WhatsAppOnboardingPage.tsx:347`) so an approved merchant can
dismiss the step and reach the dashboard, configuring WhatsApp later from `/app/whatsapp`.

## Context: why a button alone is not enough

`tenant.status` is the only state gating onboarding. Both route guards hard-redirect on it:

- `ProtectedRoute` (`frontend/src/App.tsx:40-42`) — `APPROVED` → `/onboarding/whatsapp`
- `OnboardingRoute` (`frontend/src/App.tsx:62-64`) — `ACTIVE` → `/app`

`tenant.status` reaches `ACTIVE` only inside
`WhatsAppService.exchange_and_connect_embedded_signup` (`backend/app/services/whatsapp_service.py:250-255`).
So the skip must be **persisted server-side**, or the merchant is bounced straight back to the step.

## Decisions (agreed)

| # | Decision |
|---|---|
| D1 | Skip sets `tenant.status = "ACTIVE"` **and** upserts `WhatsAppConnection.connection_status = "SKIPPED"`. No new tenant status, no guard edits. |
| D2 | After skip, navigate to `/app`. **No** dashboard banner — the existing `AppLayout` status pill is the reminder; relabel it to `WhatsApp Not Connected`. |
| D3 | Two-step inline confirm (`.btn-ghost`) — no modal, no `window.confirm`. |
| D4 | Non-connected tenants get a read-only warning banner on `/app/campaigns`. No new backend guard. |

`SKIPPED` is safe because **every** consumer gates on `connection_status == "CONNECTED"`
(`automation_runner.py:25,60,110,139`, `campaign_dispatcher.py:37`, `whatsapp.py:248`,
`whatsapp_service.py:333`, `onboarding.py:49`) — all correctly keep treating `SKIPPED` as not-connected.
`connection_status` is `String(50)` (`models.py:157`), **not** a DB enum, and the project has no
Alembic (tables come from `Base.metadata.create_all` in `main.py:18`). **No migration required.**

## Tasks

### 1. Backend — service method

`backend/app/services/whatsapp_service.py`

- Add `WhatsAppOnboardingSession` to the model import block at `:10-14` (currently missing).
- Add `WhatsAppService.skip_embedded_signup(db, tenant_id) -> WhatsAppConnection`, modelled on
  `disconnect_account` (`:260-273`):
  1. `conn = WhatsAppService.get_or_create_connection(db, tenant_id)`
  2. `if conn.connection_status != "CONNECTED": conn.connection_status = "SKIPPED"` — idempotent,
     never downgrades a live connection
  3. Set any `CREATED` / `IN_PROGRESS` `WhatsAppOnboardingSession` rows for the tenant to `SKIPPED`
     (otherwise `GET /onboarding/status` keeps reporting `has_active_onboarding_session: true`)
  4. `t.status = "ACTIVE"` for the tenant
  5. `db.commit()` / `db.refresh(conn)`
  6. `AuditService.log(...)` with `action="WHATSAPP_ONBOARDING_SKIPPED"`,
     `resource_type="WHATSAPP_CONNECTION"` — same call shape as `:266-272`

### 2. Backend — endpoint

`backend/app/api/v1/onboarding.py` — add `POST /onboarding/whatsapp-signup/skip` after `complete`
(ends `:217`).

- Auth: `current_user: User = Depends(get_current_user)`, `db: Session = Depends(get_db)`
  (same deps as `start`, not `get_current_tenant` — `start`/`complete` resolve the tenant via an
  `ACTIVE` `TenantMember` lookup; stay consistent)
- Resolve tenant, then guard `tenant.status not in ("APPROVED", "ACTIVE")` → `403 "Business not approved"`
  (mirrors `:162-163`)
- **Do not require an active onboarding session.** `fetchConfig()` can fail, and the skip must still
  work in that case — this is exactly why a separate endpoint beats reusing `/complete`.
- Delegate to `WhatsAppService.skip_embedded_signup`, then return a shape mirroring `complete` (`:206-217`)
  so the frontend can reuse its response type:
  ```json
  { "status": "skipped", "tenant_status": "ACTIVE", "whatsapp": { "connection_status": "SKIPPED" } }
  ```

### 3. Backend — comment hygiene

- `backend/app/models/models.py:157` — extend the inline enum comment to include `SKIPPED`
- `backend/app/models/models.py:534` — extend the session-status comment to include `SKIPPED`

### 4. Frontend — skip handler

`frontend/src/pages/onboarding/WhatsAppOnboardingPage.tsx`

- Add `const [confirmingSkip, setConfirmingSkip] = useState(false)` and
  `const [skipping, setSkipping] = useState(false)` next to the existing state block (`:53-58`)
- Add `handleSkip()`:
  ```ts
  const handleSkip = async () => {
    setSkipping(true);
    setError(null);
    try {
      const data = await apiRequest<{ status: string; tenant_status: string }>(
        '/onboarding/whatsapp-signup/skip',
        { method: 'POST' }
      );
      // Mirror handleCompleteSignup (:283-288) — must refresh in-memory tenant.status
      // to ACTIVE or the guards bounce straight back to this step.
      if (token && user && tenant) {
        login(token, user, { ...tenant, status: data.tenant_status });
      }
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to skip WhatsApp setup');
      setConfirmingSkip(false);
    } finally {
      setSkipping(false);
    }
  };
  ```
  On failure do **not** navigate — stay on the step and surface the error banner.

### 5. Frontend — skip UI

`WhatsAppOnboardingPage.tsx`, inside the `step === 'ready'` block (`:468-639`).

Place it **once**, after the `isLiveConfigured ? (...) : (...)` ternary closes at `:638`, so it renders
in both the live-configured and sandbox branches without duplication.

Copy the separator + ghost-button pattern from `WaitingPage.tsx:271-280`:

- Not confirming: a single full-width `.btn.btn-ghost` reading `Skip for now — configure later`,
  `onClick={() => setConfirmingSkip(true)}`
- Confirming: replace it with a bordered row —
  `Skip WhatsApp setup for now? Campaigns and automations stay disabled until you connect.`
  plus two `.btn.btn-sm` buttons: **Cancel** (`setConfirmingSkip(false)`) and
  **Yes, skip** (`onClick={handleSkip}`, `disabled={skipping}`, spinner while pending), with a
  `ChevronRight`-free neutral/amber treatment.
- Hide the whole row while `skipping` to prevent a double POST.

### 6. Frontend — status pill relabel

`frontend/src/components/layout/AppLayout.tsx:439` — change

```tsx
{waConnection.connection_status === 'CONNECTED' ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
```

to `'WhatsApp Not Connected'`. The existing `status-disconnected` class and warning-coloured dot
(`:428`, `:435`) already render correctly for `SKIPPED` — no style change needed.

### 7. Frontend — campaigns warning banner

`frontend/src/pages/campaigns/CampaignsPage.tsx`

- Add `const [waConnected, setWaConnected] = useState<boolean | null>(null)`
- Add `apiRequest<WhatsAppConnection>('/whatsapp/connection')` to the existing `Promise.all`
  (`:44-48`); set `res.connection_status === 'CONNECTED'`. This GET is idempotent
  (`get_or_create_connection` auto-creates a `DISCONNECTED` row).
- Render `waConnected === false &&` a read-only amber notice near the top of the page, copying the
  inline notice styling from `WhatsAppOnboardingPage.tsx:442-465`
  (`rgba(245,158,11,0.1)` bg, `rgba(245,158,11,0.25)` border, `HelpCircle` icon).
  Text: WhatsApp Cloud API is not connected — campaigns will fail at dispatch. Link to
  `/app/whatsapp`. **Read-only**: do not block campaign creation or the send handler (`:84`, `:97`).

## Out of scope

- No new tenant status, no route-guard changes in `App.tsx`.
- No dashboard banner or any new `localStorage` dismissal state.
- No backend guard on campaign creation.
- No changes to `/app/whatsapp`. Its existing `Ready to Link` empty state
  (`WhatsAppPage.tsx:422+`) already renders for `SKIPPED`, and re-connecting from there already
  overwrites `SKIPPED` → `CONNECTED` via `launchEmbeddedSignup()` (`:49`) → `/whatsapp/embedded-signup/callback`
  → `exchange_and_connect_embedded_signup`, or the manual form → `/whatsapp/connect` → `connect_account`
  (`whatsapp_service.py:61`). The skip is fully reversible.

## Risks / edge cases

| Case | Handling |
|---|---|
| Skip pressed twice | Idempotent endpoint; `SKIPPED` → `SKIPPED`. |
| Tenant already `CONNECTED` | Guard at service step 2 prevents downgrade. Return current status. |
| `fetchConfig()` failed (`config === null`) | Skip button must render regardless of `config`/`isLiveConfigured` — it does, being outside the ternary. |
| Merchant reloads mid-flow | `AuthContext.initAuth` re-reads tenant status from `/auth/me` (`AuthContext.tsx:76-83`), so `ACTIVE` survives refresh. Note `initAuth` only fetches full `/tenants/current` when status is `ACTIVE` (`:88`) — which is now satisfied. |
| Meta OAuth code still in URL | Skip is only reachable in `step === 'ready'`; `codeHandledRef` (`:63`, `:87`) already guards the auto-complete path. |
| Demo/seed tenants | Untouched — `seed.py:200,506` create `CONNECTED` rows. |

## Validation

1. `cd frontend; npm run build` — this is the only typecheck (`tsc -b && vite build`); there is no
   lint script. Must pass clean.
2. `cd backend; python -c "import app.main"` — confirms no import/syntax break in the service and router.
3. Manual, sandbox mode (no `META_APP_ID`, so `is_mock_app` is true):
   - Register a new merchant → `/waiting` → admin approves → lands on `/onboarding/whatsapp`
   - Click `Skip for now` → label becomes `Confirm skip`; click Cancel → back to idle, no network call
   - Confirm skip → lands on `/app/dashboard`; reload → stays on `/app`
   - Navbar pill reads `WhatsApp Not Connected`
   - `/app/campaigns` shows the amber banner
   - `GET /api/v1/onboarding/status` now returns `tenant_status: "ACTIVE"`,
     `whatsapp_connected: false`, `has_active_onboarding_session: false`
   - `/app/whatsapp` shows `Ready to Link`; completing the manual form flips the row to `CONNECTED`
     and the pill back to `WhatsApp Connected`
4. Repeat in live-configured mode to confirm the skip button renders identically below the
   `Launch Meta Embedded Popup` / `Open Meta-Hosted Signup Page` stack.
5. Negative path: stop the backend, press skip → error banner on the step, no redirect.