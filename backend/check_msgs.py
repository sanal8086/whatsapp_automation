import sqlite3

con = sqlite3.connect("loyalty_saas.db")
con.row_factory = sqlite3.Row

print("--- last 5 whatsapp_messages ---")
for r in con.execute(
    "SELECT recipient_phone, status, failure_reason, campaign_id, customer_id, created_at "
    "FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5"
):
    print(dict(r))

print("--- last 3 campaigns ---")
for r in con.execute(
    "SELECT id, name, status, recipients_count, sent_count, failed_count, created_at FROM campaigns ORDER BY created_at DESC LIMIT 3"
):
    print(dict(r))

print("--- campaign recipients detail ---")
for r in con.execute(
    "SELECT cr.campaign_id, cr.status, cr.error_message, c.first_name, c.phone, c.phone_normalized "
    "FROM campaign_recipients cr JOIN customers c ON c.id = cr.customer_id "
    "ORDER BY cr.rowid DESC LIMIT 5"
):
    print(dict(r))
