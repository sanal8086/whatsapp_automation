import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import Optional

# Automatically load .env file from backend or current working directory
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Loyalty SaaS")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-loyalty-saas-key-2026-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7))) # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./loyalty_saas.db")
    
    # WhatsApp / Meta Credentials (Supports both Sandbox and Live v22.0 Cloud API)
    META_GRAPH_API_VERSION: str = os.getenv("META_GRAPH_API_VERSION", "v22.0")
    META_APP_ID: str = os.getenv("META_APP_ID", "mock_app_123456")
    META_APP_SECRET: str = os.getenv("META_APP_SECRET", "mock_secret_abcdef")
    META_WEBHOOK_VERIFY_TOKEN: str = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "loyalty_webhook_verify_token_secure")
    USE_LIVE_WHATSAPP: bool = os.getenv("USE_LIVE_WHATSAPP", "false").lower() in ("true", "1", "yes")
    WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: Optional[str] = os.getenv("WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID", "")
    
    # Pricing defaults per message in INR (or tenant currency)
    DEFAULT_MESSAGE_PRICE_MARKETING: float = float(os.getenv("DEFAULT_MESSAGE_PRICE_MARKETING", "0.78"))
    DEFAULT_MESSAGE_PRICE_UTILITY: float = float(os.getenv("DEFAULT_MESSAGE_PRICE_UTILITY", "0.35"))
    DEFAULT_MESSAGE_PRICE_AUTHENTICATION: float = float(os.getenv("DEFAULT_MESSAGE_PRICE_AUTHENTICATION", "0.30"))
    DEFAULT_MESSAGE_PRICE_SERVICE: float = float(os.getenv("DEFAULT_MESSAGE_PRICE_SERVICE", "0.25"))
    
    # Frontend Base URL
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # NOTE: [DEMO] Award Rewards (business-side Award Points page) WhatsApp notification settings.
    # Sends the 'hellopets_expired' template to the customer's phone when points are awarded. Remove before production.
    AWARD_REWARDS_WHATSAPP_TOKEN: Optional[str] = os.getenv(
        "AWARD_REWARDS_WHATSAPP_TOKEN",
        "EAAZAOUAFYFIABSiWJLLbrgoZAktKxuisREheCRQNzsyXPyphwAZCSwqHATSz49suNVXm7NDlPXZCOfOUZBCIuA8rbTbVSmMuAajOKuyill69qafVPf6lOHlfwmkU2D0muYuDoOCBZAeNCwtIk6wSR3xyCpBcDwZCzl1ID0XQpMe4NNBjd8MYedJZCjG6BVfmUgZDZD"
    )
    AWARD_REWARDS_PHONE_NUMBER_ID: str = os.getenv("AWARD_REWARDS_PHONE_NUMBER_ID", "1380171298507513")
    AWARD_REWARDS_TEMPLATE_NAME: str = os.getenv("AWARD_REWARDS_TEMPLATE_NAME", "hellopets_expired")
    AWARD_REWARDS_TEMPLATE_ID: str = os.getenv("AWARD_REWARDS_TEMPLATE_ID", "1804718454107225")
    AWARD_REWARDS_LANGUAGE_CODE: str = os.getenv("AWARD_REWARDS_LANGUAGE_CODE", "en_US")
    AWARD_REWARDS_API_VERSION: str = os.getenv("AWARD_REWARDS_API_VERSION", "v25.0")
    # Redeem CTA template — sent after award_points_notification with a URL button to the loyalty portal
    AWARD_REWARDS_REDEEM_TEMPLATE_NAME: str = os.getenv("AWARD_REWARDS_REDEEM_TEMPLATE_NAME", "redeem_points_cta")
    AWARD_REWARDS_REDEEM_TEMPLATE_ID: str = os.getenv("AWARD_REWARDS_REDEEM_TEMPLATE_ID", "2531728973916320")
    # Seconds to wait after hellopets_expired before firing redeem_points_cta
    AWARD_REWARDS_CTA_DELAY_SECONDS: int = int(os.getenv("AWARD_REWARDS_CTA_DELAY_SECONDS", "5"))
    # NOTE: [END DEMO]

    # NOTE: [DEMO] Wervus Cafe Client Demo WhatsApp Settings. Remove before production.
    WERVUS_DEMO_WHATSAPP_TOKEN: Optional[str] = os.getenv("WERVUS_DEMO_WHATSAPP_TOKEN", "")
    WERVUS_DEMO_PHONE_NUMBER_ID: str = os.getenv("WERVUS_DEMO_PHONE_NUMBER_ID", "1380171298507513")
    WERVUS_DEMO_TEMPLATE_NAME: str = os.getenv("WERVUS_DEMO_TEMPLATE_NAME", "hello_world")
    WERVUS_DEMO_LANGUAGE_CODE: str = os.getenv("WERVUS_DEMO_LANGUAGE_CODE", "en_US")
    WERVUS_DEMO_API_VERSION: str = os.getenv("WERVUS_DEMO_API_VERSION", "v22.0")
    WERVUS_DEMO_ENABLED: bool = os.getenv("WERVUS_DEMO_ENABLED", "true").lower() in ("true", "1", "yes")
    # NOTE: [END DEMO]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
