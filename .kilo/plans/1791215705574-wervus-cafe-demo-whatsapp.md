# Plan: Wervus Cafe Mock User + Demo WhatsApp Send Path

## Goal
Add a new client-demo mock user ("Wervus Cafe") and a separate demo WhatsApp send function. When a message is sent and the active tenant's slug is `wervus-cafe`, route the provider call through the new demo function. Keep it removable via NOTE comments (no env kill-switch).

## Decisions (all resolved)
- **Routing check**: `tenant.slug == "wervus-cafe"` inside `WhatsAppService.send_single_message` (single funnel for `/send-test`, `/broadcast-client-demo`, and automations).
- **Demo function**: new file `backend/app/services/demo_whatsapp.py`, `send_wervus_demo_whatsapp(...)`. Logs a print now; later filled to call Meta Cloud API with live credentials read from backend env. Returns a provider-shaped dict so `send_single_message` can consume it unchanged.
- **Production removal**: NOTE comments only — no env flag.
- Credentials for the demo function come from env via `Settings` (`WERVUS_DEMO_*` keys).

## Affected files
| File | Change |
|---|---|
| `backend/app/core/config.py` | Add `WERVUS_DEMO_WHATSAPP_TOKEN`, `WERVUS_DEMO_PHONE_NUMBER_ID`, `WERVUS_DEMO_TEMPLATE_NAME`, `WERVUS_DEMO_LANGUAGE_CODE`, `WERVUS_DEMO_API_VERSION`, `WERVUS_DEMO_ENABLED` to `Settings` (env-driven, defaults). |
| `backend/.env` | Add commented `WERVUS_DEMO_*` entries with NOTE (do not set real values now). |
| `backend/.env.example` | Mirror commented entries. |
| `backend/app/services/demo_whatsapp.py` | NEW. Define `send_wervus_demo_whatsapp(db, to_phone, template_name, language_code, components, phone_number_id, access_token) -> Dict[str, Any]`. Stub now (print logs + simulated response). NOTE: demo-only, remove before production. |
| `backend/app/services/whatsapp_service.py` | In `send_single_message`, after wallet debit (line 348) and before provider call (line 350): branch on `tenant.slug == "wervus-cafe"` → call demo function; else current `get_whatsapp_provider(...)` path. NOTE comments around the branch. |
| `backend/app/seed.py` | Add "6. Wervus Cafe Demo User" block after the `goagain-demo` block (after line 581, before `db.commit()` at 583). Mirror the mock-user pattern. |

## Mock user spec (Wervus Cafe)
- `User`: email `demo@wervus.cafe`, name "Wervus Cafe Owner", phone `+919999910000`, password_hash `get_password_hash("demo123")`, `is_platform_admin=False`.
- `Tenant`: name "Wervus Cafe", slug `wervus-cafe`, business_type "Cafe & Bakery", country "India", currency "INR", status "ACTIVE", subscription_status "ACTIVE".
- `TenantMember`: role "OWNER".
- `Subscription`: GROWTH plan, amount 2499, payment_status "MANUAL_VERIFIED".
- `Wallet`: balance 10000 (DEMO_PRELOAD), NOTE'd as demo.
- `WhatsAppConnection`: CONNECTED, live mode placeholder token (`access_token_encrypted=""`), phone_number_id "1380171298507513" (same demo number), waba "waba_wervus_demo". Status CONNECTED so `send_single_message` guard passes; real send uses env token per user.
- Provision platform templates for the tenant.
- `LoyaltyProgram` + `Segment` + one demo `Customer` (`Abin Pet Care`, `+918590102027`, whatsapp_consent=True) with a `CustomerLoyaltyAccount` (GOLD) and a `LoyaltyTransaction(EARN)`.

## Data flow
1. Client hits `/api/v1/whatsapp/send-test` (or broadcast-client-demo) authenticated to the Wervus Cafe tenant (X-Tenant-ID header / AuthContext tenant_id == `wervus-cafe` tenant).
2. `send_test_message` → `WhatsAppService.send_single_message(db, tenant_id=tenant.id, to_phone=..., template_name=..., ...)`.
3. `send_single_message` resolves `conn` (CONNECTED ✓), `tenant`, `cost`, debits wallet, then branches: `tenant.slug == "wervus-cafe"` → `send_wervus_demo_whatsapp(...)`; else `get_whatsapp_provider(...).send_template_message(...)`.
4. Response is persisted to `WhatsAppMessage` (status SENT on success, etc.) exactly as before.

`send_wervus_demo_whatsapp` stub signature:
```
def send_wervus_demo_whatsapp(db, to_phone, template_name=None, language_code="en",
                              components=None, phone_number_id="1380171298507513",
                              access_token: Optional[str] = None) -> Dict[str, Any]
```
Stub body: `print("[DEMO] send_wervus_demo_whatsapp ...")`; return `{"messaging_product": "whatsapp", "messages": [{"id": "wamid.demo_<hex>", "message_status": "sent"}], "demo_simulated": True}`. Reads `settings.WERVUS_DEMO_*` for token/template/phone-number-id so future real call needs no signature change.

## Failure modes / notes
- Seed idempotency: guard with `db.query(User).filter(User.email == "demo@wervus.cafe").first()` like siblings.
- `send_single_message` requires `conn.connection_status == "CONNECTED"` (line 333) — seed Wervus conn as CONNECTED.
- Wallet debit still runs (PricingService cost) so dashboard reflects activity; the demo send itself is free (stub). NOTE.
- The branch is purely a `tenant.slug` comparison; safe to remove later.
- `backend/.env` has no `META_WHATSAPP_TOKEN` (the CLI uses it), confirming demo path should NOT depend on `.env` token presence.

## Validation (manual, since no test framework exists)
1. `python -m app.seed` (from `backend/`) — verify Wervus Cafe tenant + `demo@wervus.cafe` user created (db check).
2. Run backend: `python -m uvicorn app.main:app --reload`.
3. Log in as `demo@wervus.cafe` / `demo123`, set tenant `wervus-cafe`, POST `/api/v1/whatsapp/send-test` with `ClientDemoBroadcastRequest`-style body `{phone:"+918590102027", custom_text:"hi"}` (or use `/broadcast-client-demo`). Confirm `print` from demo function emits and `WhatsAppMessage` row has `status=SENT` + `message_type=TEXT`.
4. Grep `.env`/source for `wervus-cafe` and `send_wervus_demo_whatsapp` to confirm NOTE removal points.

## Out of scope
- Real Meta call implementation (deferred; env values not populated now).
- Frontend wiring (no demo button currently exists; `/broadcast-client-demo` is CLI/curl-only today).
- Database migration tooling (SQLite file DB already committed).
