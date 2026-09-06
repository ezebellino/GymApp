import uuid
from datetime import date, datetime
from sqlalchemy import (
    Column, Index, String, DateTime, Date, Boolean, Integer, Float,
    ForeignKey, UniqueConstraint, Enum, text
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import declarative_base, relationship
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    owner = "owner"
    coach = "coach"
    member = "member"


class MembershipStatus(str, enum.Enum):
    none = "none"
    active = "active"
    cancelled = "cancelled"


class ProgressionStrategy(str, enum.Enum):
    """Estrategia de progresión de series (`progression-strategies`).

    Los parámetros numéricos de cada estrategia viven como constantes en
    `app/progression.py`, no acá: este enum solo identifica cuál usar.
    """

    constant = "constant"
    pyramid = "pyramid"
    inverted = "inverted"
    drop_set = "drop_set"
    rest_pause = "rest_pause"


class RoutineAssignmentStatus(str, enum.Enum):
    active = "active"
    alternative = "alternative"


class User(Base):
    """Persona que interactua con la plataforma (Dueño, Coach o Miembro).

    Fusiona lo que antes eran dos tablas (`users` + `clients`, ver migracion
    `unify-clients-into-users`): el rol define permisos, y el atributo funcional de
    "membresia" (rutinas/asistencia/pagos) es independiente del rol — un Dueño o
    Coach puede además ser miembro del gimnasio sin perder sus permisos.
    """

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # --- Perfil ---------------------------------------------------------
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)  # nullable en DB: el backfill no puede garantizarlo
    birth_date = Column(Date, nullable=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    email = Column(String, nullable=True)  # nullable + índice único parcial (ver __table_args__)
    email_verified = Column(Boolean, default=False, nullable=False)
    phone = Column(String, nullable=True)
    phone_verified = Column(Boolean, default=False, nullable=False)

    # --- Acceso ----------------------------------------------------------
    password_hash = Column(String, nullable=True)  # NULL = todavia sin acceso de login
    role = Column(Enum(UserRole), default=UserRole.coach, nullable=False)
    is_active = Column(Boolean, default=True)  # cuenta habilitada, NO la membresia

    # --- Membresia/suscripcion --------------------------------------------
    membership_status = Column(
        Enum(MembershipStatus), default=MembershipStatus.none, nullable=False
    )
    membership_start_date = Column(DateTime, nullable=True)
    membership_cancelled_at = Column(DateTime, nullable=True)

    # --- Auditoria / metadata ----------------------------------------------
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    theme_preference = Column(String, nullable=True)

    # Rastro temporal de la migracion (ver design.md, decision 6). Se borra en un
    # change de seguimiento una vez validado el resultado en produccion.
    legacy_client_id = Column(String, nullable=True, index=True)

    payments = relationship(
        "Payment", back_populates="user", foreign_keys="Payment.user_id"
    )
    attendance = relationship(
        "Attendance", back_populates="user", foreign_keys="Attendance.user_id"
    )
    workout_logs = relationship(
        "WorkoutLog", back_populates="user", foreign_keys="WorkoutLog.user_id"
    )

    @hybrid_property
    def full_name(self):
        if self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name

    @full_name.expression
    def full_name(cls):
        from sqlalchemy import func
        return func.trim(func.concat(cls.first_name, " ", func.coalesce(cls.last_name, "")))

    @property
    def age(self) -> int | None:
        if not self.birth_date:
            return None
        today = date.today()
        birth = self.birth_date
        years = today.year - birth.year
        if (today.month, today.day) < (birth.month, birth.day):
            years -= 1
        return years

    __table_args__ = (
        Index(
            "ix_users_email_unique",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
        ),
        Index("ix_users_full_name", text("(first_name || ' ' || coalesce(last_name, ''))")),
        Index("ix_users_phone", "phone"),
        Index("ix_users_membership_status", "membership_status"),
        Index("ix_users_membership_start_date", "membership_start_date"),
    )


class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    user = relationship("User", back_populates="payments", foreign_keys=[user_id])
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False)  # efectivo, transferencia, etc.
    method_channel = Column(String, nullable=True)  # detalles adicionales del método
    note = Column(String, nullable=True)
    period_month = Column(Integer, nullable=False)  # 1..12
    period_year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "period_month", "period_year", name="uq_payment_period"),
        Index("ix_payments_method", "method"),
        Index("ix_payments_method_channel", "method_channel"),
    )

class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    checkin_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    coach_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="attendance", foreign_keys=[user_id])


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
    # --- Base de progresión (add-routine-templates, design D3) --------------
    base_sets = Column(Integer, nullable=False, default=3, server_default="3")
    base_reps = Column(Integer, nullable=False, default=10, server_default="10")
    base_weight_kg = Column(Float, nullable=False, default=0, server_default="0")

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
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    day_id = Column(String, ForeignKey("training_days.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    sets_count = Column(Integer, nullable=True)
    reps = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=False, default=0)
    note = Column(String, nullable=True)
    performed_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="workout_logs", foreign_keys=[user_id])
    day = relationship("TrainingDay", back_populates="logs")
    exercise = relationship("Exercise", back_populates="logs")


class RoutineTemplate(Base):
    """Plantilla de rutina (`routine-templates`): capa sobre el catálogo compartido de
    días y ejercicios, ver design.md decision D1. No copia días ni ejercicios, solo
    referencia un subconjunto ordenado de `TrainingDay` vía `RoutineTemplateDay`."""

    __tablename__ = "routine_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    # Derivada en Python (NFC + strip + casefold), no `lower()` de SQL: ver design D1.
    name_normalized = Column(String, nullable=False)
    tag = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    days = relationship(
        "RoutineTemplateDay",
        cascade="all, delete-orphan",
        order_by="RoutineTemplateDay.position",
    )
    exercise_configs = relationship("RoutineTemplateExercise", cascade="all, delete-orphan")
    assignments = relationship("RoutineAssignment", back_populates="template")

    __table_args__ = (
        UniqueConstraint("name_normalized", name="uq_routine_templates_name_normalized"),
    )


class RoutineTemplateDay(Base):
    """Qué días del catálogo incluye una plantilla y en qué orden (design D1)."""

    __tablename__ = "routine_template_days"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("routine_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    day_id = Column(String, ForeignKey("training_days.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)

    day = relationship("TrainingDay")

    __table_args__ = (
        UniqueConstraint("template_id", "day_id", name="uq_routine_template_days_template_day"),
    )


class RoutineTemplateExercise(Base):
    """Configuración (activo + estrategia) de un ejercicio para una plantilla y un día.

    Referencia `(template_id, day_id, exercise_id)` **directo** — sin FK a
    `RoutineTemplateDay` ni a `TrainingDayExercise` — para que quitar un día de la
    plantilla no borre esta configuración y para que no la afecte un reseed del
    catálogo (`_ensure_seed_data`). Ver design.md decision D2, invariantes I1/I9.
    Filas ralas: solo existe cuando alguien tocó ese ejercicio en esa plantilla.
    """

    __tablename__ = "routine_template_exercises"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("routine_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    day_id = Column(String, ForeignKey("training_days.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    strategy = Column(Enum(ProgressionStrategy), nullable=False, default=ProgressionStrategy.constant)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    exercise = relationship("Exercise")

    __table_args__ = (
        UniqueConstraint(
            "template_id", "day_id", "exercise_id", name="uq_routine_template_exercises_template_day_exercise"
        ),
    )


class RoutineAssignment(Base):
    """Asignación de una plantilla a un Miembro (`routine-assignment`, design D6).

    Como máximo una Activa por usuario, garantizado por el índice único parcial de
    abajo (no solo por el código del endpoint, invariante I2).
    """

    __tablename__ = "routine_assignments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    template_id = Column(String, ForeignKey("routine_templates.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(Enum(RoutineAssignmentStatus), nullable=False)
    starts_on = Column(Date, nullable=False, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    template = relationship("RoutineTemplate", back_populates="assignments")
    base_overrides = relationship(
        "RoutineAssignmentBase", cascade="all, delete-orphan", back_populates="assignment"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "template_id", name="uq_routine_assignments_user_template"),
        Index(
            "ix_routine_assignments_user_active",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
            # SQLite ignora `postgresql_where` sin este kwarg (ver
            # `MemberInvitation.ix_member_invitations_user_id_live` más abajo): la
            # suite corre en SQLite y producción en Postgres, así que hacen falta los
            # dos dialectos declarados para que el invariante se comporte igual.
            sqlite_where=text("status = 'active'"),
        ),
    )


class RoutineAssignmentBase(Base):
    """Ajuste de base (series × reps · kg) por cliente para un ejercicio de su
    asignación, con autoría por fila (design D7). Precedencia sobre la base global
    del catálogo al calcular el plan de ese Miembro (invariante I10)."""

    __tablename__ = "routine_assignment_bases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(
        String, ForeignKey("routine_assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    sets = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=False)
    adjusted_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    adjusted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    assignment = relationship("RoutineAssignment", back_populates="base_overrides")
    exercise = relationship("Exercise")

    __table_args__ = (
        UniqueConstraint("assignment_id", "exercise_id", name="uq_routine_assignment_bases_assignment_exercise"),
    )


class MemberInvitation(Base):
    """Invitacion por link para que un Miembro complete su acceso al portal.

    Ver design.md decision 9: dos tokens independientes (email/whatsapp), se guarda
    solo el hash, y el reenvio revoca la fila viva e inserta una nueva (garantizado por
    el índice único parcial de abajo).
    """

    __tablename__ = "member_invitations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    email_token_hash = Column(String, nullable=False, unique=True)
    phone_token_hash = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)
    phone_verified_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index(
            "ix_member_invitations_user_id_live",
            "user_id",
            unique=True,
            postgresql_where=text("revoked_at IS NULL AND completed_at IS NULL"),
            # SQLite sí soporta índices parciales (3.8+) pero ignora
            # `postgresql_where`: sin este kwarg, el índice sale como UNIQUE liso
            # sobre `user_id` en la suite de tests (que corre en SQLite) y el
            # reenvío (revocar + insertar) rompe con un 409 espurio.
            sqlite_where=text("revoked_at IS NULL AND completed_at IS NULL"),
        ),
    )


class AppSettings(Base):
    __tablename__ = "app_settings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    gym_name = Column(String, nullable=False)
    admin_name = Column(String, nullable=True)
    theme_preference = Column(String, nullable=True)
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
