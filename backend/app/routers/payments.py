from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from .. import models, schemas
from ..deps import get_db
from ..auth import get_current_user, require_role
from ..models import UserRole

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post(
    "/",
    response_model=schemas.PaymentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]
)
def create_payment(
    payload: schemas.PaymentCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # 👉 Normalizá el client_id a str (viene como UUID del schema)
    client_id_str = str(payload.client_id)

    # Regla: 1 pago por cliente/mes
    exists = (
        db.query(models.Payment)
        .filter(
            models.Payment.client_id == client_id_str,          
            models.Payment.period_year == payload.period_year,
            models.Payment.period_month == payload.period_month,
        )
        .first()
    )
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Payment for this period already exists")

    # Crear el pago usando el client_id como str
    obj = models.Payment(
        client_id=client_id_str,                                
        amount=payload.amount,
        method=payload.method,
        note=payload.note,
        period_month=payload.period_month,
        period_year=payload.period_year,
        created_by_user_id=user.id,
    )
    db.add(obj); db.commit(); db.refresh(obj)

    loc = request.url_for("payments:get_one", payment_id=obj.id)
    response.headers["Location"] = str(loc)
    return schemas.PaymentOut.model_validate(obj)


@router.get("/", response_model=List[schemas.PaymentOut])
def list_payments(
    response: Response,
    db: Session = Depends(get_db),
    client_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = db.query(models.Payment)
    if client_id:
        q = q.filter(models.Payment.client_id == str(client_id))

    total = q.with_entities(func.count(models.Payment.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    items = q.order_by(
        models.Payment.period_year.desc(),
        models.Payment.period_month.desc(),
        models.Payment.created_at.desc(),
    ).offset(offset).limit(limit).all()
    return items

@router.get("/{payment_id}", response_model=schemas.PaymentOut, name="payments:get_one")
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    obj = db.get(models.Payment, payment_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    return obj

@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_role(UserRole.owner))])
def delete_payment(payment_id: str, db: Session = Depends(get_db)):
    obj = db.get(models.Payment, payment_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    db.delete(obj); db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
