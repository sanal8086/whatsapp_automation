from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional, List

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User, Tenant, TenantMember

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id, User.status == "ACTIVE").first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_current_tenant(
    current_user: User = Depends(get_current_user),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    db: Session = Depends(get_db)
) -> Tenant:
    """
    Strict multi-tenant resolution:
    Checks if user is member of specified tenant (or defaults to user's first tenant).
    Never trusts client input without verifying TenantMember in DB.
    """
    query = db.query(TenantMember).filter(
        TenantMember.user_id == current_user.id,
        TenantMember.status == "ACTIVE"
    )
    if x_tenant_id:
        membership = query.filter(TenantMember.tenant_id == x_tenant_id).first()
    else:
        membership = query.first()

    # If platform admin, allow access if tenant exists
    if not membership and current_user.is_platform_admin and x_tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == x_tenant_id).first()
        if tenant:
            return tenant

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active tenant membership found for this user",
        )

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    if not tenant or tenant.status == "SUSPENDED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business account is suspended or unavailable",
        )

    return tenant


def require_roles(allowed_roles: List[str]):
    def role_checker(
        current_user: User = Depends(get_current_user),
        tenant: Tenant = Depends(get_current_tenant),
        db: Session = Depends(get_db)
    ):
        if current_user.is_platform_admin:
            return current_user

        membership = db.query(TenantMember).filter(
            TenantMember.user_id == current_user.id,
            TenantMember.tenant_id == tenant.id
        ).first()

        if not membership or membership.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker


def require_platform_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Administrator access required",
        )
    return current_user
