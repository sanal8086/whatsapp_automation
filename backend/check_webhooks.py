import sqlite3
import json

con = sqlite3.connect("loyalty_saas.db")
con.row_factory = sqlite3.Row

print("--- recent webhook status events ---")
rows = con.execute(
    "SELECT external_event_id, payload_json, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 15"
).fetchall()
for r in rows:
    p = json.loads(r["payload_json"])
    for entry in p.get("entry", []):
        for ch in entry.get("changes", []):
            for st in ch.get("value", {}).get("statuses", []):
                print(r["created_at"], "|", st.get("id"), "->", st.get("status"),
                      "|", json.dumps(st.get("errors", []))[:200])

print("--- message status by provider_message_id ---")
for r in con.execute(
    "SELECT provider_message_id, status, failure_reason, campaign_id, created_at FROM whatsapp_messages ORDER BY created_at DESC LIMIT 8"
):
    print(dict(r))
