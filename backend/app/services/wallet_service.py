from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import Wallet, WalletTransaction
from datetime import datetime, timezone

class WalletService:
    @staticmethod
    def get_or_create_wallet(db: Session, tenant_id: str, currency: str = "INR") -> Wallet:
        wallet = db.query(Wallet).filter(Wallet.tenant_id == tenant_id).first()
        if not wallet:
            wallet = Wallet(
                tenant_id=tenant_id,
                currency=currency,
                balance=0.0,
                reserved_balance=0.0,
                status="ACTIVE"
            )
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
        return wallet

    @staticmethod
    def get_available_balance(wallet: Wallet) -> float:
        return max(0.0, round(wallet.balance - wallet.reserved_balance, 2))

    @staticmethod
    def credit_wallet(
        db: Session,
        tenant_id: str,
        amount: float,
        description: str,
        created_by: str = "SYSTEM",
        reference_type: str = "MANUAL_CREDIT",
        reference_id: str = None
    ) -> WalletTransaction:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Credit amount must be greater than zero")

        wallet = WalletService.get_or_create_wallet(db, tenant_id)
        balance_before = wallet.balance
        wallet.balance = round(wallet.balance + amount, 2)
        balance_after = wallet.balance

        txn = WalletTransaction(
            wallet_id=wallet.id,
            tenant_id=tenant_id,
            type="CREDIT",
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            created_by=created_by
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def debit_wallet(
        db: Session,
        tenant_id: str,
        amount: float,
        description: str,
        reference_type: str = "MESSAGE_SEND",
        reference_id: str = None,
        created_by: str = "SYSTEM"
    ) -> WalletTransaction:
        wallet = WalletService.get_or_create_wallet(db, tenant_id)
        if wallet.balance < amount:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient wallet balance. Required: ₹{amount:.2f}, Balance: ₹{wallet.balance:.2f}"
            )

        balance_before = wallet.balance
        wallet.balance = round(wallet.balance - amount, 2)
        balance_after = wallet.balance

        txn = WalletTransaction(
            wallet_id=wallet.id,
            tenant_id=tenant_id,
            type="DEBIT",
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            created_by=created_by
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def reserve_credit(db: Session, tenant_id: str, amount: float) -> bool:
        wallet = WalletService.get_or_create_wallet(db, tenant_id)
        available = WalletService.get_available_balance(wallet)
        if available < amount:
            return False
        wallet.reserved_balance = round(wallet.reserved_balance + amount, 2)
        db.commit()
        return True

    @staticmethod
    def release_reservation(db: Session, tenant_id: str, amount: float):
        wallet = WalletService.get_or_create_wallet(db, tenant_id)
        wallet.reserved_balance = max(0.0, round(wallet.reserved_balance - amount, 2))
        db.commit()

    @staticmethod
    def settle_reservation(db: Session, tenant_id: str, reserved_amount: float, actual_amount: float, description: str, reference_id: str):
        wallet = WalletService.get_or_create_wallet(db, tenant_id)
        # Release the full reservation
        wallet.reserved_balance = max(0.0, round(wallet.reserved_balance - reserved_amount, 2))
        # Debit the actual amount consumed
        balance_before = wallet.balance
        wallet.balance = round(wallet.balance - actual_amount, 2)
        balance_after = wallet.balance

        txn = WalletTransaction(
            wallet_id=wallet.id,
            tenant_id=tenant_id,
            type="DEBIT",
            amount=actual_amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="CAMPAIGN_DISPATCH",
            reference_id=reference_id,
            description=description,
            created_by="CAMPAIGN_WORKER"
        )
        db.add(txn)
        db.commit()
        return txn
