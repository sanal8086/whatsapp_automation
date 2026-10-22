from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import httpx
import json
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

    @abstractmethod
    def upload_media(self, phone_number_id: str, access_token: str, file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
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
        print(f"\n[META_SEND] ===== LIVE Meta Cloud API template send =====", flush=True)
        print(f"[META_SEND] URL: {url}", flush=True)
        print(f"[META_SEND] phone_number_id (sender): {phone_number_id}", flush=True)
        print(f"[META_SEND] to (number received, raw): {to_phone!r}", flush=True)
        print(f"[META_SEND] to (number after cleaning): {clean_phone!r}", flush=True)
        print(f"[META_SEND] template name: {template_name!r} | language: {language_code}", flush=True)
        print(f"[META_SEND] components (msg variables): {json.dumps(components, ensure_ascii=False) if components else 'None'}", flush=True)
        if clean_token:
            print(f"[META_SEND] token (masked): {clean_token[:6]}...{clean_token[-4:]} (length={len(clean_token)})", flush=True)
        else:
            print(f"[META_SEND] token: EMPTY / failed to decrypt!", flush=True)
        print(f"[META_SEND] FULL payload being sent:\n{json.dumps(payload, ensure_ascii=False, indent=2)}", flush=True)
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                print(f"[META_SEND] HTTP status code: {res.status_code}", flush=True)
                print(f"[META_SEND] RAW response from Meta: {res.text}", flush=True)
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
                    print(f"[META_SEND] *** SEND FAILED *** code={err_code} subcode={err_subcode} message={full_msg}", flush=True)
                    print(f"[META_SEND] error details: {json.dumps(data, ensure_ascii=False)}", flush=True)
                    return {
                        "error": True,
                        "status_code": res.status_code,
                        "code": err_code,
                        "subcode": err_subcode,
                        "message": full_msg,
                        "details": data
                    }
                print(f"[META_SEND] *** SEND OK *** message_id={data.get('messages', [{}])[0].get('id')}", flush=True)
                return data
        except httpx.HTTPError as exc:
            print(f"[META_SEND] *** NETWORK ERROR contacting Meta: {exc}", flush=True)
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
        print(f"\n[META_SEND] ===== LIVE Meta Cloud API text send =====", flush=True)
        print(f"[META_SEND] URL: {url}", flush=True)
        print(f"[META_SEND] phone_number_id (sender): {phone_number_id}", flush=True)
        print(f"[META_SEND] to (number received, raw): {to_phone!r}", flush=True)
        print(f"[META_SEND] to (number after cleaning): {clean_phone!r}", flush=True)
        print(f"[META_SEND] text message: {text!r}", flush=True)
        if clean_token:
            print(f"[META_SEND] token (masked): {clean_token[:6]}...{clean_token[-4:]} (length={len(clean_token)})", flush=True)
        else:
            print(f"[META_SEND] token: EMPTY / failed to decrypt!", flush=True)
        print(f"[META_SEND] FULL payload being sent:\n{json.dumps(payload, ensure_ascii=False, indent=2)}", flush=True)
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                print(f"[META_SEND] HTTP status code: {res.status_code}", flush=True)
                print(f"[META_SEND] RAW response from Meta: {res.text}", flush=True)
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

    def upload_media(self, phone_number_id: str, access_token: str, file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        """Uploads a media file (e.g. template header image) and returns its Meta media id"""
        url = f"{self.base_url}/{phone_number_id}/media"
        clean_token = self._resolve_token(access_token)
        headers = {"Authorization": f"Bearer {clean_token}"}
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(
                    url,
                    headers=headers,
                    data={"messaging_product": "whatsapp", "file_type": mime_type},
                    files={"file": ("image", file_bytes, mime_type)}
                )
                print(f"[META_MEDIA] upload attempt phone_id={phone_number_id} type={mime_type} size={len(file_bytes)} -> HTTP {res.status_code}", flush=True)
                data = res.json()
                if res.status_code >= 400:
                    err = data.get("error", {})
                    return {
                        "error": True,
                        "status_code": res.status_code,
                        "message": err.get("error_user_msg") or err.get("message") or "Meta media upload failed",
                        "details": data
                    }
                return data
        except httpx.HTTPError as exc:
            return {"error": True, "message": f"Network error uploading media: {str(exc)}"}


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
        print(f"\n[MOCK_SEND] ***** WARNING: MOCK SANDBOX PROVIDER - TEMPLATE MESSAGE NOT ACTUALLY SENT TO WHATSAPP *****", flush=True)
        print(f"[MOCK_SEND] to (number received): {to_phone!r} -> cleaned: {clean_phone!r}", flush=True)
        print(f"[MOCK_SEND] template: {template_name!r} | language: {language_code}", flush=True)
        print(f"[MOCK_SEND] components (msg variables): {json.dumps(components, ensure_ascii=False) if components else 'None'}", flush=True)
        print(f"[MOCK_SEND] fake message_id: {msg_id} (no HTTP request was made to Meta)", flush=True)
        print(f"[MOCK_SEND] WHY MOCK? get_whatsapp_provider picked MockSandboxWhatsAppProvider (is_live_mode=False or token does not start with 'EAA' or USE_LIVE_WHATSAPP off)", flush=True)
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
        print(f"\n[MOCK_SEND] ***** WARNING: MOCK SANDBOX PROVIDER - TEXT MESSAGE NOT ACTUALLY SENT TO WHATSAPP *****", flush=True)
        print(f"[MOCK_SEND] to (number received): {to_phone!r} -> cleaned: {clean_phone!r}", flush=True)
        print(f"[MOCK_SEND] text message: {text!r}", flush=True)
        print(f"[MOCK_SEND] fake message_id: {msg_id} (no HTTP request was made to Meta)", flush=True)
        print(f"[MOCK_SEND] WHY MOCK? get_whatsapp_provider picked MockSandboxWhatsAppProvider (is_live_mode=False or token does not start with 'EAA' or USE_LIVE_WHATSAPP off)", flush=True)
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

    def upload_media(self, phone_number_id: str, access_token: str, file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        media_id = f"media_mock_{uuid.uuid4().hex[:12]}"
        print(f"[MOCK_MEDIA] ***** MOCK SANDBOX PROVIDER - MEDIA NOT ACTUALLY UPLOADED TO META ***** id={media_id}", flush=True)
        return {"id": media_id, "sandbox_simulated": True}


def get_whatsapp_provider(use_live: bool = False, access_token: Optional[str] = None) -> WhatsAppProvider:
    """
    Intelligent provider selector:
    Routes to MetaCloudApiProvider (v22.0) when live mode is configured or live token provided;
    falls back cleanly to MockSandboxWhatsAppProvider for frictionless development and sandbox testing.
    """
    resolved_token = decrypt_secret(access_token or "")
    token_is_eaa = bool(resolved_token and resolved_token.startswith("EAA"))
    if use_live or settings.USE_LIVE_WHATSAPP or token_is_eaa:
        chosen = MetaCloudApiProvider(api_version=settings.META_GRAPH_API_VERSION)
        print(f"\n[PROVIDER] get_whatsapp_provider -> LIVE MetaCloudApiProvider (api={settings.META_GRAPH_API_VERSION}) | use_live={use_live}, USE_LIVE_WHATSAPP={settings.USE_LIVE_WHATSAPP}, token_starts_with_EAA={token_is_eaa}", flush=True)
        return chosen
    print(f"\n[PROVIDER] get_whatsapp_provider -> MOCK MockSandboxWhatsAppProvider (NOTHING WILL BE SENT) | use_live={use_live}, USE_LIVE_WHATSAPP={settings.USE_LIVE_WHATSAPP}, token_starts_with_EAA={token_is_eaa}, token_present={bool(resolved_token)}", flush=True)
    return MockSandboxWhatsAppProvider()
