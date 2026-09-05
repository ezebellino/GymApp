from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas
from ..deps import get_db
from ..auth import get_current_user, require_role
from ..models import UserRole, MembershipStatus
from ..security import optional_bearer
from sqlalchemy import func, or_
from datetime import datetime
from ..utils import now_ar

router = APIRouter(prefix="/attendance", tags=["attendance"], dependencies=[Depends(optional_bearer)])

@router.get("/", response_model=List[schemas.AttendanceOut])
def list_attendance(
    response: Response,
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="nombre, email o teléfono"),
    user_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = (
    db.query(models.Attendance)
      .options(joinedload(models.Attendance.user))  # ✅ relación, no columna
    )

    if user_id:
        query = query.filter(models.Attendance.user_id == user_id)

    if q:
        like = f"%{q}%"
        query = query.join(models.Attendance.user).filter(
            or_(
                models.User.full_name.ilike(like),
                models.User.email.ilike(like),
                models.User.phone.ilike(like),
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
    payload: schemas.AttendanceCheckinIn,  # definí un schema con: user_id **o** q
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    target = None
    if payload.user_id:
        target = db.get(models.User, payload.user_id)
    elif payload.q:
        like = f"%{payload.q}%"
        target = (
            db.query(models.User)
            .filter(
                or_(
                    models.User.full_name.ilike(like),
                    models.User.email.ilike(like),
                    models.User.phone.ilike(like),
                )
            )
            # El check-in es para quien entrena: si no se acota acá, un
            # Dueño/Coach homónimo sin membresía puede ganarle el match a un
            # Miembro real y el 400 de abajo confunde ("no tiene membresía
            # activa") en vez de resolver al que sí busca hacer check-in
            # (hallazgo N4 de verification.md de unify-clients-into-users).
            .filter(models.User.membership_status == MembershipStatus.active)
            .order_by(models.User.full_name.asc())
            .first()
        )
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    if target.membership_status != MembershipStatus.active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El usuario no tiene una membresía activa",
        )

    a = models.Attendance(
        user_id=target.id,
        coach_id=user.id if user.role == models.UserRole.coach else None,
        checkin_at=now_ar().replace(tzinfo=None),
    )
    db.add(a); db.commit(); db.refresh(a)
    return a
