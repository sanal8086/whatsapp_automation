from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import uuid
import hashlib

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant
from app.models.models import (
    User, Tenant, TenantMember, WhatsAppOnboardingSession, WhatsAppConnection
)
from app.core.config import settings

router = APIRouter(prefix="/onboarding", tags=["Shop Onboarding"])


@router.get("/status")
def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the current onboarding status for the user's tenant.
    Called by the waiting page refresh button and on login to determine routing.
    """
    membership = db.query(TenantMember).filter(
        TenantMember.user_id == current_user.id,
        TenantMember.status == "ACTIVE"
    ).first()

    if not membership:
        raise HTTPException(status_code=404, detail="No business found for this user")

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")

    # Check for any active WA onboarding sessions
    active_session = db.query(WhatsAppOnboardingSession).filter(
        WhatsAppOnboardingSession.tenant_id == tenant.id,
        WhatsAppOnboardingSession.status.in_(["CREATED", "IN_PROGRESS"])
    ).first()

    # Check if WA connection already exists
    wa_connection = db.query(WhatsAppConnection).filter(
        WhatsAppConnection.tenant_id == tenant.id
    ).first()

    wa_connected = wa_connection is not None and wa_connection.connection_status == "CONNECTED"

    return {
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
        "tenant_status": tenant.status,
        "whatsapp_connected": wa_connected,
        "has_active_onboarding_session": active_session is not None,
        "onboarding_session_status": active_session.status if active_session else None,
    }


@router.post("/whatsapp-signup/start")
def start_whatsapp_signup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiates a WhatsApp Embedded Signup session. Only available after admin approval.
    Creates a session with 24h expiry. Expires any previous active sessions.
    """
    membership = db.query(TenantMember).filter(
        TenantMember.user_id == current_user.id,
        TenantMember.status == "ACTIVE"
    ).first()

    if not membership:
        raise HTTPException(status_code=404, detail="No business found for this user")

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")

    if tenant.status not in ("APPROVED", "ACTIVE"):
        raise HTTPException(
            status_code=403,
            detail="Your business must be approved before connecting WhatsApp"
        )

    # Expire any previous active sessions for this tenant
    old_sessions = db.query(WhatsAppOnboardingSession).filter(
        WhatsAppOnboardingSession.tenant_id == tenant.id,
        WhatsAppOnboardingSession.status.in_(["CREATED", "IN_PROGRESS"])
    ).all()
    for s in old_sessions:
        s.status = "EXPIRED"

    # Generate a unique state for the OAuth flow
    state = str(uuid.uuid4())
    state_hash = hashlib.sha256(state.encode()).hexdigest()

    session = WhatsAppOnboardingSession(
        tenant_id=tenant.id,
        state_hash=state_hash,
        status="CREATED",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "state": state,
        "app_id": settings.META_APP_ID,
        "config_id": settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID or "",
        "graph_version": settings.META_GRAPH_API_VERSION,
    }


@router.post("/whatsapp-signup/complete")
def complete_whatsapp_signup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    MOCK endpoint — simulates completing the WhatsApp Embedded Signup.
    In production, this would receive the OAuth callback code from Meta
    and exchange it for WABA credentials. Here we generate mock data.
    """
    membership = db.query(TenantMember).filter(
        TenantMember.user_id == current_user.id,
        TenantMember.status == "ACTIVE"
    ).first()

    if not membership:
        raise HTTPException(status_code=404, detail="No business found")

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")

    if tenant.status not in ("APPROVED", "ACTIVE"):
        raise HTTPException(status_code=403, detail="Business not approved")

    # Find the active onboarding session
    session = db.query(WhatsAppOnboardingSession).filter(
        WhatsAppOnboardingSession.tenant_id == tenant.id,
        WhatsAppOnboardingSession.status.in_(["CREATED", "IN_PROGRESS"])
    ).first()

    if not session:
        raise HTTPException(status_code=400, detail="No active onboarding session found. Please restart.")

    # Check expiry
    expires_at = session.expires_at
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            session.status = "EXPIRED"
            db.commit()
            raise HTTPException(status_code=400, detail="Session expired. Please restart the signup process.")

    # --- MOCK: Generate fake WhatsApp credentials ---
    mock_waba_id = f"waba_{uuid.uuid4().hex[:12]}"
    mock_phone_number_id = f"pn_{uuid.uuid4().hex[:12]}"
    mock_meta_business_id = f"mb_{uuid.uuid4().hex[:12]}"
    mock_display_phone = f"+91 {uuid.uuid4().int % 9000000000 + 1000000000}"

    # Update onboarding session
    session.status = "COMPLETED"
    session.waba_id = mock_waba_id
    session.phone_number_id = mock_phone_number_id
    session.meta_business_id = mock_meta_business_id
    session.completed_at = datetime.now(timezone.utc)

    # Create or update the WhatsApp connection for this tenant
    conn = db.query(WhatsAppConnection).filter(
        WhatsAppConnection.tenant_id == tenant.id
    ).first()

    if conn:
        conn.meta_business_id = mock_meta_business_id
        conn.waba_id = mock_waba_id
        conn.phone_number_id = mock_phone_number_id
        conn.display_phone_number = mock_display_phone
        conn.verified_name = tenant.name
        conn.connection_status = "CONNECTED"
        conn.access_token_encrypted = f"mock_encrypted_token_{uuid.uuid4().hex[:16]}"
        conn.connected_at = datetime.now(timezone.utc)
    else:
        conn = WhatsAppConnection(
            tenant_id=tenant.id,
            meta_business_id=mock_meta_business_id,
            waba_id=mock_waba_id,
            phone_number_id=mock_phone_number_id,
            display_phone_number=mock_display_phone,
            verified_name=tenant.name,
            connection_status="CONNECTED",
            business_verification_status="VERIFIED",
            phone_verification_status="VERIFIED",
            access_token_encrypted=f"mock_encrypted_token_{uuid.uuid4().hex[:16]}",
            is_live_mode=False,
            quality_rating="GREEN",
            connected_at=datetime.now(timezone.utc)
        )
        db.add(conn)

    # Transition tenant to ACTIVE — onboarding is fully complete
    tenant.status = "ACTIVE"

    db.commit()
    db.refresh(tenant)

    return {
        "status": "success",
        "tenant_status": tenant.status,
        "whatsapp": {
            "waba_id": mock_waba_id,
            "phone_number_id": mock_phone_number_id,
            "display_phone_number": mock_display_phone,
            "verified_name": tenant.name,
            "connection_status": "CONNECTED"
        }
    }
