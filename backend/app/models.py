# app/models.py
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer, Float,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Client(Base):
    __tablename__ = "clients"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True, unique=False)
    join_date = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=True)  # efectivo, transferencia, etc.
    note = Column(String, nullable=True)
    period_month = Column(Integer, nullable=False)  # 1..12
    period_year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("client_id", "period_month", "period_year", name="uq_payment_period"),
    )
