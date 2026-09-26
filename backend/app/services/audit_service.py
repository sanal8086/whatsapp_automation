from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from app.models.models import AuditLog

class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """Records an immutable audit trail entry for compliance and security monitoring"""
        entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details_json=details or {},
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc)
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def get_logs(
        db: Session,
        tenant_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[AuditLog]:
        query = db.query(AuditLog)
        if tenant_id:
            query = query.filter(AuditLog.tenant_id == tenant_id)
        if action:
            query = query.filter(AuditLog.action == action)
        return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
