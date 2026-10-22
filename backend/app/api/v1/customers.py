from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import csv
import io

from app.core.database import get_db
from app.core.dependencies import get_current_tenant, get_current_user
from app.models.models import Tenant, Customer, CustomerLoyaltyAccount, LoyaltyTransaction, User
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerOut, CustomerDetailOut, CustomerListOut, CustomerImportExecuteRequest
from app.services.customer_service import CustomerService
from app.services.import_export_service import ImportExportService

router = APIRouter(prefix="/customers", tags=["Customers & CRM"])

@router.get("", response_model=CustomerListOut)
def get_customers(
    search: Optional[str] = None,
    tier: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    total = CustomerService.count_customers(db, tenant.id, search=search, tier=tier)
    customers = CustomerService.get_customers(db, tenant.id, search=search, tier=tier, skip=skip, limit=limit)
    out = []
    for c in customers:
        acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == c.id).first()
        out.append({
            "id": c.id,
            "phone": c.phone,
            "phone_normalized": c.phone_normalized,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "email": c.email,
            "gender": c.gender,
            "date_of_birth": c.date_of_birth,
            "anniversary_date": c.anniversary_date,
            "address": c.address,
            "source": c.source,
            "marketing_consent": c.marketing_consent,
            "whatsapp_consent": c.whatsapp_consent,
            "visits_count": c.visits_count,
            "lifetime_spend": c.lifetime_spend,
            "last_visit_at": c.last_visit_at,
            "points_balance": acc.points_balance if acc else 0,
            "tier": acc.current_tier if acc else "BRONZE",
            "created_at": c.created_at
        })
    return {"items": out, "total": total, "skip": skip, "limit": limit}

@router.post("", response_model=CustomerOut)
def create_customer(
    req: CustomerCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    customer = CustomerService.create_customer(
        db=db,
        tenant_id=tenant.id,
        phone=req.phone,
        first_name=req.first_name,
        last_name=req.last_name,
        email=req.email,
        gender=req.gender,
        date_of_birth=req.date_of_birth,
        anniversary_date=req.anniversary_date,
        address=req.address,
        marketing_consent=req.marketing_consent,
        whatsapp_consent=req.whatsapp_consent
    )
    acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == customer.id).first()
    return {
        "id": customer.id,
        "phone": customer.phone,
        "phone_normalized": customer.phone_normalized,
        "first_name": customer.first_name,
        "last_name": customer.last_name,
        "email": customer.email,
        "gender": customer.gender,
        "date_of_birth": customer.date_of_birth,
        "anniversary_date": customer.anniversary_date,
        "address": customer.address,
        "source": customer.source,
        "marketing_consent": customer.marketing_consent,
        "whatsapp_consent": customer.whatsapp_consent,
        "visits_count": customer.visits_count,
        "lifetime_spend": customer.lifetime_spend,
        "last_visit_at": customer.last_visit_at,
        "points_balance": acc.points_balance if acc else 0,
        "tier": acc.current_tier if acc else "BRONZE",
        "created_at": customer.created_at
    }

# NOTE: Static routes must be registered before /{customer_id},
# otherwise FastAPI matches "export" / "import" as a customer_id path param.
@router.get("/export")
def export_customers(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Exports all customer CRM data as a standard CSV"""
    csv_data = ImportExportService.export_customers_csv(db, tenant.id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=customers_{tenant.slug}.csv"}
    )

@router.post("/import/file")
async def upload_import_file(
    file: UploadFile = File(...),
    tenant: Tenant = Depends(get_current_tenant)
):
    """Uploads Excel or CSV file and returns detected column headers and sample data"""
    content = await file.read()
    return ImportExportService.parse_file(content, file.filename or "import.csv")

@router.post("/import/execute")
def execute_import(
    req: CustomerImportExecuteRequest,
    tenant: Tenant = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes customer import with mapped columns and returns detailed report"""
    return ImportExportService.execute_customer_import(
        db=db,
        tenant_id=tenant.id,
        file_token=req.file_token,
        mapping=req.mapping.model_dump(),
        user_email=user.email
    )

@router.post("/import")
def bulk_import_customers(
    payload: Dict[str, Any],
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    rows = payload.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No rows provided for import")
    result = CustomerService.bulk_import(db, tenant.id, rows)
    return result

@router.get("/{customer_id}", response_model=CustomerDetailOut)
def get_customer_detail(
    customer_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    acc = db.query(CustomerLoyaltyAccount).filter(CustomerLoyaltyAccount.customer_id == c.id).first()
    txns = db.query(LoyaltyTransaction).filter(
        LoyaltyTransaction.customer_id == c.id
    ).order_by(LoyaltyTransaction.created_at.desc()).limit(50).all()

    return {
        "id": c.id,
        "phone": c.phone,
        "phone_normalized": c.phone_normalized,
        "first_name": c.first_name,
        "last_name": c.last_name,
        "email": c.email,
        "gender": c.gender,
        "date_of_birth": c.date_of_birth,
        "anniversary_date": c.anniversary_date,
        "address": c.address,
        "source": c.source,
        "marketing_consent": c.marketing_consent,
        "whatsapp_consent": c.whatsapp_consent,
        "visits_count": c.visits_count,
        "lifetime_spend": c.lifetime_spend,
        "last_visit_at": c.last_visit_at,
        "points_balance": acc.points_balance if acc else 0,
        "tier": acc.current_tier if acc else "BRONZE",
        "created_at": c.created_at,
        "loyalty_transactions": [
            {
                "id": t.id,
                "type": t.type,
                "points": t.points,
                "balance_after": t.balance_after,
                "description": t.description,
                "created_at": t.created_at
            } for t in txns
        ]
    }
