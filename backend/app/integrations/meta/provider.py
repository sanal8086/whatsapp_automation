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
    def exchange_embedded_signup_code(self, client_id: str, client_secret: str, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        pass

    @abstractmethod
    def debug_token(self, input_token: str, app_id: str, app_secret: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def get_phone_numbers(self, waba_id: str, access_token: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_phone_number_details(self, phone_number_id: str, access_token: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def get_waba_info(self, waba_id: str, access_token: str) -> Dict[str, Any]:
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

        # hello_world is Meta's universal default template: requires en_US and NO components
        if template_name.lower() == "hello_world":
            language_code = "en_US"
            components = None

        template_payload: Dict[str, Any] = {
            "name": template_name,
            "language": {"code": language_code}
        }
        if components:
            template_payload["components"] = components

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "template",
            "template": template_payload
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                data = res.json()
                if res.status_code >= 400:
                    err = data.get("error", {})
                    err_code = err.get("code")
                    err_subcode = err.get("error_subcode")
                    base_msg = err.get("error_user_msg") or err.get("message") or "Meta API Error"
                    
                    # Provide actionable guidance for common Meta Cloud API demo issues
                    hint = ""
                    if err_code == 131030:
                        hint = " (Meta Sandbox restriction: recipient number is not verified in Meta App > WhatsApp > API Setup > To Phone Numbers)"
                    elif err_code == 190:
                        hint = " (Meta Access Token is invalid or expired. Please generate a new System User token)"
                    elif err_code == 100 and "template" in base_msg.lower():
                        hint = " (Template not found in this language. Recommended: use 'hello_world' or sync approved templates from your WABA)"
                    elif err_code == 131047:
                        hint = " (24-hour customer messaging window expired. Use an approved template to re-engage)"

                    full_msg = f"{base_msg}{hint}"
                    return {
                        "error": True,
                        "status_code": res.status_code,
                        "code": err_code,
                        "subcode": err_subcode,
                        "message": full_msg,
                        "details": data
                    }
                return data
        except httpx.HTTPError as exc:
            return {"error": True, "message": f"Network error contacting Meta: {str(exc)}"}

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

    def exchange_embedded_signup_code(self, client_id: str, client_secret: str, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        """Exchanges Meta Embedded Signup authorization code for a business system user token"""
        url = f"{self.base_url}/oauth/access_token"
        params = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        }
        if redirect_uri:
            params["redirect_uri"] = redirect_uri
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, params=params)
                return res.json()
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def debug_token(self, input_token: str, app_id: str, app_secret: str) -> Dict[str, Any]:
        """Debugs and inspects access token permissions, granular scopes, and target IDs"""
        url = "https://graph.facebook.com/debug_token"
        clean_input = self._resolve_token(input_token)
        params = {
            "input_token": clean_input,
            "access_token": f"{app_id}|{app_secret}"
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, params=params)
                return res.json()
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def get_phone_numbers(self, waba_id: str, access_token: str) -> List[Dict[str, Any]]:
        """Retrieves phone numbers registered under a WhatsApp Business Account"""
        url = f"{self.base_url}/{waba_id}/phone_numbers"
        clean_token = self._resolve_token(access_token)
        headers = {"Authorization": f"Bearer {clean_token}"}
        params = {"fields": "id,display_phone_number,verified_name,quality_rating,code_verification_status"}
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    return res.json().get("data", [])
                return []
        except httpx.HTTPError:
            return []

    def get_phone_number_details(self, phone_number_id: str, access_token: str) -> Dict[str, Any]:
        """Fetches details for a single WhatsApp Phone Number ID from Meta Graph API"""
        url = f"{self.base_url}/{phone_number_id}"
        clean_token = self._resolve_token(access_token)
        headers = {"Authorization": f"Bearer {clean_token}"}
        params = {"fields": "id,display_phone_number,verified_name,quality_rating,code_verification_status"}
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, headers=headers, params=params)
                return res.json()
        except httpx.HTTPError as exc:
            return {"error": True, "message": str(exc)}

    def get_waba_info(self, waba_id: str, access_token: str) -> Dict[str, Any]:
        """Retrieves verified details of a WhatsApp Business Account"""
        url = f"{self.base_url}/{waba_id}"
        clean_token = self._resolve_token(access_token)
        headers = {"Authorization": f"Bearer {clean_token}"}
        params = {"fields": "id,name,currency,timezone_id,account_review_status"}
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, headers=headers, params=params)
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

    def exchange_embedded_signup_code(self, client_id: str, client_secret: str, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        return {
            "access_token": f"mock_live_token_{uuid.uuid4().hex[:20]}",
            "token_type": "bearer",
            "expires_in": 5184000,
            "sandbox_simulated": True
        }

    def debug_token(self, input_token: str, app_id: str, app_secret: str) -> Dict[str, Any]:
        return {
            "data": {
                "app_id": app_id,
                "is_valid": True,
                "scopes": ["whatsapp_business_management", "whatsapp_business_messaging"],
                "granular_scopes": [{"scope": "whatsapp_business_management", "target_ids": ["mock_waba_123456"]}],
                "sandbox_simulated": True
            }
        }

    def get_phone_numbers(self, waba_id: str, access_token: str) -> List[Dict[str, Any]]:
        return [{
            "id": f"pn_mock_{uuid.uuid4().hex[:10]}",
            "display_phone_number": "+91 98765 43210",
            "verified_name": "GoAgain Merchant Store",
            "quality_rating": "GREEN",
            "code_verification_status": "VERIFIED"
        }]

    def get_phone_number_details(self, phone_number_id: str, access_token: str) -> Dict[str, Any]:
        return {
            "id": phone_number_id,
            "display_phone_number": "+91 98765 43210",
            "verified_name": "Demo Store",
            "quality_rating": "GREEN",
            "code_verification_status": "VERIFIED"
        }

    def get_waba_info(self, waba_id: str, access_token: str) -> Dict[str, Any]:
        return {
            "id": waba_id,
            "name": "GoAgain Demo Merchant WABA",
            "currency": "INR",
            "timezone_id": "Asia/Kolkata",
            "account_review_status": "APPROVED"
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
