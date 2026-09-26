import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Loyalty SaaS"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-loyalty-saas-key-2026-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./loyalty_saas.db")
    
    # WhatsApp / Meta Credentials (Supports both Sandbox and Live v22.0 Cloud API)
    META_GRAPH_API_VERSION: str = "v22.0"
    META_APP_ID: str = os.getenv("META_APP_ID", "mock_app_123456")
    META_APP_SECRET: str = os.getenv("META_APP_SECRET", "mock_secret_abcdef")
    META_WEBHOOK_VERIFY_TOKEN: str = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "loyalty_webhook_verify_token_secure")
    USE_LIVE_WHATSAPP: bool = os.getenv("USE_LIVE_WHATSAPP", "false").lower() in ("true", "1", "yes")
    WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: Optional[str] = os.getenv("WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID", "")
    
    # Pricing defaults per message in INR (or tenant currency)
    DEFAULT_MESSAGE_PRICE_MARKETING: float = 0.78
    DEFAULT_MESSAGE_PRICE_UTILITY: float = 0.35
    DEFAULT_MESSAGE_PRICE_AUTHENTICATION: float = 0.30
    DEFAULT_MESSAGE_PRICE_SERVICE: float = 0.25
    
    # Frontend Base URL
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    class Config:
        env_file = ".env"

settings = Settings()
