from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas
from ..deps import get_db
from ..utils import current_period


router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("/", response_model=schemas.ClientOut)
def create_client(payload: schemas.ClientCreate, db: Session = Depends(get_db)):
    obj = models.Client(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/", response_model=List[schemas.ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Busca por nombre, email o teléfono")
):
    query = db.query(models.Client)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.Client.full_name.ilike(like)) |
            (models.Client.email.ilike(like)) |
            (models.Client.phone.ilike(like))
        )
    return query.order_by(models.Client.full_name.asc()).all()


@router.get("/{client_id}", response_model=schemas.ClientOut)
def get_client(client_id: str, db: Session = Depends(get_db)):
    obj = db.query(models.Client).get(client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    return obj


@router.patch("/{client_id}", response_model=schemas.ClientOut)
def update_client(client_id: str, payload: schemas.ClientUpdate, db: Session = Depends(get_db)):
    obj = db.query(models.Client).get(client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db)):
    obj = db.query(models.Client).get(client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


@router.get("/{client_id}/status", response_model=schemas.ClientStatus)
def client_status(client_id: str, db: Session = Depends(get_db)):
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    last_pay = (
    db.query(models.Payment)
    .filter(models.Payment.client_id == client_id)
    .order_by(models.Payment.period_year.desc(), models.Payment.period_month.desc())
    .first()
    )
    cur_m, cur_y = current_period()
    is_up_to_date = False
    last_m = last_y = None
    if last_pay:
        last_m, last_y = last_pay.period_month, last_pay.period_year
        is_up_to_date = (last_y > cur_y) or (last_y == cur_y and last_m >= cur_m)
    return schemas.ClientStatus(
        client_id=client.id,
        full_name=client.full_name,
        is_up_to_date=is_up_to_date,
        last_payment_month=last_m,
        last_payment_year=last_y,
    )