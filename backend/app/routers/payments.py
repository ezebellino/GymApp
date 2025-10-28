from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Query
from sqlalchemy.orm import Session, joinedload, contains_eager
from sqlalchemy import func, and_, or_
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timedelta, date

from .. import models, schemas
from ..deps import get_db
from ..auth import get_current_user, require_role
from ..models import UserRole

def _inclusive_end(dt_end: date | datetime) -> datetime:
    """
    Vuelve inclusivo el rango [start, end] en created_at usando end + 1 día (limite exclusivo).
    Acepta date o datetime.
    """
    if isinstance(dt_end, datetime):
        return dt_end + timedelta(seconds=1)  # si te llega datetime, hacemos inclusivo con +1s
    # si te llega date, pasamos al día siguiente 00:00
    return datetime.combine(dt_end + timedelta(days=1), datetime.min.time())

def _bucket_expr(col, bucket: Literal["day", "week", "month"]):
    # Para Postgres: date_trunc
    if bucket == "day":
        return func.date_trunc("day", col)
    if bucket == "week":
        return func.date_trunc("week", col)
    return func.date_trunc("month", col)

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
        method_channel=payload.method_channel,
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
    client_id: Optional[str] = None,   # sigue disponible
    q: Optional[str] = Query(None, description="nombre, email o teléfono"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = (
        db.query(models.Payment)
          .join(models.Client)
          .options(contains_eager(models.Payment.client))
    )

    if client_id:
        query = query.filter(models.Payment.client_id == client_id)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.Client.full_name.ilike(like),
                models.Client.email.ilike(like),
                models.Client.phone.ilike(like),
            )
        )

    total = query.with_entities(func.count(models.Payment.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    items = (
        query.order_by(
            models.Payment.period_year.desc(),
            models.Payment.period_month.desc(),
            models.Payment.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
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


@router.get("/reports/kpis", dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])
def payments_kpis(
    db: Session = Depends(get_db),
    start: date = Query(..., description="Fecha desde (YYYY-MM-DD)"),
    end: date = Query(..., description="Fecha hasta (YYYY-MM-DD, inclusive)"),
    method: Optional[Literal["cash", "transfer"]] = Query(None, description="Filtra por método"),
) -> Dict[str, Any]:
    end_inclusive = _inclusive_end(end)

    q = db.query(
        func.count(models.Payment.id),              # n_payments
        func.coalesce(func.sum(models.Payment.amount), 0.0),  # amount_sum
        func.coalesce(func.avg(models.Payment.amount), 0.0),  # amount_avg
        func.count(func.distinct(models.Payment.client_id)),  # unique_clients
    ).filter(
        models.Payment.created_at >= start,
        models.Payment.created_at < end_inclusive,
    )
    if method:
        q = q.filter(models.Payment.method == method)

    n_payments, amount_sum, amount_avg, unique_clients = q.one()

    return {
        "n_payments": int(n_payments),
        "unique_clients": int(unique_clients),
        "amount_sum": float(amount_sum),
        "amount_avg": float(amount_avg),
        "start": str(start),
        "end": str(end),
        "method": method,
    }

@router.get("/reports/by_method", dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])
def payments_by_method(
    db: Session = Depends(get_db),
    start: date = Query(..., description="Fecha desde (YYYY-MM-DD)"),
    end: date = Query(..., description="Fecha hasta (YYYY-MM-DD, inclusive)"),
) -> List[Dict[str, Any]]:
    end_inclusive = _inclusive_end(end)

    rows = (
        db.query(
            models.Payment.method,
            func.count(models.Payment.id),
            func.coalesce(func.sum(models.Payment.amount), 0.0),
        )
        .filter(
            models.Payment.created_at >= start,
            models.Payment.created_at < end_inclusive,
        )
        .group_by(models.Payment.method)
        .order_by(models.Payment.method.asc())
        .all()
    )

    return [
        {"method": m or "unknown", "count": int(c), "amount_sum": float(s)}
        for (m, c, s) in rows
    ]

@router.get("/reports/by_channel", dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])
def payments_by_channel(
    db: Session = Depends(get_db),
    start: date = Query(..., description="YYYY-MM-DD"),
    end: date = Query(..., description="YYYY-MM-DD (inclusive)"),
    method: Optional[Literal["cash", "transfer"]] = Query(None),
) -> List[Dict[str, Any]]:
    end_inclusive = _inclusive_end(end)
    q = (
        db.query(
            models.Payment.method_channel,
            func.count(models.Payment.id),
            func.coalesce(func.sum(models.Payment.amount), 0.0),
        )
        .filter(
            models.Payment.created_at >= start,
            models.Payment.created_at < end_inclusive,
        )
    )
    if method:
        q = q.filter(models.Payment.method == method)

    rows = (
        q.group_by(models.Payment.method_channel)
         .order_by(models.Payment.method_channel.asc())
         .all()
    )
    return [
        {
            "channel": ch or "unknown",
            "count": int(c),
            "amount_sum": float(s),
        }
        for (ch, c, s) in rows
    ]


@router.get("/reports/timeseries", dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])
def payments_timeseries(
    db: Session = Depends(get_db),
    start: date = Query(..., description="Fecha desde (YYYY-MM-DD)"),
    end: date = Query(..., description="Fecha hasta (YYYY-MM-DD, inclusive)"),
    bucket: Literal["day", "week", "month"] = Query("day"),
    method: Optional[Literal["cash", "transfer"]] = Query(None),
    method_channel: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    end_inclusive = _inclusive_end(end)
    ts = _bucket_expr(models.Payment.created_at, bucket).label("ts")

    # Validacion coherente de canal
    if method_channel and method != "transfer":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="method_channel filter only makes sense when method is 'transfer'",
        )

    q = (
        db.query(
            ts,
            func.count(models.Payment.id).label("count"),
            func.coalesce(func.sum(models.Payment.amount), 0.0).label("amount_sum"),
        )
        .filter(
            models.Payment.created_at >= start,
            models.Payment.created_at < end_inclusive,
        )
    )
    if method:
        q = q.filter(models.Payment.method == method)
    if method_channel:
        q = q.filter(models.Payment.method_channel == method_channel)

    rows = (
        q.group_by(ts)
         .order_by(ts.asc())
         .all()
    )

    return [
        {
            "bucket": (r.ts if isinstance(r.ts, datetime) else datetime.fromisoformat(str(r.ts))).isoformat(),
            "count": int(r.count),
            "amount_sum": float(r.amount_sum),
        }
        for r in rows
    ]
