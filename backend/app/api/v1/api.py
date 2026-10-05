from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.customers import router as customers_router
from app.api.v1.segments import router as segments_router
from app.api.v1.loyalty import router as loyalty_router
from app.api.v1.campaigns import router as campaigns_router
from app.api.v1.automations import router as automations_router
from app.api.v1.whatsapp import router as whatsapp_router
from app.api.v1.wallet import router as wallet_router
from app.api.v1.insights import router as insights_router
from app.api.v1.public import router as public_router
from app.api.v1.admin import router as admin_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.onboarding import router as onboarding_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(tenants_router)
api_router.include_router(customers_router)
api_router.include_router(segments_router)
api_router.include_router(loyalty_router)
api_router.include_router(campaigns_router)
api_router.include_router(automations_router)
api_router.include_router(whatsapp_router)
api_router.include_router(wallet_router)
api_router.include_router(insights_router)
api_router.include_router(public_router)
api_router.include_router(admin_router)
api_router.include_router(webhooks_router)
api_router.include_router(onboarding_router)

