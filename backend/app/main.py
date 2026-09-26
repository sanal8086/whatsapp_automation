from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.api import api_router
from app.models import *

import asyncio
from app.workers.campaign_dispatcher import scheduled_worker_loop
from app.services.pricing_service import PricingService
from app.core.database import SessionLocal

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all database tables on startup
    Base.metadata.create_all(bind=engine)
    
    # Seed default dynamic pricing rules if empty
    db = SessionLocal()
    try:
        PricingService.seed_default_pricing_if_empty(db)
    finally:
        db.close()

    # Launch background task runner for campaigns and automations
    worker_task = asyncio.create_task(scheduled_worker_loop())
    yield
    worker_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Multi-tenant Loyalty & WhatsApp Marketing SaaS Backend",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
