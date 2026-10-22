"""
NOTE: [DEMO] Demo WhatsApp send handler for Wervus Cafe client showcase.
This module is temporary and intended for client demonstration purposes only.
Remove this file and all references before production deployment.
"""
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.core.config import settings

def send_wervus_demo_whatsapp(
    db: Session,
    to_phone: str,
    template_name: Optional[str] = None,
    language_code: str = "en",
    components: Optional[List[Dict[str, Any]]] = None,
    phone_number_id: str = "1380171298507513",
    access_token: Optional[str] = None,
    custom_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Demo WhatsApp dispatch function for tenant 'wervus-cafe'.
    Currently simulated stub that prints logs and returns a provider-compliant dictionary.
    Consumes settings.WERVUS_DEMO_* so future real Meta Cloud API dispatch needs no signature changes.
    """
    token = access_token or settings.WERVUS_DEMO_WHATSAPP_TOKEN
    pid = phone_number_id or settings.WERVUS_DEMO_PHONE_NUMBER_ID
    tpl = template_name or settings.WERVUS_DEMO_TEMPLATE_NAME
    lang = language_code or settings.WERVUS_DEMO_LANGUAGE_CODE

    clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")

    print(
        f"[DEMO] send_wervus_demo_whatsapp called:\n"
        f"  to_phone: {to_phone} (clean: {clean_phone})\n"
        f"  template_name: {tpl}\n"
        f"  language_code: {lang}\n"
        f"  components: {components}\n"
        f"  custom_text: {custom_text}\n"
        f"  phone_number_id: {pid}\n"
        f"  token_configured: {bool(token)}"
    )

    demo_msg_id = f"wamid.demo_{uuid.uuid4().hex[:16]}"
    return {
        "messaging_product": "whatsapp",
        "contacts": [{"input": clean_phone, "wa_id": clean_phone}],
        "messages": [
            {
                "id": demo_msg_id,
                "message_status": "sent"
            }
        ],
        "demo_simulated": True
    }
