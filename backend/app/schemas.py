from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal, Annotated
from uuid import UUID
from sqlalchemy import func

from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator

# ==================================
# CONFIG BASE (reutilizable)
# ==================================
class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_decimal="float",
        populate_by_name=True
    )

# ==================================
# CLIENTS
# ==================================
class ClientBase(BaseSchema):
    full_name: Annotated[str, Field(min_length=1, max_length=120)]
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    is_active: bool = True

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("phone")
    @classmethod
    def strip_phone(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else v


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseSchema):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    is_active: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def strip_name_opt(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else v


class ClientOut(ClientBase):
    id: str
    join_date: datetime


# ==================================
# PAYMENTS
# ==================================
PaymentMethod = Literal["cash", "transfer"]

class PaymentBase(BaseSchema):
    client_id: Annotated[str, Field(min_length=36, max_length=36)]  # uuid en formato string
    amount: Annotated[float,Field(ge=0)]
    method: PaymentMethod 
    method_channel: Optional[str] = Field(default=None, max_length=30, description=
                                          "Sub-canal para transfer: mercadopago, cuentadni, personalpay, etc.")
    note: Optional[str] = Field(None, max_length=500)
    period_month: Annotated[int, Field(ge=1, le=12)]
    period_year: Annotated[int, Field(ge=2020, le=2100)]


class PaymentCreate(PaymentBase):
    pass


class PaymentOut(PaymentBase):
    id: UUID
    created_at: datetime
    client: Optional[ClientOut] = None  # para evitar ciclo infinito en serialización
    
    class Config:
        from_attributes = True


# ==================================
# STATUS
# ==================================
class ClientStatus(BaseSchema):
    client_id: str
    full_name: str
    is_up_to_date: bool
    last_payment_month: Optional[int] = None
    last_payment_year: Optional[int] = None


# ==================================
# ATTENDANCE
# ==================================
class AttendanceBase(BaseSchema):
    client_id: Annotated[str, Field(min_length=36, max_length=36)]  # uuid en formato string
class AttendanceCheckinIn(BaseSchema):
    client_id: Optional[Annotated[str, Field(min_length=36, max_length=36)]] = None
    q: Optional[str] = Field(None, max_length=120, description="nombre, email o teléfono")
class AttendanceOut(AttendanceBase):
    id: UUID
    checkin_at: datetime
    client: ClientOut
    class Config:
        from_attributes = True
        
# ==================================
# REPORTS
class AttendanceReportItem(BaseSchema):
    bucket: str  # ISO date string
    count: int
class NewClientsReportItem(BaseSchema):
    bucket: str  # ISO date string
    count: int
class RevenueReportItem(BaseSchema):
    bucket: str  # ISO date string
    total: float
# ==================================
# UTILITIES
def _bucket_expr(column, bucket: Literal["day", "week", "month"]):
    # Ajustar a zona horaria si es necesario
    with_tz = func.timezone("UTC", column)  # Cambiar "UTC" por la zona horaria deseada

    if bucket == "day":
        return func.date_trunc("day", with_tz)
    if bucket == "week":
        return func.date_trunc("week", with_tz)
    return func.date_trunc("month", with_tz)
