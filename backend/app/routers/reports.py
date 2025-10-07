from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..deps import get_db
from ..auth import require_role
from ..models import UserRole, Attendance, Client, Payment

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/attendance", dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])
def attendance_report(
    db: Session = Depends(get_db),
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
):
    q = (
        db.query(func.date(Attendance.checkin_at).label("day"), func.count().label("visits"))
        .filter(Attendance.checkin_at >= date_from, Attendance.checkin_at < date_to)
        .group_by(func.date(Attendance.checkin_at))
        .order_by(func.date(Attendance.checkin_at))
    )
    return [{"day": d, "visits": c} for d, c in q.all()]