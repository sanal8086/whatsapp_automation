import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings

def _get_fernet() -> Fernet:
    # Derive a deterministic 32-byte urlsafe base64 key from settings.SECRET_KEY
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)

def encrypt_secret(plain_text: str) -> str:
    """Encrypts sensitive tokens/secrets at rest using Fernet AES-128-CBC with HMAC-SHA256"""
    if not plain_text:
        return ""
    if plain_text.startswith("enc:"):
        return plain_text  # already encrypted
    fernet = _get_fernet()
    encrypted = fernet.encrypt(plain_text.encode()).decode()
    return f"enc:{encrypted}"

def decrypt_secret(cipher_text: str) -> str:
    """Decrypts encrypted tokens at rest; handles legacy plaintext gracefully"""
    if not cipher_text:
        return ""
    if not cipher_text.startswith("enc:"):
        return cipher_text  # legacy or unencrypted string
    try:
        raw_cipher = cipher_text[4:]
        fernet = _get_fernet()
        return fernet.decrypt(raw_cipher.encode()).decode()
    except Exception:
        return cipher_text
