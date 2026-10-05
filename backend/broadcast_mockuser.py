#!/usr/bin/env python3
"""
broadcast_mockuser.py
---------------------
Utility to send and broadcast WhatsApp template messages to customers
from the GoAgain Mock User setup using Meta Cloud API.

Equivalent curl command:
  curl --request POST \
    --url https://graph.facebook.com/v25.0/1380171298507513/messages \
    --header 'Authorization: Bearer {token}' \
    --header 'Content-Type: application/json' \
    --data '{
    "messaging_product": "whatsapp",
    "to": "918590102027",
    "type": "template",
    "template": {
      "name": "reminderpet ",
      "language": { "code": "en_US" }
    }
  }'

Usage examples:
  # 1. Send single message:
  python broadcast_mockuser.py --token "YOUR_META_TOKEN" --to "918590102027"

  # 2. Broadcast to all mock user customers in DB:
  python broadcast_mockuser.py --token "YOUR_META_TOKEN" --broadcast

  # 3. Import in Python:
  from broadcast_mockuser import send_whatsapp_template_message, broadcast_mockuser_customers
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, Optional, List
import httpx

# Ensure backend root is on sys.path for DB and model access
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

DEFAULT_PHONE_NUMBER_ID = "1380171298507513"
DEFAULT_TEMPLATE_NAME = "welcomepets"
DEFAULT_LANGUAGE_CODE = "en_US"
DEFAULT_API_VERSION = "v26.0"
DEFAULT_TO_PHONE = "918590102027"


def send_whatsapp_template_message(
    token: str,
    to_phone: str = DEFAULT_TO_PHONE,
    phone_number_id: str = DEFAULT_PHONE_NUMBER_ID,
    template_name: str = DEFAULT_TEMPLATE_NAME,
    language_code: str = DEFAULT_LANGUAGE_CODE,
    api_version: str = DEFAULT_API_VERSION
) -> Dict[str, Any]:
    """
    Sends a WhatsApp template message via Meta Graph API matching:
    POST https://graph.facebook.com/{api_version}/{phone_number_id}/messages
    """
    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
    
    # Clean token (unwrap quotes or 'enc:' prefixes if any)
    clean_token = token.strip()
    if clean_token.startswith("enc:"):
        from app.core.crypto import decrypt_secret
        clean_token = decrypt_secret(clean_token)

    headers = {
        "Authorization": f"Bearer {clean_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": language_code
            }
        }
    }

    print(f"[INFO] POST {url}")
    print(f"[INFO] Sending template '{template_name}' ({language_code}) to: {clean_phone}")

    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(url, json=payload, headers=headers)
            try:
                data = res.json()
            except Exception:
                data = {"status_code": res.status_code, "raw_response": res.text}
            return data
    except Exception as exc:
        return {"error": str(exc), "message": f"HTTP request failed: {str(exc)}"}


def broadcast_mockuser_customers(
    token: str,
    phone_number_id: str = DEFAULT_PHONE_NUMBER_ID,
    template_name: str = DEFAULT_TEMPLATE_NAME,
    language_code: str = DEFAULT_LANGUAGE_CODE,
    api_version: str = DEFAULT_API_VERSION,
    tenant_slug: str = "goagain-demo",
    extra_phone_numbers: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Broadcasts the template message to all customers under the mock user setup
    (tenant 'goagain-demo') plus any extra phone numbers (like 918590102027).
    """
    try:
        from app.core.database import SessionLocal
        from app.services.whatsapp_service import WhatsAppService
        db = SessionLocal()
        try:
            return WhatsAppService.broadcast_to_mockuser_customers(
                db=db,
                token=token,
                phone_number_id=phone_number_id,
                template_name=template_name,
                language_code=language_code,
                api_version=api_version,
                tenant_slug=tenant_slug,
                extra_phone_numbers=extra_phone_numbers
            )
        finally:
            db.close()
    except Exception as exc:
        print(f"[WARN] Database lookup failed ({exc}); falling back to direct recipients broadcast.")
        # Standalone fallback without DB
        recipients = list(set([DEFAULT_TO_PHONE] + (extra_phone_numbers or [])))
        results = []
        sent = 0
        failed = 0
        for p in recipients:
            res = send_whatsapp_template_message(
                token=token,
                to_phone=p,
                phone_number_id=phone_number_id,
                template_name=template_name,
                language_code=language_code,
                api_version=api_version
            )
            ok = "messages" in res and bool(res["messages"])
            if ok:
                sent += 1
            else:
                failed += 1
            results.append({"phone": p, "success": ok, "response": res})
        return {
            "total_recipients": len(recipients),
            "sent_count": sent,
            "failed_count": failed,
            "results": results
        }


def main():
    parser = argparse.ArgumentParser(description="Send or broadcast WhatsApp template messages to customers")
    parser.add_argument("--token", "-t", type=str, default=os.getenv("META_WHATSAPP_TOKEN", ""), help="Meta WhatsApp Bearer token")
    parser.add_argument("--to", "-p", type=str, default=DEFAULT_TO_PHONE, help=f"Recipient phone number (default: {DEFAULT_TO_PHONE})")
    parser.add_argument("--phone-id", type=str, default=DEFAULT_PHONE_NUMBER_ID, help=f"Meta Phone Number ID (default: {DEFAULT_PHONE_NUMBER_ID})")
    parser.add_argument("--template", type=str, default=DEFAULT_TEMPLATE_NAME, help=f"Template name (default: '{DEFAULT_TEMPLATE_NAME}')")
    parser.add_argument("--lang", type=str, default=DEFAULT_LANGUAGE_CODE, help=f"Language code (default: '{DEFAULT_LANGUAGE_CODE}')")
    parser.add_argument("--api-version", type=str, default=DEFAULT_API_VERSION, help=f"Graph API version (default: '{DEFAULT_API_VERSION}')")
    parser.add_argument("--broadcast", action="store_true", help="Broadcast to all customers from mockuser setup in DB")

    args = parser.parse_args()

    if not args.token:
        print("[ERROR] Please provide a valid Meta access token with --token or set META_WHATSAPP_TOKEN environment variable.")
        sys.exit(1)

    if args.broadcast:
        print(f"[INFO] Initiating broadcast to mock user setup customers using template '{args.template}'...")
        res = broadcast_mockuser_customers(
            token=args.token,
            phone_number_id=args.phone_id,
            template_name=args.template,
            language_code=args.lang,
            api_version=args.api_version,
            extra_phone_numbers=[args.to]
        )
    else:
        print(f"[INFO] Sending single template message to {args.to}...")
        res = send_whatsapp_template_message(
            token=args.token,
            to_phone=args.to,
            phone_number_id=args.phone_id,
            template_name=args.template,
            language_code=args.lang,
            api_version=args.api_version
        )

    print("\n--- Meta Graph API Response ---")
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
