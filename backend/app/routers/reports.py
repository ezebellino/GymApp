from datetime import date, datetime, time, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..auth import require_role
from ..deps import get_db
from ..models import UserRole


router = APIRouter(prefix="/reports", tags=["reports"])


def _bucket_expr_local(dt_col, bucket: str):
    if bucket == "day":
        return func.date_trunc("day", dt_col)
    if bucket == "week":
        return func.date_trunc("week", dt_col)
    return func.date_trunc("month", dt_col)


def _end_exclusive(day_value: date) -> datetime:
    return datetime.combine(day_value, time.min) + timedelta(days=1)


@router.get("/attendance")
def attendance_report(
    db: Session = Depends(get_db),
    _user = Depends(require_role(UserRole.owner)),
    start: date = Query(...),
    end: date = Query(...),
    bucket: Literal["day", "week", "month"] = Query("day"),
):
    start_dt = datetime.combine(start, time.min)
    end_dt_exclusive = _end_exclusive(end)

    ts = _bucket_expr_local(models.Attendance.checkin_at, bucket).label("ts")
    rows = (
        db.query(ts, func.count(models.Attendance.id))
        .filter(
            models.Attendance.checkin_at >= start_dt,
            models.Attendance.checkin_at < end_dt_exclusive,
        )
        .group_by(ts)
        .order_by(ts)
        .all()
    )
    return [{"bucket": row[0].isoformat(), "count": int(row[1])} for row in rows]


@router.get("/new_clients")
def new_clients_report(
    db: Session = Depends(get_db),
    _user = Depends(require_role(UserRole.owner)),
    start: date = Query(...),
    end: date = Query(...),
    bucket: Literal["day", "week", "month"] = Query("week"),
):
    # Cuenta usuarios con perfil de miembro (membership_start_date != NULL), no
    # `clients.join_date` (esa tabla ya no existe: ver `unify-clients-into-users`).
    ts = schemas._bucket_expr(models.User.membership_start_date, bucket).label("ts")
    start_dt = datetime.combine(start, time.min)
    end_exclusive = _end_exclusive(end)

    rows = (
        db.query(ts, func.count(models.User.id))
        .filter(
            models.User.membership_start_date >= start_dt,
            models.User.membership_start_date < end_exclusive,
        )
        .group_by(ts)
        .order_by(ts)
        .all()
    )
    return [{"bucket": row[0].isoformat(), "count": int(row[1])} for row in rows]


@router.get("/revenue")
def revenue_report(
    db: Session = Depends(get_db),
    _user = Depends(require_role(UserRole.owner)),
    start: date = Query(...),
    end: date = Query(...),
    bucket: Literal["month", "week", "day"] = Query("month"),
    method: Optional[str] = Query(None, description="Filtrar por metodo: cash/transfer"),
):
    ts = schemas._bucket_expr(models.Payment.created_at, bucket).label("ts")
    start_dt = datetime.combine(start, time.min)
    end_exclusive = _end_exclusive(end)

    query = db.query(ts, func.sum(models.Payment.amount))
    if method:
        query = query.filter(models.Payment.method == method)

    rows = (
        query.filter(
            models.Payment.created_at >= start_dt,
            models.Payment.created_at < end_exclusive,
        )
        .group_by(ts)
        .order_by(ts)
        .all()
    )
    return [{"bucket": row[0].isoformat(), "total": float(row[1] or 0.0)} for row in rows]


@router.get("/attendance/detail", response_model=list[schemas.AttendanceOut])
def attendance_detail(
    day: date = Query(..., description="Dia en formato YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _user = Depends(require_role(UserRole.owner)),
):
    start_dt = datetime.combine(day, time.min)
    end_dt = start_dt + timedelta(days=1)

    rows = (
        db.query(models.Attendance)
        .options(selectinload(models.Attendance.user))
        .filter(
            models.Attendance.checkin_at >= start_dt,
            models.Attendance.checkin_at < end_dt,
        )
        .order_by(models.Attendance.checkin_at.asc())
        .all()
    )
    return rows
