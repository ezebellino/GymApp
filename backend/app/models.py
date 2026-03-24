import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Index, String, DateTime, Boolean, Integer, Float,
    ForeignKey, UniqueConstraint, Enum
)
from sqlalchemy.orm import declarative_base, relationship
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
    email_verified = Column(Boolean, default=False)
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
    
    payments = relationship("Payment", back_populates="client")
    attendance = relationship("Attendance", back_populates="client", cascade="all, delete-orphan")
    workout_logs = relationship("WorkoutLog", back_populates="client", cascade="all, delete-orphan")
    
    __table_args__ = (
    Index("ix_clients_full_name", "full_name"),
    Index("ix_clients_email", "email"),
    Index("ix_clients_join_date", "join_date"),
    Index("ix_clients_is_active", "is_active"),
)

class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    client = relationship("Client", back_populates="payments")
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False)  # efectivo, transferencia, etc.
    method_channel = Column(String, nullable=True)  # detalles adicionales del método
    note = Column(String, nullable=True)
    period_month = Column(Integer, nullable=False)  # 1..12
    period_year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("client_id", "period_month", "period_year", name="uq_payment_period"),
        Index("ix_payments_method", "method"),
        Index("ix_payments_method_channel", "method_channel"),
    )

class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    checkin_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    coach_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    client = relationship("Client", back_populates="attendance")


class TrainingDay(Base):
    __tablename__ = "training_days"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    muscle_groups = Column(String, nullable=False)
    day_order = Column(Integer, nullable=False, unique=True)

    exercises = relationship(
        "TrainingDayExercise",
        back_populates="day",
        cascade="all, delete-orphan",
        order_by="TrainingDayExercise.sort_order",
    )
    logs = relationship("WorkoutLog", back_populates="day", cascade="all, delete-orphan")


class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    muscle_group = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    day_links = relationship("TrainingDayExercise", back_populates="exercise", cascade="all, delete-orphan")
    logs = relationship("WorkoutLog", back_populates="exercise", cascade="all, delete-orphan")


class TrainingDayExercise(Base):
    __tablename__ = "training_day_exercises"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    day_id = Column(String, ForeignKey("training_days.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=False)
    assigned_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    day = relationship("TrainingDay", back_populates="exercises")
    exercise = relationship("Exercise", back_populates="day_links")

    __table_args__ = (
        UniqueConstraint("day_id", "exercise_id", name="uq_training_day_exercise"),
    )


class WorkoutLog(Base):
    __tablename__ = "workout_logs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    day_id = Column(String, ForeignKey("training_days.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    sets_count = Column(Integer, nullable=True)
    reps = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=False, default=0)
    note = Column(String, nullable=True)
    performed_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    client = relationship("Client", back_populates="workout_logs")
    day = relationship("TrainingDay", back_populates="logs")
    exercise = relationship("Exercise", back_populates="logs")


class AppSettings(Base):
    __tablename__ = "app_settings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    gym_name = Column(String, nullable=False)
    admin_name = Column(String, nullable=True)
    currency = Column(String, nullable=False)
    default_fee = Column(Integer, nullable=False)
    address = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    whatsapp_phone = Column(String, nullable=True)
    business_hours = Column(String, nullable=True)
    payment_alias = Column(String, nullable=True)
    payment_notes = Column(String, nullable=True)
    payment_reminder_message = Column(String, nullable=True)
    payment_reminder_last_sent_at = Column(DateTime, nullable=True)
    late_fee_grace_days = Column(Integer, nullable=False, default=5)
    allow_cash = Column(Boolean, nullable=False, default=True)
    allow_transfer = Column(Boolean, nullable=False, default=True)
    onboarding_message = Column(String, nullable=True)
