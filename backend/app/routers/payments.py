from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..deps import get_db

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("/", response_model=schemas.PaymentOut)
def create_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db)):
    # Verificar que el cliente exista
    client = db.query(models.Client).get(payload.client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    
    # evitar pagos duplicados
    dup = (
        db.query(models.Payment)
        .filter(
            models.Payment.client_id == payload.client_id,
            models.Payment.period_year == payload.period_year,
            models.Payment.period_month == payload.period_month
        )
        .first()
    )
    if dup:
        raise HTTPException(400, "Payment for this period already exists")
    
    
    # Crear el pago
    obj = models.Payment(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.get("/client/{client_id}", response_model=List[schemas.PaymentOut])
def list_payments_by_client(client_id: str, db: Session = Depends(get_db)):
    if not db.query(models.Client).get(client_id):
        raise HTTPException(404, "Client not found")
    return (
        db.query(models.Payment)
        .filter(models.Payment.client_id == client_id)
        .order_by(models.Payment.period_year.desc(), models.Payment.period_month.desc())
        .all()
    )