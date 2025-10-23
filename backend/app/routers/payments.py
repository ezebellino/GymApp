from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timedelta,date

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
    # Filtros
    client_id: Optional[str] = Query(None, description="Filtra por cliente"),
    method: Optional[str] = Query(None, description="Filtra por método (cash, card, transfer)"),
    method_channel: Optional[str] = Query(None, description="Filtra por sub-canal del método"),
    period_year: Optional[int] = Query(None, ge=2000),
    period_month: Optional[int] = Query(None, ge=1, le=12),
    created_from: Optional[datetime] = Query(None, description="Filtra pagos desde esta fecha (created_at >=)"),
    created_to: Optional[datetime] = Query(None, description="Filtra pagos hasta esta fecha (created_at <=)"),
    amount_min: Optional[float] = Query(None, ge=0),
    amount_max: Optional[float] = Query(None, ge=0),
    # Orden
    sort_by: Literal["created_at", "period", "amount"] = Query("created_at"),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    # Paginación
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = db.query(models.Payment)

    # Filtros dinámicos
    if client_id:
        q = q.filter(models.Payment.client_id == client_id)
    if method:
        q = q.filter(models.Payment.method == method)
    if method_channel:
        q = q.filter(models.Payment.method_channel == method_channel)
    if period_year is not None:
        q = q.filter(models.Payment.period_year == period_year)
    if period_month is not None:
        q = q.filter(models.Payment.period_month == period_month)
    if created_from:
        q = q.filter(models.Payment.created_at >= created_from)
    if created_to:
        q = q.filter(models.Payment.created_at <= created_to)
    if (amount_min is not None) and (amount_max is not None):
        q = q.filter(and_(models.Payment.amount >= amount_min, models.Payment.amount <= amount_max))
    elif amount_min is not None:
        q = q.filter(models.Payment.amount >= amount_min)
    elif amount_max is not None:
        q = q.filter(models.Payment.amount <= amount_max)

    # Total antes de paginar
    total = q.with_entities(func.count(models.Payment.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    # Orden seguro (lista blanca)
    if sort_by == "created_at":
        sort_col = models.Payment.created_at
    elif sort_by == "period":
        sort_col = (models.Payment.period_year, models.Payment.period_month)
    else: 
        sort_col = models.Payment.amount

    if isinstance(sort_col, tuple):
        cols = sort_col
        if sort_dir == "asc":
            q = q.order_by(*cols)
        else:
            q = q.order_by(*[c.desc() for c in cols])
    else:
        q = q.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())

    items = q.offset(offset).limit(limit).all()
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
