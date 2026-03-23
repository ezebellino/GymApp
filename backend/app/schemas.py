from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal, Annotated
from uuid import UUID

from sqlalchemy import func

from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator, field_serializer


Role = Literal["owner", "coach"]


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_decimal="float",
        populate_by_name=True,
    )


class UserBase(BaseSchema):
    full_name: str = Field(min_length=1, max_length=120)
    email: Annotated[str, Field(min_length=1, max_length=120)]
    role: Role
    is_active: bool = True


class UserCreate(UserBase):
    role: Role = "coach"
    password: str = Field(min_length=6, max_length=100)


class UserUpdate(BaseSchema):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)


class UserOut(UserBase):
    id: str
    email_verified: bool


class ClientBase(BaseSchema):
    full_name: Annotated[str, Field(min_length=1, max_length=120)]
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    is_active: bool = True

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("phone")
    @classmethod
    def strip_phone(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value else value


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseSchema):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    is_active: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def strip_name_opt(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value else value


class ClientOut(ClientBase):
    id: str
    join_date: datetime


PaymentMethod = Literal["cash", "transfer"]


class PaymentBase(BaseSchema):
    client_id: Annotated[str, Field(min_length=36, max_length=36)]
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
    client: Optional[ClientOut] = None

    class Config:
        from_attributes = True


class ClientStatus(BaseSchema):
    client_id: str
    full_name: str
    is_up_to_date: bool
    last_payment_month: Optional[int] = None
    last_payment_year: Optional[int] = None


class AttendanceBase(BaseSchema):
    client_id: Annotated[str, Field(min_length=36, max_length=36)]


class AttendanceCheckinIn(BaseSchema):
    client_id: Optional[Annotated[str, Field(min_length=36, max_length=36)]] = None
    q: Optional[str] = Field(None, max_length=120, description="nombre, email o telefono")


class AttendanceOut(AttendanceBase):
    id: UUID
    checkin_at: datetime
    client: ClientOut

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


class WorkoutLogOut(BaseSchema):
    id: str
    client_id: str
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


class SettingsBase(BaseSchema):
    gym_name: Annotated[str, Field(min_length=1, max_length=100)]
    currency: Annotated[str, Field(min_length=1, max_length=10)]
    default_fee: Annotated[Decimal, Field(ge=0)]
    address: Optional[Annotated[str, Field(max_length=200)]] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    whatsapp_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    business_hours: Optional[Annotated[str, Field(max_length=160)]] = None
    payment_alias: Optional[Annotated[str, Field(max_length=120)]] = None
    payment_notes: Optional[Annotated[str, Field(max_length=280)]] = None
    late_fee_grace_days: Annotated[int, Field(ge=0, le=60)] = 5
    allow_cash: bool = True
    allow_transfer: bool = True
    onboarding_message: Optional[Annotated[str, Field(max_length=280)]] = None

    @field_validator(
        "gym_name",
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

    @field_serializer("default_fee")
    def serialize_decimal(self, value: Decimal, _info):
        return float(value)


class Settings(SettingsBase):
    pass


class SettingsUpdate(BaseSchema):
    gym_name: Optional[Annotated[str, Field(min_length=1, max_length=100)]] = None
    currency: Optional[Annotated[str, Field(min_length=1, max_length=10)]] = None
    default_fee: Optional[Annotated[Decimal, Field(ge=0)]] = None
    address: Optional[Annotated[str, Field(max_length=200)]] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    whatsapp_phone: Optional[Annotated[str, Field(max_length=30)]] = None
    business_hours: Optional[Annotated[str, Field(max_length=160)]] = None
    payment_alias: Optional[Annotated[str, Field(max_length=120)]] = None
    payment_notes: Optional[Annotated[str, Field(max_length=280)]] = None
    late_fee_grace_days: Optional[Annotated[int, Field(ge=0, le=60)]] = None
    allow_cash: Optional[bool] = None
    allow_transfer: Optional[bool] = None
    onboarding_message: Optional[Annotated[str, Field(max_length=280)]] = None


class SettingsOut(SettingsBase):
    pass


def _bucket_expr(column, bucket: Literal["day", "week", "month"]):
    with_tz = func.timezone("America/Argentina/Buenos_Aires", func.timezone("UTC", column))

    if bucket == "day":
        return func.date_trunc("day", with_tz)
    if bucket == "week":
        return func.date_trunc("week", with_tz)
    return func.date_trunc("month", with_tz)
