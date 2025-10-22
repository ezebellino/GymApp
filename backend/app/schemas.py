from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal, Annotated
from uuid import UUID

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
PaymentMethod = Literal["cash", "card", "transfer"]

class PaymentBase(BaseSchema):
    client_id: Annotated[str, Field(min_length=36, max_length=36)]  # uuid en formato string
    amount: Annotated[
        Decimal,
        Field(ge=Decimal("0.01"), max_digits=10, decimal_places=2)
    ]
    method: PaymentMethod = "cash"
    note: Optional[str] = Field(None, max_length=500)
    period_month: Annotated[int, Field(ge=1, le=12)]
    period_year: Annotated[int, Field(ge=2020, le=2100)]


class PaymentCreate(PaymentBase):
    pass


class PaymentOut(PaymentBase):
    id: UUID
    created_at: datetime


# ==================================
# STATUS
# ==================================
class ClientStatus(BaseSchema):
    client_id: str
    full_name: str
    is_up_to_date: bool
    last_payment_month: Optional[int] = None
    last_payment_year: Optional[int] = None
