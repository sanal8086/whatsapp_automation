from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import httpx
import uuid
from app.core.config import settings
from app.core.crypto import decrypt_secret

class WhatsAppProvider(ABC):
    @abstractmethod
    def send_template_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        template_name: str,
        language_code: str = "en",
        components: Optional[list] = None
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def send_text_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        text: str
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def send_interactive_buttons(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        body_text: str,
        buttons: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def sync_templates(self, waba_id: str, access_token: str) -> list:
        pass

    @abstractmethod
    def register_phone(self, phone_number_id: str, access_token: str, pin: str = "123456") -> Dict[str, Any]:
        pass

    @abstractmethod
    def subscribe_waba_webhooks(self, waba_id: str, access_token: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def exchange_embedded_signup_code(self, client_id: str, client_secret: str, code: str) -> Dict[str, Any]:
        pass


class MetaCloudApiProvider(WhatsAppProvider):
    """
    Official Meta WhatsApp Cloud API Provider (Graph API v22.0).
    Communicates securely with graph.facebook.com for message sending,
    webhook configuration, phone registration, and template synchronization.
    """
    def __init__(self, api_version: str = "v22.0"):
        self.api_version = api_version
        self.base_url = f"https://graph.facebook.com/{api_version}"

    def _resolve_token(self, token: str) -> str:
        return decrypt_secret(token)

    def send_template_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        template_name: str,
        language_code: str = "en",
        components: Optional[list] = None
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/{phone_number_id}/messages"
        clean_token = self._resolve_token(access_token)
        headers = {
            "Authorization": f"Bearer {clean_token}",
            "Content-Type": "application/json"
        }
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or []
            }
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                data = res.json()
                if res.status_code >= 400:
                    return {
                        "error": True,
                        "status_code": res.status_code,
                        "message": data.get("error", {}).get("message", "Meta API Error"),
                        "details": data
                    }
                return data
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def send_text_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        text: str
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/{phone_number_id}/messages"
        clean_token = self._resolve_token(access_token)
        headers = {
            "Authorization": f"Bearer {clean_token}",
            "Content-Type": "application/json"
        }
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {"preview_url": False, "body": text}
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                data = res.json()
                if res.status_code >= 400:
                    return {
                        "error": True,
                        "status_code": res.status_code,
                        "message": data.get("error", {}).get("message", "Meta API Error"),
                        "details": data
                    }
                return data
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def send_interactive_buttons(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        body_text: str,
        buttons: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/{phone_number_id}/messages"
        clean_token = self._resolve_token(access_token)
        headers = {
            "Authorization": f"Bearer {clean_token}",
            "Content-Type": "application/json"
        }
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")

        action_buttons = []
        for idx, btn in enumerate(buttons[:3]): # WhatsApp allows max 3 quick-reply buttons
            action_buttons.append({
                "type": "reply",
                "reply": {
                    "id": btn.get("id", f"btn_{idx}"),
                    "title": btn.get("title", "Click Here")[:20]
                }
            })

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text},
                "action": {"buttons": action_buttons}
            }
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                return res.json()
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def sync_templates(self, waba_id: str, access_token: str) -> list:
        url = f"{self.base_url}/{waba_id}/message_templates"
        clean_token = self._resolve_token(access_token)
        headers = {"Authorization": f"Bearer {clean_token}"}
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.json().get("data", [])
                return []
        except httpx.HTTPError:
            return []

    def register_phone(self, phone_number_id: str, access_token: str, pin: str = "123456") -> Dict[str, Any]:
        """Registers a phone number on WhatsApp Cloud API after onboarding"""
        url = f"{self.base_url}/{phone_number_id}/register"
        clean_token = self._resolve_token(access_token)
        headers = {
            "Authorization": f"Bearer {clean_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "pin": pin
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                return res.json()
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def subscribe_waba_webhooks(self, waba_id: str, access_token: str) -> Dict[str, Any]:
        """Subscribes the platform app to receive WABA webhook events"""
        url = f"{self.base_url}/{waba_id}/subscribed_apps"
        clean_token = self._resolve_token(access_token)
        headers = {"Authorization": f"Bearer {clean_token}"}
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, headers=headers)
                return res.json()
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def exchange_embedded_signup_code(self, client_id: str, client_secret: str, code: str) -> Dict[str, Any]:
        """Exchanges Meta Embedded Signup authorization code for a business system user token"""
        url = f"{self.base_url}/oauth/access_token"
        params = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, params=params)
                return res.json()
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}


class MockSandboxWhatsAppProvider(WhatsAppProvider):
    """
    High-fidelity local sandbox provider:
    Simulates successful Meta API responses with real provider message IDs
    and allows complete end-to-end testing without external network dependencies.
    """
    def send_template_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        template_name: str,
        language_code: str = "en",
        components: Optional[list] = None
    ) -> Dict[str, Any]:
        msg_id = f"wamid.mock_{uuid.uuid4().hex[:16]}"
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        return {
            "messaging_product": "whatsapp",
            "contacts": [{"input": clean_phone, "wa_id": clean_phone}],
            "messages": [{"id": msg_id, "message_status": "accepted"}],
            "sandbox_simulated": True
        }

    def send_text_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        text: str
    ) -> Dict[str, Any]:
        msg_id = f"wamid.mock_{uuid.uuid4().hex[:16]}"
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        return {
            "messaging_product": "whatsapp",
            "contacts": [{"input": clean_phone, "wa_id": clean_phone}],
            "messages": [{"id": msg_id, "message_status": "accepted"}],
            "sandbox_simulated": True
        }

    def send_interactive_buttons(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        body_text: str,
        buttons: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        msg_id = f"wamid.mock_{uuid.uuid4().hex[:16]}"
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        return {
            "messaging_product": "whatsapp",
            "contacts": [{"input": clean_phone, "wa_id": clean_phone}],
            "messages": [{"id": msg_id, "message_status": "accepted"}],
            "sandbox_simulated": True
        }

    def sync_templates(self, waba_id: str, access_token: str) -> list:
        return [
            {
                "id": "mock_tpl_points",
                "name": "loyalty_points_earned",
                "status": "APPROVED",
                "category": "UTILITY",
                "language": "en"
            },
            {
                "id": "mock_tpl_winback",
                "name": "win_back_offer",
                "status": "APPROVED",
                "category": "MARKETING",
                "language": "en"
            },
            {
                "id": "mock_tpl_birthday",
                "name": "birthday_special",
                "status": "APPROVED",
                "category": "MARKETING",
                "language": "en"
            },
            {
                "id": "mock_tpl_welcome",
                "name": "welcome_loyalty",
                "status": "APPROVED",
                "category": "UTILITY",
                "language": "en"
            }
        ]

    def register_phone(self, phone_number_id: str, access_token: str, pin: str = "123456") -> Dict[str, Any]:
        return {"success": True, "sandbox_simulated": True}

    def subscribe_waba_webhooks(self, waba_id: str, access_token: str) -> Dict[str, Any]:
        return {"success": True, "sandbox_simulated": True}

    def exchange_embedded_signup_code(self, client_id: str, client_secret: str, code: str) -> Dict[str, Any]:
        return {
            "access_token": f"mock_live_token_{uuid.uuid4().hex[:20]}",
            "token_type": "bearer",
            "expires_in": 5184000,
            "sandbox_simulated": True
        }


def get_whatsapp_provider(use_live: bool = False, access_token: Optional[str] = None) -> WhatsAppProvider:
    """
    Intelligent provider selector:
    Routes to MetaCloudApiProvider (v22.0) when live mode is configured or live token provided;
    falls back cleanly to MockSandboxWhatsAppProvider for frictionless development and sandbox testing.
    """
    resolved_token = decrypt_secret(access_token or "")
    if use_live or settings.USE_LIVE_WHATSAPP or (resolved_token and resolved_token.startswith("EAA")):
        return MetaCloudApiProvider(api_version=settings.META_GRAPH_API_VERSION)
    return MockSandboxWhatsAppProvider()
