
from datetime import date, datetime, timedelta, time
from sqlalchemy import func
from typing import Literal, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models
from ..deps import get_db
from ..schemas import _bucket_expr
from ..auth import require_role
from ..models import UserRole


router = APIRouter(prefix="/reports", tags=["reports"])

TZ = "America/Argentina/Buenos_Aires"

def _bucket_expr(dt_col, bucket: str):
    with_tz = func.timezone(TZ, dt_col)
    if bucket == "day":
        return func.date_trunc("day", with_tz)
    if bucket == "week":
        return func.date_trunc("week", with_tz)
    return func.date_trunc("month", with_tz)

def _end_exclusive(d: date) -> datetime:
    # día siguiente a las 00:00 (límite exclusivo)
    return datetime.combine(d, time.min) + timedelta(days=1)

@router.get("/attendance")
def attendance_report(
    db: Session = Depends(get_db),
    _user = Depends(require_role(UserRole.owner, UserRole.coach)),
    start: date = Query(...),
    end: date = Query(...),
    bucket: Literal["day", "week", "month"] = Query("day"),
):
    start_dt = datetime.combine(start, time.min)
    end_dt_exclusive = datetime.combine(end, time.min) + timedelta(days=1)

    ts = _bucket_expr(models.Attendance.checkin_at, bucket).label("ts")
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
    return [{"bucket": r[0].isoformat(), "count": int(r[1])} for r in rows]

@router.get("/new_clients")
def new_clients_report(
    db: Session = Depends(get_db),
    start: date = Query(...),
    end: date = Query(...),
    bucket: Literal["day", "week", "month"] = Query("week")
):
    ts = _bucket_expr(models.Client.join_date, bucket).label("ts")
    start_dt = datetime.combine(start, time.min)
    end_ex = _end_exclusive(end)

    rows = (
        db.query(ts, func.count(models.Client.id))
        .filter(
            models.Client.join_date >= start_dt,
            models.Client.join_date < end_ex,
        )
        .group_by(ts)
        .order_by(ts)
        .all()
    )
    return [{"bucket": r[0].isoformat(), "count": int(r[1])} for r in rows]

@router.get("/revenue")
def revenue_report(
    db: Session = Depends(get_db),
    start: date = Query(...),
    end: date = Query(...),
    bucket: Literal["month", "week", "day"] = Query("month"),
    method: Optional[str] = Query(None, description="Filtrar por método: cash/transfer"),
):
    ts = _bucket_expr(models.Payment.created_at, bucket).label("ts")
    start_dt = datetime.combine(start, time.min)
    end_ex = _end_exclusive(end)

    q = db.query(ts, func.sum(models.Payment.amount))
    if method:
        q = q.filter(models.Payment.method == method)

    rows = (
        q.filter(
            models.Payment.created_at >= start_dt,
            models.Payment.created_at < end_ex,
        )
        .group_by(ts)
        .order_by(ts)
        .all()
    )
    return [{"bucket": r[0].isoformat(), "total": float(r[1] or 0.0)} for r in rows]
