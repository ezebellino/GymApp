import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer, Float,
    ForeignKey, UniqueConstraint, Enum
)
from sqlalchemy.orm import declarative_base
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    owner = "owner"
    coach = "coach"

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.coach, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Client(Base):
    __tablename__ = "clients"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True, unique=False)
    join_date = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

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
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("client_id", "period_month", "period_year", name="uq_payment_period"),
    )

class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    checkin_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    coach_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)