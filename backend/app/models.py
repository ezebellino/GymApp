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


# --- Base por defecto de un ejercicio nuevo en un día de plantilla ----------
# (`template-owned-routine-days`, design D5): único lugar del backend donde
# viven estos tres números. Los usan, a la vez, `RoutineTemplateDayExercise`
# como `default`/`server_default` de sus columnas y el router del `PUT` de
# guardado del borrador cuando construye una fila nueva.
DEFAULT_EXERCISE_BASE_SETS = 3
DEFAULT_EXERCISE_BASE_REPS = 10
DEFAULT_EXERCISE_BASE_WEIGHT_KG = 0.0


class MuscleGroup(str, enum.Enum):
    """Grupo muscular de lista fija del catálogo de ejercicios (`exercise-catalog`,
    design D1). El valor es la etiqueta en español con tildes; el nombre del
    miembro es el identificador en inglés, convención del repo. La columna
    `Exercise.muscle_group` sigue siendo `String` (no `Enum()` de SQLAlchemy, ver
    D1): la validación contra esta lista vive en el schema Pydantic."""

    chest = "Pecho"
    back = "Espalda"
    shoulders = "Hombros"
    biceps = "Bíceps"
    triceps = "Tríceps"
    forearm = "Antebrazo"
    core = "Core"
    glutes = "Glúteos"
    quadriceps = "Cuádriceps"
    hamstrings = "Isquios"
    calves = "Gemelos"
    full_body = "Cuerpo completo"


class TrainingType(str, enum.Enum):
    """Tipo de entrenamiento de lista fija del catálogo de ejercicios
    (`exercise-catalog`, design D2): cero o más por ejercicio, vía la tabla de
    asociación `ExerciseTrainingType`."""

    strength = "Fuerza"
    hypertrophy = "Hipertrofia"
    endurance = "Resistencia"
    cardio = "Cardio"
    mobility = "Movilidad"
    functional = "Funcional"
    rehabilitation = "Rehabilitación"


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

    # --- Plan de membresia (`membership-plans`, design D1) -------------------
    # Nullable en la base a proposito: un Dueño/Coach sin membresia, un miembro
    # `cancelled` y todo miembro preexistente (sin backfill, ver design D3) no
    # tienen plan. El invariante "membresia activa ⇒ plan" solo se sostiene en
    # la capa de aplicacion (alta, activacion y cambio de plan).
    membership_plan_id = Column(
        String, ForeignKey("membership_plans.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    plan_since = Column(Date, nullable=True)
    plan_changed_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

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
    membership_plan = relationship("MembershipPlan", foreign_keys=[membership_plan_id])
    plan_changed_by = relationship("User", remote_side=[id], foreign_keys=[plan_changed_by_user_id])

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


class MembershipPlan(Base):
    """Plan de membresía (`membership-plans`, design D1): nombre único, descripción
    opcional y activo/inactivo. El precio vive aparte, como historial append-only
    (`MembershipPlanPrice`), nunca como columna acá."""

    __tablename__ = "membership_plans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    # Derivada en Python (NFC + strip + casefold), no `lower()` de SQL: ver design D1
    # y el mismo patrón ya probado en `RoutineTemplate.name_normalized`.
    name_normalized = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # `save-update, merge` (no incluye `delete`/`delete-orphan`): el historial de
    # precios es append-only (invariante I1) — sacar una fila de `plan.prices` en
    # Python nunca debería traducirse en un DELETE. `all, delete-orphan` (el
    # default de SQLAlchemy) contradecía eso, aunque hoy no hay ningún camino que
    # lo dispare (hallazgo 6 de verification.md).
    prices = relationship(
        "MembershipPlanPrice",
        back_populates="plan",
        cascade="save-update, merge",
        order_by="MembershipPlanPrice.effective_from.desc()",
    )


class MembershipPlanPrice(Base):
    """Historial append-only de precios de un plan (`membership-plans`, design D1,
    invariante I1): una fila nunca se actualiza ni se borra, cambiar el precio solo
    agrega una fila nueva."""

    __tablename__ = "membership_plan_prices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id = Column(
        String, ForeignKey("membership_plans.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount = Column(Integer, nullable=False)
    effective_from = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    plan = relationship("MembershipPlan", back_populates="prices")

    __table_args__ = (
        UniqueConstraint("plan_id", "effective_from", name="uq_membership_plan_prices_plan_effective_from"),
        Index("ix_membership_plan_prices_plan_effective_from", "plan_id", "effective_from"),
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

    # --- Foto de plan (`rebuild-payments-with-plan-pricing`, design D1) ------
    # Las tres columnas de abajo son una FOTO INMUTABLE del plan y precio vigentes
    # al momento del alta (invariante I2): ningún camino de escritura las toca
    # después de crear el pago. Son nullable únicamente porque los pagos
    # anteriores a esta migración no tienen foto (sin backfill, design D4) — de
    # acá en adelante todo pago creado por la API las trae completas (invariante
    # I5). No confundir `plan_amount_at_payment` (precio de referencia sugerido)
    # con `amount` (lo efectivamente pagado, que puede diferir por un descuento).
    membership_plan_id = Column(
        String, ForeignKey("membership_plans.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    plan_name_at_payment = Column(String, nullable=True)
    plan_amount_at_payment = Column(Integer, nullable=True)

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


class Exercise(Base):
    """Catálogo de ejercicios (`exercise-catalog`, design D1/D2/D6). `muscle_group`
    es `String` nullable (0..1, opcional) validado contra `MuscleGroup` en el
    schema Pydantic — no `Enum()` de SQLAlchemy, ver design D1. Los tipos de
    entrenamiento (0..n) viven en `ExerciseTrainingType`, no acá."""

    __tablename__ = "exercises"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    # Derivado en Python (NFC + strip + casefold), no `lower()` de SQL: mismo
    # patrón que `MembershipPlan.name_normalized` (design D7).
    name_normalized = Column(String, nullable=False, unique=True)
    muscle_group = Column(String, nullable=True, index=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # --- Media independiente: archivo propio + URL externa (design D6) ------
    external_media_url = Column(String, nullable=True)
    media_object_key = Column(String, nullable=True)
    media_content_type = Column(String, nullable=True)
    media_size_bytes = Column(Integer, nullable=True)
    media_filename = Column(String, nullable=True)
    media_uploaded_at = Column(DateTime, nullable=True)
    media_uploaded_by_user_id = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    training_types = relationship(
        "ExerciseTrainingType",
        cascade="all, delete-orphan",
        order_by="ExerciseTrainingType.sort_order",
    )


class ExerciseTrainingType(Base):
    """Tipos de entrenamiento (0..n) de un ejercicio (`exercise-catalog`, design D2).
    PK compuesta: la fila **es** el par, no tiene identidad propia. `CASCADE` es
    correcto acá (a diferencia del resto del modelo, donde borrar un ejercicio está
    prohibido): estas filas son atributos del ejercicio."""

    __tablename__ = "exercise_training_types"

    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True)
    training_type = Column(String, primary_key=True)
    sort_order = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_exercise_training_types_training_type", "training_type"),
    )


class RoutineTemplate(Base):
    """Plantilla de rutina (`routine-templates`, design D1): los días son propiedad
    directa de la plantilla — nacen y mueren con ella, sin referenciar ningún
    catálogo compartido (ver `RoutineTemplateDay`)."""

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
    # `passive_deletes=True` (`member-routine-copies`, design D2b): el
    # `ondelete="SET NULL"` de `RoutineAssignment.template_id` lo hace la base,
    # no SQLAlchemy fila por fila — sin esto, borrar una plantilla con copias
    # Alternativas dispararía un `UPDATE` por asignación en vez de dejar que la
    # FK resuelva el `SET NULL` en un solo `DELETE`.
    assignments = relationship(
        "RoutineAssignment", back_populates="template", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint("name_normalized", name="uq_routine_templates_name_normalized"),
    )


class RoutineTemplateDay(Base):
    """Día propio de una plantilla de rutina (`template-owned-routine-days`,
    design D1): nace y muere con ella (`ondelete="CASCADE"` sobre `template_id`),
    con su propio grupo muscular (`RoutineTemplateDayMuscleGroup`) y sus propios
    ejercicios (`RoutineTemplateDayExercise`). Sin columna `name`: el título
    "Día N" se deriva de `position` en el serializador — una sola fuente de
    verdad para el renumerado al quitar un día."""

    __tablename__ = "routine_template_days"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("routine_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)

    muscle_groups = relationship(
        "RoutineTemplateDayMuscleGroup",
        cascade="all, delete-orphan",
        order_by="RoutineTemplateDayMuscleGroup.sort_order",
    )
    exercises = relationship(
        "RoutineTemplateDayExercise",
        cascade="all, delete-orphan",
        order_by="RoutineTemplateDayExercise.sort_order",
    )

    __table_args__ = (
        UniqueConstraint("template_id", "position", name="uq_routine_template_days_template_position"),
    )


class RoutineTemplateDayMuscleGroup(Base):
    """Grupo muscular (0..n) de un día de plantilla (design D1). Mismo patrón que
    `ExerciseTrainingType`: PK compuesta, la fila **es** el atributo, sin
    identidad propia."""

    __tablename__ = "routine_template_day_muscle_groups"

    template_day_id = Column(
        String, ForeignKey("routine_template_days.id", ondelete="CASCADE"), primary_key=True
    )
    muscle_group = Column(String, primary_key=True)
    sort_order = Column(Integer, nullable=False, default=0)


class RoutineTemplateDayExercise(Base):
    """Ejercicio agregado a un día de plantilla, con su base y su estrategia de
    progresión propias (design D1): estar en esta tabla **es** estar en la
    plantilla — no hay un flag `is_active` intermedio, a diferencia de la vieja
    `RoutineTemplateExercise`. `base_sets`/`base_reps`/`base_weight_kg` son ahora
    el único lugar del modelo donde existe una base (design D5/D7)."""

    __tablename__ = "routine_template_day_exercises"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_day_id = Column(
        String, ForeignKey("routine_template_days.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    strategy = Column(Enum(ProgressionStrategy), nullable=False, default=ProgressionStrategy.constant)
    base_sets = Column(
        Integer, nullable=False, default=DEFAULT_EXERCISE_BASE_SETS,
        server_default=str(DEFAULT_EXERCISE_BASE_SETS),
    )
    base_reps = Column(
        Integer, nullable=False, default=DEFAULT_EXERCISE_BASE_REPS,
        server_default=str(DEFAULT_EXERCISE_BASE_REPS),
    )
    base_weight_kg = Column(
        Float, nullable=False, default=DEFAULT_EXERCISE_BASE_WEIGHT_KG,
        server_default=str(DEFAULT_EXERCISE_BASE_WEIGHT_KG),
    )
    # `routine-exercise-intensity`: RIR (repeticiones en reserva) y pausa entre
    # series, ambos opcionales — un ejercicio puede no prescribirlos. Se guarda
    # SIEMPRE el RIR, nunca el RPE: son la misma escala invertida
    # (RPE = 10 - RIR) y el frontend convierte para mostrar. `rir` es Float
    # porque la escala admite medios (RIR 1.5 ⇔ RPE 8.5).
    rir = Column(Float, nullable=True)
    rest_seconds = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    exercise = relationship("Exercise")

    __table_args__ = (
        UniqueConstraint(
            "template_day_id", "exercise_id", name="uq_routine_template_day_exercises_day_exercise"
        ),
    )


class RoutineAssignment(Base):
    """Copia de rutina de un Miembro (`member-routine-copies`, design D2/D2b).

    Deja de ser una referencia a `RoutineTemplate`: sus días, grupos musculares
    y ejercicios viven en tablas propias (`RoutineAssignmentDay` y las suyas,
    design D1), copiados una sola vez al asignar (D5). `template_id` es
    nullable con `ondelete="SET NULL"` — una plantilla borrada con solo copias
    Alternativas deja `template_id IS NULL` sin tocar nada más de la copia
    (D2b) — y `template_name`/`template_tag` son un snapshot tomado al copiar,
    única fuente de la etiqueta de origen (nunca el nombre vivo de la
    plantilla). Sin `UniqueConstraint(user_id, template_id)` (D2): reasignar la
    misma plantilla crea una fila nueva, no un upsert. Como máximo una Activa
    por usuario, garantizado por el índice único parcial de abajo (no solo por
    el código del endpoint, invariante I5).
    """

    __tablename__ = "routine_assignments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    template_id = Column(
        String, ForeignKey("routine_templates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    template_name = Column(String, nullable=False)
    template_tag = Column(String, nullable=True)
    status = Column(Enum(RoutineAssignmentStatus), nullable=False)
    starts_on = Column(Date, nullable=False, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    template = relationship("RoutineTemplate", back_populates="assignments")
    days = relationship(
        "RoutineAssignmentDay",
        cascade="all, delete-orphan",
        order_by="RoutineAssignmentDay.position",
    )

    __table_args__ = (
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


class RoutineAssignmentDay(Base):
    """Día propio de la copia de un Miembro (`member-routine-copies`, design
    D1): mismo patrón que `RoutineTemplateDay`, pero colgado de
    `RoutineAssignment` en vez de `RoutineTemplate` — dos subárboles
    estructuralmente idénticos, con la lógica compartida en
    `app/routine_days.py` (design D8)."""

    __tablename__ = "routine_assignment_days"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(
        String, ForeignKey("routine_assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position = Column(Integer, nullable=False)

    muscle_groups = relationship(
        "RoutineAssignmentDayMuscleGroup",
        cascade="all, delete-orphan",
        order_by="RoutineAssignmentDayMuscleGroup.sort_order",
    )
    exercises = relationship(
        "RoutineAssignmentDayExercise",
        cascade="all, delete-orphan",
        order_by="RoutineAssignmentDayExercise.sort_order",
    )

    __table_args__ = (
        UniqueConstraint("assignment_id", "position", name="uq_routine_assignment_days_assignment_position"),
    )


class RoutineAssignmentDayMuscleGroup(Base):
    """Grupo muscular (0..n) de un día de la copia (design D1). Mismo patrón que
    `RoutineTemplateDayMuscleGroup`: PK compuesta, la fila **es** el atributo."""

    __tablename__ = "routine_assignment_day_muscle_groups"

    assignment_day_id = Column(
        String, ForeignKey("routine_assignment_days.id", ondelete="CASCADE"), primary_key=True
    )
    muscle_group = Column(String, primary_key=True)
    sort_order = Column(Integer, nullable=False, default=0)


class RoutineAssignmentDayExercise(Base):
    """Ejercicio agregado a un día de la copia, con su base y su estrategia de
    progresión propias (design D1): estar en esta tabla **es** estar en la
    copia — editar acá no toca la plantilla origen ni ninguna otra copia
    (invariante I3)."""

    __tablename__ = "routine_assignment_day_exercises"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_day_id = Column(
        String, ForeignKey("routine_assignment_days.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    strategy = Column(Enum(ProgressionStrategy), nullable=False, default=ProgressionStrategy.constant)
    base_sets = Column(
        Integer, nullable=False, default=DEFAULT_EXERCISE_BASE_SETS,
        server_default=str(DEFAULT_EXERCISE_BASE_SETS),
    )
    base_reps = Column(
        Integer, nullable=False, default=DEFAULT_EXERCISE_BASE_REPS,
        server_default=str(DEFAULT_EXERCISE_BASE_REPS),
    )
    base_weight_kg = Column(
        Float, nullable=False, default=DEFAULT_EXERCISE_BASE_WEIGHT_KG,
        server_default=str(DEFAULT_EXERCISE_BASE_WEIGHT_KG),
    )
    # `routine-exercise-intensity`: RIR (repeticiones en reserva) y pausa entre
    # series, ambos opcionales — un ejercicio puede no prescribirlos. Se guarda
    # SIEMPRE el RIR, nunca el RPE: son la misma escala invertida
    # (RPE = 10 - RIR) y el frontend convierte para mostrar. `rir` es Float
    # porque la escala admite medios (RIR 1.5 ⇔ RPE 8.5).
    rir = Column(Float, nullable=True)
    rest_seconds = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    exercise = relationship("Exercise")

    __table_args__ = (
        UniqueConstraint(
            "assignment_day_id", "exercise_id", name="uq_routine_assignment_day_exercises_day_exercise"
        ),
    )


class WorkoutSetLog(Base):
    """Registro histórico de progreso, grano **una fila = una serie**
    (`routine-progress-tracking`, design D3, reemplaza a `WorkoutLog`).

    El vínculo con la serie planificada que la originó es posicional: la tupla
    `(assignment_day_id, exercise_id, set_index)` identifica "la serie #k de
    ese ejercicio en ese día de esa copia" — las series planificadas no son
    filas, salen de `plan_sets(...)` en cada lectura (design D3). `set_index`
    usa la misma numeración 1-based que `PlannedSet.index`.

    `assignment_day_id` es nullable con `ondelete="SET NULL"`: quitar un día de
    la copia (o borrar la copia entera) no borra el histórico, solo desvincula
    la FK (invariante I7). `day_name` es un snapshot NOT NULL tomado al
    insertar, así el histórico conserva una etiqueta legible aunque el día se
    borre después.

    `performed_on` es la **sesión** (fecha calendario en
    `America/Argentina/Buenos_Aires`, `now_ar()`): marcar dos veces la misma
    serie el mismo día corrige la marca en vez de duplicarla (invariante I9),
    vía el `UNIQUE` de abajo.
    """

    __tablename__ = "workout_set_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    assignment_day_id = Column(
        String, ForeignKey("routine_assignment_days.id", ondelete="SET NULL"), nullable=True, index=True
    )
    day_name = Column(String, nullable=False)
    exercise_id = Column(String, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    set_index = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=False)
    note = Column(String, nullable=True)
    performed_on = Column(Date, nullable=False, index=True)
    performed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    assignment_day = relationship("RoutineAssignmentDay")
    exercise = relationship("Exercise")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "assignment_day_id", "exercise_id", "set_index", "performed_on",
            name="uq_workout_set_logs_user_day_exercise_set_performed_on",
        ),
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
    currency = Column(String, nullable=False)
    address = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    whatsapp_phone = Column(String, nullable=True)
    business_hours = Column(String, nullable=True)
    payment_alias = Column(String, nullable=True)
    payment_notes = Column(String, nullable=True)
    allow_cash = Column(Boolean, nullable=False, default=True)
    allow_transfer = Column(Boolean, nullable=False, default=True)
    onboarding_message = Column(String, nullable=True)
