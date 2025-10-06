from datetime import datetime
from pydantic import BaseModel, field_validator, Field 
from typing import Optional

# Miembros del Gym
class ClientBase(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    
class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    
class ClientOut(ClientBase):
    id: str
    join_date: datetime

    class Config:
        from_attributes = True
        
# Pagos de membresías
class PaymentBase(BaseModel):
    client_id: str
    amount: float
    method: str
    note: Optional[str] = None
    period_month: int = Field(..., ge=1, le=12)
    period_year: int = Field(..., ge=2020)
    
    @field_validator('period_month')
    @classmethod
    def validate_month(cls, v):
        if not 1 <= v <= 12:
            raise ValueError('El mes debe estar entre 1 y 12.') 
        return v
    
class PaymentCreate(PaymentBase):
    client_id: str
    
class PaymentOut(PaymentBase):
    id: str
    client_id: str  
    created_at: datetime

    class Config:
        from_attributes = True
        
# Respuesta genérica
class ClientStatus(BaseModel):
    client_id: str
    full_name: str
    is_up_to_date: bool
    last_payment_month: Optional[int] = None
    last_payment_year: Optional[int] = None