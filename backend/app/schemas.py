from datetime import date, datetime
from typing import Optional, Literal, Annotated
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import func

from pydantic import (
    BaseModel,
    Field,
    EmailStr,
    ConfigDict,
    field_validator,
    model_validator,
)

from .models import MuscleGroup, TrainingType


Role = Literal["owner", "coach", "member"]
ThemeMode = Literal["dark", "light"]
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
    # Obligatorio solo para role == "member" (`membership-plans`): se valida en el
    # endpoint, no acá, porque la obligatoriedad es condicional al rol.
    membership_plan_id: Optional[str] = None


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


class MembershipPlanSummary(BaseSchema):
    """Proyección liviana de `MembershipPlan` para embeber en `UserOut` (D2)."""

    id: str
    name: str
    current_amount: Optional[int] = None


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
    # `membership-plans`: opcionales a propósito (D5 del design de ese change) aunque
    # el backend siempre los mande — los `makeUser` del frontend construyen `User`
    # literal y no deben romper.
    membership_plan: Optional[MembershipPlanSummary] = None
    plan_since: Optional[date] = None


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


class MembershipActivateIn(BaseSchema):
    """`POST /users/{user_id}/membership/activate` (D2.2): si el usuario no tiene
    plan asignado, este campo lo asigna y activa la membresía en la misma
    operación. Opcional para que el `{}` que ya manda el frontend siga siendo
    válido cuando el usuario ya tiene plan."""

    membership_plan_id: Optional[str] = None


class UserPlanChangeIn(BaseSchema):
    """`POST /users/{user_id}/plan` (`membership-plans`, D2): sirve tanto al cambio
    de plan como a la asignación inicial de un miembro preexistente sin plan."""

    membership_plan_id: str


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
    # `amount` opcional (`rebuild-payments-with-plan-pricing`, design D3.1): omitido o
    # `null` ⇒ el backend usa el precio de referencia vigente del plan del miembro.
    # Presente ⇒ se guarda tal cual (descuento/corrección puntual). Se redeclara acá
    # (no en `PaymentBase`) para no aflojar el contrato de `PaymentOut`, que sigue
    # exigiendo `amount` en la respuesta.
    amount: Annotated[Optional[float], Field(default=None, ge=0)] = None

    # Corrección `verification.md` hallazgo 3 (deuda preexistente): `method_channel`
    # es un sub-canal de "transfer" (mercadopago, cuentadni, etc.); con `method="cash"`
    # no tiene sentido y antes se aceptaba sin validar (podía quedar un efectivo con
    # canal "Mercado Pago" en `/payments/reports/by_channel`).
    @model_validator(mode="after")
    def _method_channel_solo_con_transfer(self) -> "PaymentCreate":
        if self.method != "transfer" and self.method_channel is not None:
            raise ValueError("method_channel solo es válido cuando method es 'transfer'")
        return self


class PaymentPlanRef(BaseSchema):
    """Foto del plan con el que se registró un pago (D1, D3.2): se arma desde las
    columnas de la propia fila de `Payment`, nunca desde el plan actual del miembro."""

    id: Optional[str] = None
    name: str
    reference_amount: Optional[int] = None


class PaymentOut(PaymentBase):
    id: UUID
    created_at: datetime
    user: Optional[UserSummary] = None
    # `None` solo para pagos anteriores a la migración de la foto (D2/D4, invariante
    # I5): de acá en adelante todo pago creado por la API trae `plan`.
    plan: Optional[PaymentPlanRef] = None

    class Config:
        from_attributes = True


class PaymentsPeriodSummaryOut(BaseSchema):
    """`GET /payments/summary` (D3.4): indicadores de un período mes/año — no
    confundir con `/payments/reports/kpis`, que agrega por `created_at`."""

    period_year: int
    period_month: int
    payments_count: int
    amount_sum: float
    members_active: int
    members_paid: int
    members_pending: int


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


class WorkoutSetMarkIn(BaseSchema):
    """`PUT /routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}`
    (`routine-progress-tracking`, design D6): marca o corrige una serie. Upsert
    idempotente por `(user, day, exercise, set_index, hoy)` — el servidor
    resuelve `performed_on`, no el cliente."""

    weight_kg: Annotated[float, Field(ge=0, le=500)]
    reps: Annotated[int, Field(ge=1, le=200)]
    note: Optional[Annotated[str, Field(max_length=220)]] = None

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class LoggedSetOut(BaseSchema):
    """La marca de **hoy** de una serie planificada, embebida en
    `PlannedSetOut` (design D6): un solo payload alimenta toda la pantalla de
    ejecución, sin request extra para saber qué está marcado."""

    weight_kg: float
    reps: int
    performed_at: datetime


class WorkoutSetLogOut(BaseSchema):
    """Una fila del histórico (`GET /routines/users/{id}/logs`,
    `GET /routines/my/logs`), grano una fila = una serie (design D3): sin
    `sets_count`, con `set_index`."""

    id: str
    user_id: str
    # Optional (design D3): `assignment_day_id` queda en `NULL` cuando se
    # quita el día de la copia o se borra la copia entera; `day_name` es el
    # snapshot que sigue identificando el registro.
    assignment_day_id: Optional[str] = None
    day_name: str
    exercise_id: str
    exercise_name: str
    muscle_group: Optional[str] = None
    set_index: int
    reps: int
    weight_kg: float
    note: Optional[str] = None
    performed_on: date
    performed_at: datetime


class LoggedExerciseOut(BaseSchema):
    """`GET /routines/users/{user_id}/logged-exercises` (design D6, D10):
    ejercicios **con registros** de ese Miembro, alimentado por el histórico —
    no por la copia vigente, para que un ejercicio ya quitado siga siendo
    filtrable."""

    exercise_id: str
    name: str
    muscle_group: Optional[str] = None


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


class ActiveAssignmentSummary(BaseSchema):
    """`member-routine-view`, requirement "El overview y el progreso siguen
    siempre la asignación Activa": lo mínimo que hace observable ese
    requirement en `progress-summary`/`progress-report` sin inventar una
    pantalla nueva. `None` cuando el Miembro no tiene ninguna asignación
    Activa (aunque tenga Alternativas)."""

    assignment_id: str
    template_name: str


class UserProgressSummary(BaseSchema):
    user_id: str
    user_name: str
    gym_name: str
    log_count: int
    attendance_count: int
    session_count: int
    unique_exercises: int
    total_volume: float
    last_training: Optional[datetime] = None
    best_exercise_name: Optional[str] = None
    best_weight_kg: Optional[float] = None
    top_improvement: Optional[ProgressImprovement] = None
    motivation: str
    score: int
    active_assignment: Optional[ActiveAssignmentSummary] = None


class SettingsBase(BaseSchema):
    gym_name: Annotated[str, Field(min_length=1, max_length=100)]
    admin_name: Optional[Annotated[str, Field(max_length=120)]] = None
    currency: Annotated[str, Field(min_length=1, max_length=10)]
    address: Optional[Annotated[str, Field(max_length=200)]] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    whatsapp_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    business_hours: Optional[Annotated[str, Field(max_length=160)]] = None
    payment_alias: Optional[Annotated[str, Field(max_length=120)]] = None
    payment_notes: Optional[Annotated[str, Field(max_length=280)]] = None
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


class Settings(SettingsBase):
    pass


class SettingsUpdate(BaseSchema):
    gym_name: Optional[Annotated[str, Field(min_length=1, max_length=100)]] = None
    admin_name: Optional[Annotated[str, Field(max_length=120)]] = None
    currency: Optional[Annotated[str, Field(min_length=1, max_length=10)]] = None
    address: Optional[Annotated[str, Field(max_length=200)]] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    whatsapp_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    business_hours: Optional[Annotated[str, Field(max_length=160)]] = None
    payment_alias: Optional[Annotated[str, Field(max_length=120)]] = None
    payment_notes: Optional[Annotated[str, Field(max_length=280)]] = None
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


class PlannedSetOut(BaseSchema):
    """Una serie calculada por el motor de progresión (`app/progression.py`).

    `logged` (`routine-progress-tracking`, design D6): la marca de **hoy** para
    este `set_index`, solo cuando el llamador es el plan del Miembro
    (`get_my_template`); `None` en cualquier otra serialización (plantilla,
    editor de la copia por Dueño/Coach)."""

    index: int
    weight_kg: float
    reps: int
    note: Optional[str] = None
    logged: Optional[LoggedSetOut] = None


class PlannedSetsPreviewOut(BaseSchema):
    """`GET /routines/progression/preview` (`member-routine-copies`, design
    D13): previsualización sin estado del plan de series para una tupla
    `(strategy, sets, reps, weight_kg)` — exactamente `plan_sets(...)`, con
    `logged` siempre `None`. Sirve igual al editor de plantilla y al de la
    copia (D8)."""

    planned_sets: list[PlannedSetOut]


class ExerciseBaseOut(BaseSchema):
    sets: int
    reps: int
    weight_kg: float


class ExerciseBaseIn(BaseSchema):
    """Base opcional de un par (día, ejercicio) en el `PUT` de guardado del
    borrador (`template-owned-routine-days`, design D5). Ausente ⇒ constante
    por defecto para un par nuevo, o la base ya guardada para uno existente."""

    sets: Annotated[int, Field(ge=1)]
    reps: Annotated[int, Field(ge=1)]
    weight_kg: Annotated[float, Field(ge=0)]


class RoutineTemplateExerciseOut(BaseSchema):
    exercise_id: str
    name: str
    # Optional (H1, corrección de verificación, parte 2): idem catálogo.
    muscle_group: Optional[str] = None
    base: ExerciseBaseOut
    strategy: ProgressionStrategyLiteral
    # `routine-exercise-intensity`: intensidad y descanso prescritos, los dos
    # opcionales. `rir` viaja SIEMPRE como RIR — el RPE es la misma escala
    # invertida (RPE = 10 - rir) y lo deriva el cliente, no el servidor.
    rir: Optional[float] = None
    rest_seconds: Optional[int] = None
    planned_sets: list[PlannedSetOut]


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
    """`day_ids` se retiró del schema (design D6): un payload que lo trae es un
    422 (`extra="forbid"`), no un campo ignorado en silencio. `POST` crea la
    plantilla y su Día 1 en el mismo request — no hace falta indicar días acá."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=120)]
    tag: Annotated[str, Field(max_length=24)] = ""

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return _strip_or_none(value)

    @field_validator("tag", mode="before")
    @classmethod
    def normalize_tag(cls, value):
        return _normalize_tag(value) if value is not None else ""


class RoutineTemplateUpdate(BaseSchema):
    """`day_ids` se retiró (design D6): la edición de días pasa por
    `PUT /routines/templates/{id}/days` (`RoutineTemplateDaysUpdate`)."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    tag: Optional[Annotated[str, Field(max_length=24)]] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return _strip_or_none(value)

    @field_validator("tag", mode="before")
    @classmethod
    def normalize_tag(cls, value):
        return _normalize_tag(value)


def _unique_exercise_ids(exercises: list["RoutineTemplateDayExerciseInput"]) -> list["RoutineTemplateDayExerciseInput"]:
    ids = [item.exercise_id for item in exercises]
    if len(set(ids)) != len(ids):
        raise ValueError("No se puede repetir un ejercicio dentro del mismo día")
    return exercises


def _dedupe_muscle_groups(value: list[MuscleGroup]) -> list[MuscleGroup]:
    seen: list[MuscleGroup] = []
    for item in value:
        if item not in seen:
            seen.append(item)
    return seen


class RoutineTemplateDayExerciseInput(BaseSchema):
    """Un ejercicio dentro de un día, en el `PUT` de guardado del borrador
    (design D5). `strategy`/`base` ausentes en un par **nuevo** toman
    `constant` y la constante por defecto del servidor; en un par **existente**
    conservan lo ya guardado."""

    exercise_id: str
    strategy: Optional[ProgressionStrategyLiteral] = None
    base: Optional[ExerciseBaseIn] = None
    # `routine-exercise-intensity`: a diferencia de `strategy`/`base`, estos
    # dos son de **reemplazo**, no de "ausente ⇒ conservar": el borrador manda
    # siempre el estado completo, así que `None` significa "sin prescribir" y
    # borra lo que hubiera. RIR va en la escala 0-10 (0 = al fallo) y admite
    # medios; la pausa en segundos.
    rir: Optional[Annotated[float, Field(ge=0, le=10)]] = None
    rest_seconds: Optional[Annotated[int, Field(ge=0, le=3600)]] = None


class RoutineTemplateDayInput(BaseSchema):
    """Un día dentro del `PUT` de guardado del borrador (design D5). `day_id`
    presente ⇒ conserva esa fila (tiene que pertenecer a la plantilla, 400 si
    no); `None` ⇒ día nuevo. `muscle_groups` puede quedar vacío ("Día 1 sin
    grupo muscular asignado")."""

    day_id: Optional[str] = None
    muscle_groups: list[MuscleGroup] = Field(default_factory=list)
    exercises: list[RoutineTemplateDayExerciseInput] = Field(default_factory=list)

    @field_validator("muscle_groups")
    @classmethod
    def dedupe_muscle_groups(cls, value):
        return _dedupe_muscle_groups(value)

    @field_validator("exercises")
    @classmethod
    def validate_exercises(cls, value):
        return _unique_exercise_ids(value)


class RoutineTemplateDaysUpdate(BaseSchema):
    """`PUT /routines/templates/{template_id}/days`: reemplazo completo con
    identidad explícita (design D5). El orden de la lista **es** el dato: la
    posición del día es su índice + 1, y el `sort_order` del ejercicio es su
    índice. `1 <= len(days) <= 5` cubre "no se puede agregar un sexto día" y
    "no se puede quitar el último día" con un solo `Field`."""

    days: Annotated[list[RoutineTemplateDayInput], Field(min_length=1, max_length=5)]

    @field_validator("days")
    @classmethod
    def validate_unique_day_ids(cls, value):
        """Un `day_id` no nulo repetido colapsaría dos días en una sola fila y
        rompería I1 (posiciones contiguas 1..N). Los `day_id` `null` (días
        nuevos) sí pueden repetirse."""
        day_ids = [day.day_id for day in value if day.day_id is not None]
        if len(set(day_ids)) != len(day_ids):
            raise ValueError("No se puede repetir un día dentro del mismo guardado")
        return value


class RoutineAssignmentOut(BaseSchema):
    """`member-routine-copies`, design D2b: `template_id` es `Optional` (queda
    `None` si se borró la plantilla origen); `template_name`/`template_tag`
    son siempre el snapshot tomado al copiar, nunca derivados de la relación
    viva — así la etiqueta de una copia no cambia si alguien renombra o borra
    la plantilla después."""

    id: str
    user_id: str
    template_id: Optional[str] = None
    template_name: str
    template_tag: str
    status: RoutineAssignmentStatusLiteral
    starts_on: date
    created_at: datetime


class RoutineAssignmentCreate(BaseSchema):
    """`base_overrides` se retiró (design D4): un payload que lo incluya es
    **422** (`extra="forbid"`), no un campo ignorado en silencio — mismo
    criterio que D6 de `template-owned-routine-days` con `day_ids`."""

    model_config = ConfigDict(extra="forbid")

    template_id: str
    status: RoutineAssignmentStatusLiteral
    starts_on: Optional[date] = None


class RoutineAssignmentUpdate(BaseSchema):
    status: RoutineAssignmentStatusLiteral


class MemberRoutineTemplateOut(RoutineAssignmentOut):
    """`GET /routines/my/templates/{assignment_id}`: la asignación + el plan ya
    calculado de la **copia** (design D6) — no de la plantilla origen."""

    days: list[RoutineTemplateDayOut]


def _bucket_expr(column, bucket: Literal["day", "week", "month"]):
    with_tz = func.timezone("America/Argentina/Buenos_Aires", func.timezone("UTC", column))

    if bucket == "day":
        return func.date_trunc("day", with_tz)
    if bucket == "week":
        return func.date_trunc("week", with_tz)
    return func.date_trunc("month", with_tz)


# ---------------------------------------------------------------------------
# Planes de membresía (`membership-plans`, design D1/D2)
# ---------------------------------------------------------------------------


class MembershipPlanBase(BaseSchema):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    description: Optional[Annotated[str, Field(max_length=500)]] = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return _strip_or_none(value)


class MembershipPlanCreate(MembershipPlanBase):
    # El precio inicial es obligatorio (D2): un plan sin precio no sirve para nada.
    amount: Annotated[int, Field(ge=0)]


class MembershipPlanUpdate(BaseSchema):
    # Nunca precio ni is_active (D2): eso va por endpoints/subrecursos dedicados.
    name: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    description: Optional[Annotated[str, Field(max_length=500)]] = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return _strip_or_none(value)


class MembershipPlanPriceCreate(BaseSchema):
    amount: Annotated[int, Field(ge=0)]
    effective_from: Optional[date] = None


class MembershipPlanPriceOut(BaseSchema):
    id: str
    amount: int
    effective_from: date
    created_at: datetime
    created_by_user_id: Optional[str] = None


class MembershipPlanOut(BaseSchema):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    current_price: Optional[MembershipPlanPriceOut] = None
    members_count: int
    created_at: datetime
    updated_at: datetime


class MembershipPlanDetail(MembershipPlanOut):
    price_history: list[MembershipPlanPriceOut]


# ---------------------------------------------------------------------------
# Catálogo de ejercicios (`exercise-catalog`, design D1/D2/D6/D7)
# ---------------------------------------------------------------------------


MediaKind = Literal["file", "external"]


def _validate_http_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("La URL debe tener formato http(s) válido")
    return value


class ExerciseBase(BaseSchema):
    """Nombre obligatorio y no vacío tras `strip` (requirement "Nombre vacío
    rechazado"); grupo muscular y tipos validados contra las listas fijas
    (`MuscleGroup`/`TrainingType`, design D1/D2) directo por Pydantic."""

    name: Annotated[str, Field(min_length=1, max_length=120)]
    description: Optional[Annotated[str, Field(max_length=500)]] = None
    muscle_group: Optional[MuscleGroup] = None
    training_types: list[TrainingType] = Field(default_factory=list)
    external_media_url: Optional[Annotated[str, Field(max_length=500)]] = None

    @field_validator("name", "description", "external_media_url", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return _strip_or_none(value)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("El nombre no puede estar vacío")
        return value

    @field_validator("external_media_url")
    @classmethod
    def validate_external_media_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _validate_http_url(value)

    @field_validator("training_types")
    @classmethod
    def dedupe_training_types(cls, value: list[TrainingType]) -> list[TrainingType]:
        seen: list[TrainingType] = []
        for item in value:
            if item not in seen:
                seen.append(item)
        return seen


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseSchema):
    """Todos los campos opcionales (`PATCH`, exclude_unset). `training_types`
    reemplaza el set completo cuando se envía (design D7), no se mergea."""

    name: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    description: Optional[Annotated[str, Field(max_length=500)]] = None
    muscle_group: Optional[MuscleGroup] = None
    training_types: Optional[list[TrainingType]] = None
    external_media_url: Optional[Annotated[str, Field(max_length=500)]] = None

    @field_validator("name", "description", "external_media_url", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return _strip_or_none(value)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: Optional[str]) -> Optional[str]:
        # H3 (verificación): antes solo rechazaba una `str` en blanco, pero
        # `strip_strings` ya convirtió `"   "` en `None` antes de llegar acá, así
        # que ese caso pasaba de largo (y `{"name": null}` explícito, también).
        # `name` es NOT NULL en `Exercise`: un `PATCH` que lo manda a `None`
        # tiene que ser 422, no un 500 en `_normalize_name(None)` del router.
        # Nota: si el campo no viene en el payload, Pydantic no corre este
        # validador (comportamiento estándar de v2 sin `validate_default`), así
        # que un `PATCH` que omite `name` sigue sin verse afectado.
        if value is None or not value.strip():
            raise ValueError("El nombre no puede estar vacío")
        return value

    @field_validator("external_media_url")
    @classmethod
    def validate_external_media_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _validate_http_url(value)

    @field_validator("training_types")
    @classmethod
    def dedupe_training_types(cls, value: Optional[list[TrainingType]]) -> Optional[list[TrainingType]]:
        if value is None:
            return value
        seen: list[TrainingType] = []
        for item in value:
            if item not in seen:
                seen.append(item)
        return seen


class ExerciseOut(BaseSchema):
    id: str
    name: str
    description: Optional[str] = None
    muscle_group: Optional[MuscleGroup] = None
    training_types: list[TrainingType] = Field(default_factory=list)
    is_active: bool
    external_media_url: Optional[str] = None
    # --- Media derivada (design D3/D6): el backend decide la prioridad, la UI
    # solo lee `media_kind` --------------------------------------------------
    media_kind: Optional[MediaKind] = None
    media_file_url: Optional[str] = None
    media_content_type: Optional[str] = None
    media_filename: Optional[str] = None
    media_size_bytes: Optional[int] = None


class ExerciseMetaOut(BaseSchema):
    """`GET /exercises/meta`: única fuente de verdad de las listas fijas,
    derivada directo de los enums de Python (design D7)."""

    muscle_groups: list[MuscleGroup]
    training_types: list[TrainingType]
