from fastapi import APIRouter, Depends, Request, Response, Query, HTTPException, status
from sqlalchemy.orm import Session
import json

from app.core.database import get_db
from app.core.config import settings
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/webhooks/meta", tags=["Meta Webhooks"])

@router.get("/whatsapp")
def verify_meta_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token")
):
    """
    Official Meta webhook verification endpoint:
    Returns the challenge code if hub.mode is subscribe and hub_verify_token matches configured secret.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@router.post("/whatsapp")
async def receive_meta_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Central Meta WhatsApp webhook event ingestion:
    1. Validates X-Hub-Signature-256 HMAC-SHA256 signature
    2. Decodes payload
    3. Triggers status updates & handles incoming customer messages
    4. Returns HTTP 200 OK immediately for Meta idempotency
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    # In live mode or if signature is sent, verify signature
    if settings.USE_LIVE_WHATSAPP and signature:
        is_valid = WhatsAppService.verify_webhook_signature(raw_body, signature)
        if not is_valid:
            raise HTTPException(status_code=403, detail="Invalid HMAC signature")

    try:
        body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        body = {}

    external_event_id = signature or str(hash(json.dumps(body, sort_keys=True)))
    result = WhatsAppService.process_webhook(db, body, external_event_id)
    return {"status": "ok", "result": result}
