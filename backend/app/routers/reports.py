from datetime import date, datetime
from typing import Literal, List, Dict, Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models
from ..deps import get_db
from ..auth import require_role
from ..models import UserRole

TZ = "America/Argentina/Buenos_Aires"

router = APIRouter(prefix="/reports", 
                   tags=["reports"], 
                   dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]
                   )

def _bucket_expr(dt_col, bucket: str):
    """date_trunc con TZ para día/semana/mes."""
    with_tz = func.timezone(TZ, dt_col)
    if bucket == "day":
        return func.date_trunc("day", with_tz)
    if bucket == "week":
        return func.date_trunc("week", with_tz)
    return func.date_trunc("month", with_tz)

@router.get("/attendance")
def attendance_report(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
    start: date = Query(...),
    end: date = Query(...),
    bucket: Literal["day", "week", "month"] = Query("day")
):
    print(f"📊 Reporte de asistencias solicitado por {_user.email} (rol: {_user.role})")

    ts = _bucket_expr(models.Attendance.checkin_at, bucket).label("ts")
    rows = (
        db.query(ts, func.count(models.Attendance.id))
        .filter(
            models.Attendance.checkin_at >= start,
            models.Attendance.checkin_at < end + func.make_interval(days=1)
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
    rows = (
        db.query(ts, func.count(models.Client.id))
        .filter(models.Client.join_date >= start, models.Client.join_date < end + func.make_interval(days=1))
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
    method: Optional[str] = Query(None, description="Filtrar por método: cash/card/transfer")
):
    ts = _bucket_expr(models.Payment.created_at, bucket).label("ts")
    q = db.query(ts, func.sum(models.Payment.amount))
    if method:
        q = q.filter(models.Payment.method == method)
    rows = (
        q.filter(models.Payment.created_at >= start, models.Payment.created_at < end + func.make_interval(days=1))
        .group_by(ts)
        .order_by(ts)
        .all()
    )
    return [{"bucket": r[0].isoformat(), "total": float(r[1] or 0.0)} for r in rows]
