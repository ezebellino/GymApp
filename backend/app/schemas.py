from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Literal, Annotated
from uuid import UUID

from sqlalchemy import func

from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator, field_serializer


Role = Literal["owner", "coach", "member"]
ThemeMode = Literal["dark", "light"]
ThemePreference = Literal["dark-gold", "dark-copper", "dark-olive"]
MembershipStatusLiteral = Literal["none", "active", "cancelled"]
MembershipIndicator = Literal["none", "up_to_date", "overdue", "suspended"]
InvitationStatus = Literal["none", "pending", "expired", "access_active"]
InvitationChannel = Literal["email", "phone"]


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_decimal="float",
        populate_by_name=True,
    )


def _strip_or_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class UserBase(BaseSchema):
    """Perfil compartido por alta/edición (sin membresía ni cuenta: ver deps dedicadas)."""

    first_name: Annotated[str, Field(min_length=1, max_length=80)]
    last_name: Optional[Annotated[str, Field(max_length=80)]] = None
    birth_date: Optional[date] = None
    weight_kg: Optional[Annotated[float, Field(ge=0, le=500)]] = None
    height_cm: Optional[Annotated[float, Field(ge=0, le=300)]] = None
    email: Optional[EmailStr] = None
    phone: Optional[Annotated[str, Field(max_length=30)]] = None
    role: Role

    @field_validator("first_name", "last_name", "phone", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return _strip_or_none(value)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        stripped = _strip_or_none(value)
        return stripped.lower() if stripped else stripped


class UserCreate(UserBase):
    role: Role = "member"
    password: Optional[str] = Field(None, min_length=6, max_length=100)


class UserUpdate(BaseSchema):
    first_name: Optional[Annotated[str, Field(min_length=1, max_length=80)]] = None
    last_name: Optional[Annotated[str, Field(max_length=80)]] = None
    birth_date: Optional[date] = None
    weight_kg: Optional[Annotated[float, Field(ge=0, le=500)]] = None
    height_cm: Optional[Annotated[float, Field(ge=0, le=300)]] = None
    email: Optional[EmailStr] = None
    phone: Optional[Annotated[str, Field(max_length=30)]] = None
    role: Optional[Role] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)

    @field_validator("first_name", "last_name", "phone", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return _strip_or_none(value)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        stripped = _strip_or_none(value)
        return stripped.lower() if stripped else stripped


class UserOut(BaseSchema):
    id: str
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    age: Optional[int] = None
    birth_date: Optional[date] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    email: Optional[str] = None
    email_verified: bool
    phone: Optional[str] = None
    phone_verified: bool
    role: Role
    is_active: bool
    membership_status: MembershipStatusLiteral
    membership_start_date: Optional[datetime] = None
    membership_cancelled_at: Optional[datetime] = None
    membership_indicator: MembershipIndicator
    invitation_status: InvitationStatus
    created_at: datetime
    theme_preference: Optional[ThemeMode] = None


class UserSummary(BaseSchema):
    """Proyección liviana de `User` para embeber en `PaymentOut`/`AttendanceOut`."""

    id: str
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Role


class ThemeModeIn(BaseSchema):
    theme_preference: ThemeMode


class MembershipCancelIn(BaseSchema):
    cancelled_at: Optional[datetime] = None


PaymentMethod = Literal["cash", "transfer"]


class PaymentBase(BaseSchema):
    user_id: Annotated[str, Field(min_length=36, max_length=36)]
    amount: Annotated[float, Field(ge=0)]
    method: PaymentMethod
    method_channel: Optional[str] = Field(
        default=None,
        max_length=30,
        description="Sub-canal para transfer: mercadopago, cuentadni, personalpay, etc.",
    )
    note: Optional[str] = Field(None, max_length=500)
    period_month: Annotated[int, Field(ge=1, le=12)]
    period_year: Annotated[int, Field(ge=2020, le=2100)]


class PaymentCreate(PaymentBase):
    pass


class PaymentOut(PaymentBase):
    id: UUID
    created_at: datetime
    user: Optional[UserSummary] = None

    class Config:
        from_attributes = True


class UserPaymentStatus(BaseSchema):
    user_id: str
    full_name: str
    is_up_to_date: bool
    last_payment_month: Optional[int] = None
    last_payment_year: Optional[int] = None


class AttendanceBase(BaseSchema):
    user_id: Annotated[str, Field(min_length=36, max_length=36)]


class AttendanceCheckinIn(BaseSchema):
    user_id: Optional[Annotated[str, Field(min_length=36, max_length=36)]] = None
    q: Optional[str] = Field(None, max_length=120, description="nombre, email o telefono")


class AttendanceOut(AttendanceBase):
    id: UUID
    checkin_at: datetime
    user: UserSummary

    class Config:
        from_attributes = True


class AttendanceReportItem(BaseSchema):
    bucket: str
    count: int


class NewClientsReportItem(BaseSchema):
    bucket: str
    count: int


class RevenueReportItem(BaseSchema):
    bucket: str
    total: float


class RoutineExerciseOption(BaseSchema):
    exercise_id: str
    name: str
    muscle_group: str
    description: Optional[str] = None
    is_active: bool
    sort_order: int


class RoutineDayOut(BaseSchema):
    id: str
    name: str
    muscle_groups: list[str]
    day_order: int
    exercises: list[RoutineExerciseOption]


class RoutineCatalogExercise(BaseSchema):
    id: str
    name: str
    muscle_group: str
    description: Optional[str] = None


class RoutineCatalogGroup(BaseSchema):
    muscle_group: str
    exercises: list[RoutineCatalogExercise]


class RoutineExerciseCreate(BaseSchema):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    muscle_group: Annotated[str, Field(min_length=1, max_length=40)]
    description: Optional[Annotated[str, Field(max_length=220)]] = None
    is_active: bool = True
    # --- Base de progresión (add-routine-templates, design D3) --------------
    base_sets: Annotated[int, Field(ge=1)] = 3
    base_reps: Annotated[int, Field(ge=1)] = 10
    base_weight_kg: Annotated[float, Field(ge=0)] = 0

    @field_validator("name", "muscle_group", "description", mode="before")
    @classmethod
    def normalize_strings(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class RoutineExerciseUpdate(BaseSchema):
    name: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    muscle_group: Optional[Annotated[str, Field(min_length=1, max_length=40)]] = None
    description: Optional[Annotated[str, Field(max_length=220)]] = None
    is_active: Optional[bool] = None
    base_sets: Optional[Annotated[int, Field(ge=1)]] = None
    base_reps: Optional[Annotated[int, Field(ge=1)]] = None
    base_weight_kg: Optional[Annotated[float, Field(ge=0)]] = None

    @field_validator("name", "muscle_group", "description", mode="before")
    @classmethod
    def normalize_optional_strings(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class RoutineExerciseManageOut(BaseSchema):
    id: str
    name: str
    muscle_group: str
    description: Optional[str] = None
    is_active: bool
    day_ids: list[str]
    base_sets: int
    base_reps: int
    base_weight_kg: float


class RoutineDaySelectionUpdate(BaseSchema):
    exercise_ids: list[str] = Field(default_factory=list)


class WorkoutLogCreate(BaseSchema):
    day_id: str
    exercise_id: str
    sets_count: Optional[Annotated[int, Field(ge=1, le=20)]] = None
    reps: Optional[Annotated[int, Field(ge=1, le=200)]] = None
    weight_kg: Annotated[float, Field(ge=0, le=500)] = 0
    note: Optional[Annotated[str, Field(max_length=220)]] = None

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class WorkoutLogUpdate(BaseSchema):
    sets_count: Optional[Annotated[int, Field(ge=1, le=20)]] = None
    reps: Optional[Annotated[int, Field(ge=1, le=200)]] = None
    weight_kg: Optional[Annotated[float, Field(ge=0, le=500)]] = None
    note: Optional[Annotated[str, Field(max_length=220)]] = None

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class WorkoutLogOut(BaseSchema):
    id: str
    user_id: str
    day_id: str
    day_name: str
    exercise_id: str
    exercise_name: str
    muscle_group: str
    sets_count: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: float
    note: Optional[str] = None
    performed_at: datetime


class RoutineDayProgress(BaseSchema):
    day_id: str
    day_name: str
    muscle_groups: list[str]
    active_exercise_count: int
    log_count: int
    last_performed_at: Optional[datetime] = None


class ProgressImprovement(BaseSchema):
    exercise_name: str
    start_weight: float
    end_weight: float
    delta_weight: float


class UserProgressSummary(BaseSchema):
    user_id: str
    user_name: str
    gym_name: str
    log_count: int
    attendance_count: int
    unique_days: int
    unique_exercises: int
    total_volume: float
    last_training: Optional[datetime] = None
    best_exercise_name: Optional[str] = None
    best_weight_kg: Optional[float] = None
    top_improvement: Optional[ProgressImprovement] = None
    motivation: str


class SettingsBase(BaseSchema):
    gym_name: Annotated[str, Field(min_length=1, max_length=100)]
    admin_name: Optional[Annotated[str, Field(max_length=120)]] = None
    theme_preference: Optional[ThemePreference] = "dark-gold"
    currency: Annotated[str, Field(min_length=1, max_length=10)]
    default_fee: Annotated[Decimal, Field(ge=0)]
    address: Optional[Annotated[str, Field(max_length=200)]] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    whatsapp_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    business_hours: Optional[Annotated[str, Field(max_length=160)]] = None
    payment_alias: Optional[Annotated[str, Field(max_length=120)]] = None
    payment_notes: Optional[Annotated[str, Field(max_length=280)]] = None
    payment_reminder_message: Optional[Annotated[str, Field(max_length=500)]] = None
    payment_reminder_last_sent_at: Optional[datetime] = None
    late_fee_grace_days: Annotated[int, Field(ge=0, le=60)] = 5
    allow_cash: bool = True
    allow_transfer: bool = True
    onboarding_message: Optional[Annotated[str, Field(max_length=280)]] = None

    @field_validator(
        "gym_name",
        "admin_name",
        "currency",
        "address",
        "contact_phone",
        "whatsapp_phone",
        "business_hours",
        "payment_alias",
        "payment_notes",
        "payment_reminder_message",
        "onboarding_message",
        mode="before",
    )
    @classmethod
    def strip_strings(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("contact_email", mode="before")
    @classmethod
    def normalize_contact_email(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_serializer("default_fee")
    def serialize_decimal(self, value: Decimal, _info):
        return float(value)


class Settings(SettingsBase):
    pass


class SettingsUpdate(BaseSchema):
    gym_name: Optional[Annotated[str, Field(min_length=1, max_length=100)]] = None
    admin_name: Optional[Annotated[str, Field(max_length=120)]] = None
    theme_preference: Optional[ThemePreference] = None
    currency: Optional[Annotated[str, Field(min_length=1, max_length=10)]] = None
    default_fee: Optional[Annotated[Decimal, Field(ge=0)]] = None
    address: Optional[Annotated[str, Field(max_length=200)]] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    whatsapp_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    business_hours: Optional[Annotated[str, Field(max_length=160)]] = None
    payment_alias: Optional[Annotated[str, Field(max_length=120)]] = None
    payment_notes: Optional[Annotated[str, Field(max_length=280)]] = None
    payment_reminder_message: Optional[Annotated[str, Field(max_length=500)]] = None
    payment_reminder_last_sent_at: Optional[datetime] = None
    late_fee_grace_days: Optional[Annotated[int, Field(ge=0, le=60)]] = None
    allow_cash: Optional[bool] = None
    allow_transfer: Optional[bool] = None
    onboarding_message: Optional[Annotated[str, Field(max_length=280)]] = None


class SettingsOut(SettingsBase):
    pass


# --- Invitación de miembro (member-invitation) ------------------------------


class InvitationCreateOut(BaseSchema):
    """Respuesta de `POST /users/{id}/invitation`: los dos links en claro."""

    email_link: str
    phone_link: str
    expires_at: datetime


class InvitationStateOut(BaseSchema):
    """Respuesta de `GET /invitations/{channel}/{token}`."""

    first_name: str
    email_verified: bool
    phone_verified: bool
    can_set_password: bool


class InvitationCompleteIn(BaseSchema):
    password: str = Field(min_length=6, max_length=100)


# --- add-routine-templates: bloque nuevo (design D10, append) --------------
# Plantillas de rutina, motor de progresión y asignación a clientes. Bloque
# delimitado a propósito: aunque otra sesión edite `schemas.py`, el conflicto de
# merge contra este archivo es nulo o trivial (las únicas ediciones in situ son
# los tres campos de base de `RoutineExercise*` más arriba, design D3).

ProgressionStrategyLiteral = Literal["constant", "pyramid", "inverted", "drop_set", "rest_pause"]
RoutineAssignmentStatusLiteral = Literal["active", "alternative"]


def _normalize_tag(value):
    if isinstance(value, str):
        value = value.strip().upper()
        return value or ""
    return value


def _unique_day_ids(value: list[str]) -> list[str]:
    if len(set(value)) != len(value):
        raise ValueError("day_ids no puede tener ids repetidos")
    return value


class PlannedSetOut(BaseSchema):
    """Una serie calculada por el motor de progresión (`app/progression.py`)."""

    index: int
    weight_kg: float
    reps: int
    note: Optional[str] = None


class ExerciseBaseOut(BaseSchema):
    sets: int
    reps: int
    weight_kg: float


class RoutineTemplateExerciseOut(BaseSchema):
    exercise_id: str
    name: str
    muscle_group: str
    base: ExerciseBaseOut
    is_active: bool
    strategy: ProgressionStrategyLiteral
    planned_sets: list[PlannedSetOut]


class RoutineTemplateExerciseUpdate(BaseSchema):
    """`PUT /routines/templates/{id}/days/{day_id}/exercises/{exercise_id}`."""

    is_active: Optional[bool] = None
    strategy: Optional[ProgressionStrategyLiteral] = None


class RoutineTemplateDayOut(BaseSchema):
    day_id: str
    name: str
    muscle_groups: list[str]
    position: int
    exercises: list[RoutineTemplateExerciseOut]


class RoutineTemplateSummary(BaseSchema):
    id: str
    name: str
    tag: str
    day_count: int
    assignment_count: int
    created_at: datetime


class RoutineTemplateDetail(BaseSchema):
    id: str
    name: str
    tag: str
    created_at: datetime
    updated_at: datetime
    days: list[RoutineTemplateDayOut]


class RoutineTemplateCreate(BaseSchema):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    tag: Annotated[str, Field(max_length=24)] = ""
    day_ids: Annotated[list[str], Field(min_length=1)]

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return _strip_or_none(value)

    @field_validator("tag", mode="before")
    @classmethod
    def normalize_tag(cls, value):
        return _normalize_tag(value) if value is not None else ""

    @field_validator("day_ids")
    @classmethod
    def validate_day_ids(cls, value):
        return _unique_day_ids(value)


class RoutineTemplateUpdate(BaseSchema):
    name: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    tag: Optional[Annotated[str, Field(max_length=24)]] = None
    day_ids: Optional[Annotated[list[str], Field(min_length=1)]] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return _strip_or_none(value)

    @field_validator("tag", mode="before")
    @classmethod
    def normalize_tag(cls, value):
        return _normalize_tag(value)

    @field_validator("day_ids")
    @classmethod
    def validate_day_ids(cls, value):
        return _unique_day_ids(value) if value is not None else value


class LastAdjustmentOut(BaseSchema):
    by_name: str
    at: datetime


class RoutineAssignmentOut(BaseSchema):
    id: str
    user_id: str
    template_id: str
    template_name: str
    template_tag: str
    status: RoutineAssignmentStatusLiteral
    starts_on: date
    created_at: datetime
    adjustments_count: int
    last_adjustment: Optional[LastAdjustmentOut] = None


class RoutineAssignmentBaseOverrideIn(BaseSchema):
    exercise_id: str
    sets: Annotated[int, Field(ge=1)]
    reps: Annotated[int, Field(ge=1)]
    weight_kg: Annotated[float, Field(ge=0)]


class RoutineAssignmentCreate(BaseSchema):
    template_id: str
    status: RoutineAssignmentStatusLiteral
    starts_on: Optional[date] = None
    base_overrides: list[RoutineAssignmentBaseOverrideIn] = Field(default_factory=list)


class RoutineAssignmentUpdate(BaseSchema):
    status: RoutineAssignmentStatusLiteral


class RoutineAssignmentBaseUpdate(BaseSchema):
    sets: Annotated[int, Field(ge=1)]
    reps: Annotated[int, Field(ge=1)]
    weight_kg: Annotated[float, Field(ge=0)]


class MemberRoutineTemplateOut(RoutineAssignmentOut):
    """`GET /routines/my/templates/{assignment_id}`: la asignación + el plan ya
    calculado (solo días de la plantilla, y por día solo ejercicios activos)."""

    days: list[RoutineTemplateDayOut]


def _bucket_expr(column, bucket: Literal["day", "week", "month"]):
    with_tz = func.timezone("America/Argentina/Buenos_Aires", func.timezone("UTC", column))

    if bucket == "day":
        return func.date_trunc("day", with_tz)
    if bucket == "week":
        return func.date_trunc("week", with_tz)
    return func.date_trunc("month", with_tz)
