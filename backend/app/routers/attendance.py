from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas
from ..deps import get_db
from ..auth import get_current_user, require_role
from ..models import UserRole
from ..security import optional_bearer
from sqlalchemy import func, or_
from datetime import datetime

router = APIRouter(prefix="/attendance", tags=["attendance"], dependencies=[Depends(optional_bearer)])

@router.get("/", response_model=List[schemas.AttendanceOut])
def list_attendance(
    response: Response,
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="nombre, email o teléfono"),
    client_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = (
    db.query(models.Attendance)
      .options(joinedload(models.Attendance.client))  # ✅ relación, no columna
    )

    if client_id:
        query = query.filter(models.Attendance.client_id == client_id)

    if q:
        like = f"%{q}%"
        query = query.join(models.Attendance.client).filter(
            or_(
                models.Client.full_name.ilike(like),
                models.Client.email.ilike(like),
                models.Client.phone.ilike(like),
            )
        )

    if start:
        query = query.filter(models.Attendance.checkin_at >= start)
    if end:
        query = query.filter(models.Attendance.checkin_at <= end)

    total = query.with_entities(func.count(models.Attendance.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    items = (
        query.order_by(models.Attendance.checkin_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items

# (Opcional) check-in por teléfono/email/nombre
@router.post("/checkin", response_model=schemas.AttendanceOut, status_code=201,
             dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])
def checkin(
    payload: schemas.AttendanceCheckinIn,  # definí un schema con: client_id **o** q
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    client = None
    if payload.client_id:
        client = db.get(models.Client, payload.client_id)
    elif payload.q:
        like = f"%{payload.q}%"
        client = (
            db.query(models.Client)
            .filter(
                or_(
                    models.Client.full_name.ilike(like),
                    models.Client.email.ilike(like),
                    models.Client.phone.ilike(like),
                )
            )
            .order_by(models.Client.full_name.asc())
            .first()
        )
    if not client:
        raise HTTPException(404, "Client not found")

    a = models.Attendance(
        client_id=client.id,
        coach_id=user.id if user.role == models.UserRole.coach else None,
        checkin_at=datetime.utcnow(),
    )
    db.add(a); db.commit(); db.refresh(a)
    return a