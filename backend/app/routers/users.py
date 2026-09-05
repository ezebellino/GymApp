from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query, status, Request, Response
from sqlalchemy.orm import Session
from typing import List, Optional, Literal, Annotated
from sqlalchemy import or_, func, select
from pydantic import Field

from .. import models, schemas, utils
from ..config import settings
from ..deps import get_db, require_can_manage_user
from ..auth import get_current_user, hash_password, require_role
from ..models import UserRole, MembershipStatus
from ..notifications import get_notification_sender
from ..security import generate_invitation_token, hash_invitation_token

INVITATION_TTL_DAYS = 7

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]
)


# ---------------------------------------------------------------------------
# Serializacion
# ---------------------------------------------------------------------------

def _last_payment_month_year(db: Session, user_id: str) -> tuple[Optional[int], Optional[int]]:
    payment = (
        db.query(models.Payment)
        .filter(models.Payment.user_id == user_id)
        .order_by(models.Payment.period_year.desc(), models.Payment.period_month.desc())
        .first()
    )
    if not payment:
        return None, None
    return payment.period_month, payment.period_year


def _invitation_status_for(
    user: models.User, live_invitation: Optional[models.MemberInvitation]
) -> schemas.InvitationStatus:
    if user.password_hash is not None:
        return "access_active"
    if live_invitation is None:
        return "none"
    if live_invitation.expires_at < datetime.utcnow():
        return "expired"
    return "pending"


def _live_invitation_for(db: Session, user_id: str) -> Optional[models.MemberInvitation]:
    return (
        db.query(models.MemberInvitation)
        .filter(
            models.MemberInvitation.user_id == user_id,
            models.MemberInvitation.revoked_at.is_(None),
            models.MemberInvitation.completed_at.is_(None),
        )
        .first()
    )


def _serialize_user(
    user: models.User,
    *,
    membership_indicator: schemas.MembershipIndicator,
    invitation_status: schemas.InvitationStatus,
) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        age=user.age,
        birth_date=user.birth_date,
        weight_kg=user.weight_kg,
        height_cm=user.height_cm,
        email=user.email,
        email_verified=user.email_verified,
        phone=user.phone,
        phone_verified=user.phone_verified,
        role=user.role.value,
        is_active=user.is_active,
        membership_status=user.membership_status.value,
        membership_start_date=user.membership_start_date,
        membership_cancelled_at=user.membership_cancelled_at,
        membership_indicator=membership_indicator,
        invitation_status=invitation_status,
        created_at=user.created_at,
        theme_preference=user.theme_preference,
    )


def _serialize_user_single(db: Session, user: models.User) -> schemas.UserOut:
    last_month, last_year = _last_payment_month_year(db, user.id)
    indicator = utils.membership_indicator(user.membership_status, last_month, last_year)
    invitation_status = _invitation_status_for(user, _live_invitation_for(db, user.id))
    return _serialize_user(user, membership_indicator=indicator, invitation_status=invitation_status)


def _get_user_or_404(db: Session, user_id: str) -> models.User:
    obj = db.get(models.User, user_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return obj


# ---------------------------------------------------------------------------
# Listado
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[schemas.UserOut])
def list_users(
    response: Response,
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Busca por nombre, email o teléfono"),
    role: Optional[Literal["owner", "coach", "member"]] = Query(None),
    membership_status: Optional[Literal["none", "active", "cancelled"]] = Query(None),
    limit: Annotated[int, Field(ge=1, le=200)] = 50,
    offset: Annotated[int, Field(ge=0)] = 0,
    order_by: Literal["full_name", "created_at", "membership_start_date", "email", "is_active"] = "full_name",
    order_dir: Literal["asc", "desc"] = "asc",
):
    # Subconsulta correlacionada: MAX(period_year*12 + period_month) del usuario.
    # Se resuelve en la MISMA query que el listado (nada de N+1 por fila).
    last_period_subq = (
        select(func.max(models.Payment.period_year * 12 + models.Payment.period_month))
        .where(models.Payment.user_id == models.User.id)
        .correlate(models.User)
        .scalar_subquery()
    )
    indicator_expr = utils.membership_indicator_sql_case(last_period_subq).label("membership_indicator")

    query = db.query(models.User, indicator_expr)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.User.full_name.ilike(like),
                models.User.email.ilike(like),
                models.User.phone.ilike(like),
            )
        )
    if role:
        query = query.filter(models.User.role == role)
    if membership_status:
        query = query.filter(models.User.membership_status == membership_status)

    total = query.with_entities(func.count(models.User.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    ORDER_MAP = {
        "full_name": models.User.full_name,
        "created_at": models.User.created_at,
        "membership_start_date": models.User.membership_start_date,
        "email": models.User.email,
        "is_active": models.User.is_active,
    }
    sort_col = ORDER_MAP.get(order_by, models.User.full_name)
    sort_expr = sort_col.desc() if order_dir == "desc" else sort_col.asc()

    rows = (
        query.order_by(sort_expr)
        .offset(offset)
        .limit(limit)
        .all()
    )

    base = "/users"
    links = []
    if offset + limit < (total or 0):
        links.append(f'<{base}?offset={offset+limit}&limit={limit}&order_by={order_by}&order_dir={order_dir}{"&q="+q if q else ""}>; rel="next"')
    if offset > 0:
        prev_offset = max(0, offset - limit)
        links.append(f'<{base}?offset={prev_offset}&limit={limit}&order_by={order_by}&order_dir={order_dir}{"&q="+q if q else ""}>; rel="prev"')
    if links:
        response.headers["Link"] = ", ".join(links)

    user_ids = [row[0].id for row in rows]
    live_invitations = {
        inv.user_id: inv
        for inv in (
            db.query(models.MemberInvitation)
            .filter(
                models.MemberInvitation.user_id.in_(user_ids),
                models.MemberInvitation.revoked_at.is_(None),
                models.MemberInvitation.completed_at.is_(None),
            )
            .all()
        )
    } if user_ids else {}

    return [
        _serialize_user(
            user,
            membership_indicator=indicator_value,
            invitation_status=_invitation_status_for(user, live_invitations.get(user.id)),
        )
        for user, indicator_value in rows
    ]


@router.get("/{user_id}", response_model=schemas.UserOut, name="users:get_one")
def get_user(user_id: str, db: Session = Depends(get_db)):
    obj = _get_user_or_404(db, user_id)
    return _serialize_user_single(db, obj)


# ---------------------------------------------------------------------------
# Alta / edicion
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: schemas.UserCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_can_manage_user(current_user, payload.role)

    is_member = payload.role == "member"
    if is_member and payload.password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Un Miembro obtiene su contraseña a través del flujo de invitación, no al crearlo",
        )
    if not is_member and not payload.password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Password requerido para dar de alta a un Dueño o Coach",
        )

    if not is_member and payload.password and not payload.email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Email requerido para dar acceso a un Dueño o Coach",
        )

    data = payload.model_dump(exclude={"password"})
    obj = models.User(
        **data,
        password_hash=hash_password(payload.password) if payload.password else None,
        email_verified=bool(payload.password),  # Dueño/Coach creado por owner: acceso inmediato
        is_active=True,
        membership_status=MembershipStatus.active if is_member else MembershipStatus.none,
        membership_start_date=datetime.utcnow() if is_member else None,
        created_by_user_id=current_user.id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)

    location = request.url_for("users:get_one", user_id=obj.id)
    response.headers["Location"] = str(location)
    return _serialize_user_single(db, obj)


@router.patch(
    "/{user_id}",
    response_model=schemas.UserOut,
    status_code=status.HTTP_200_OK,
)
def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    obj = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, obj.role)

    data = payload.model_dump(exclude_unset=True)
    if "role" in data:
        require_can_manage_user(current_user, data["role"])

    if "password" in data:
        password = data.pop("password")
        if password:
            # tasks.md 5.3: el password solo es seteable por el owner, y solo
            # para roles no-miembro (un Miembro obtiene el suyo por invitación,
            # ver `create_or_resend_invitation`) — si no, un coach le da acceso
            # a un miembro saltando member-invitation por completo.
            target_role = data.get("role", obj.role)
            target_role_value = (
                target_role.value if hasattr(target_role, "value") else target_role
            )
            if target_role_value == UserRole.member.value:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Un Miembro obtiene su contraseña a través del flujo de invitación, no al editarlo",
                )
            if current_user.role != UserRole.owner:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Solo el Dueño puede setear la contraseña directamente",
                )
            target_email = data.get("email", obj.email)
            if not target_email:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Email requerido para dar acceso a un Dueño o Coach",
                )
            obj.password_hash = hash_password(password)
            obj.email_verified = True

    for field, value in data.items():
        setattr(obj, field, value)

    db.commit()
    db.refresh(obj)
    return _serialize_user_single(db, obj)


# ---------------------------------------------------------------------------
# Membresia (endpoints dedicados: ver design.md, "Membresía por endpoints dedicados")
# ---------------------------------------------------------------------------

@router.post("/{user_id}/membership/activate", response_model=schemas.UserOut)
def activate_membership(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    obj = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, obj.role)
    if obj.membership_status == MembershipStatus.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "La membresía ya está activa")

    obj.membership_status = MembershipStatus.active
    obj.membership_cancelled_at = None
    if obj.membership_start_date is None:
        obj.membership_start_date = datetime.utcnow()

    db.commit()
    db.refresh(obj)
    return _serialize_user_single(db, obj)


@router.post("/{user_id}/membership/cancel", response_model=schemas.UserOut)
def cancel_membership(
    user_id: str,
    payload: schemas.MembershipCancelIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    obj = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, obj.role)
    if obj.membership_status != MembershipStatus.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "La membresía no está activa")

    obj.membership_status = MembershipStatus.cancelled
    obj.membership_cancelled_at = (
        payload.cancelled_at.replace(tzinfo=None)
        if payload.cancelled_at
        else datetime.utcnow()
    )

    db.commit()
    db.refresh(obj)
    return _serialize_user_single(db, obj)


# ---------------------------------------------------------------------------
# Estado de pago (ex `client_status`)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/status", response_model=schemas.UserPaymentStatus)
def user_status(user_id: str, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    last_month, last_year = _last_payment_month_year(db, user_id)

    cur_m, cur_y = utils.current_period()
    is_up_to_date = False
    if last_month is not None and last_year is not None:
        is_up_to_date = (last_year, last_month) >= (cur_y, cur_m)

    return schemas.UserPaymentStatus(
        user_id=user.id,
        full_name=user.full_name,
        is_up_to_date=is_up_to_date,
        last_payment_month=last_month,
        last_payment_year=last_year,
    )


# ---------------------------------------------------------------------------
# Invitación (member-invitation) - disparo/reenvío, autenticado
# ---------------------------------------------------------------------------

@router.post("/{user_id}/invitation", response_model=schemas.InvitationCreateOut)
def create_or_resend_invitation(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target = _get_user_or_404(db, user_id)

    if target.role != UserRole.member:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La invitación es exclusiva de usuarios con rol Miembro",
        )
    if not target.phone:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El usuario necesita un celular cargado para poder invitarlo",
        )
    if not target.email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El usuario necesita un email cargado para poder invitarlo",
        )
    if target.password_hash is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "El usuario ya tiene acceso activo al portal"
        )

    email_token = generate_invitation_token()
    phone_token = generate_invitation_token()
    now = datetime.utcnow()
    expires_at = now + timedelta(days=INVITATION_TTL_DAYS)
    email_link = f"{settings.FRONTEND_BASE_URL}/invitacion/email/{email_token}"
    phone_link = f"{settings.FRONTEND_BASE_URL}/invitacion/phone/{phone_token}"

    # Cerrar la transacción de las lecturas de arriba (`_get_user_or_404`)
    # ANTES de la llamada bloqueante a SMTP: si no, la conexión queda "idle in
    # transaction" durante toda la espera de red (el `commit()` de más abajo
    # ya la cerraba en el orden viejo). No hay nada para persistir todavía,
    # así que un rollback es un no-op seguro sobre el estado.
    db.rollback()

    # Enviar ANTES de tocar la base (hallazgo N5 de verification.md): si el
    # `NotificationSender` de SMTP revienta, no se revoca la invitación viva
    # ni se inserta una a medias — el admin puede reintentar "Reenviar" sin
    # haber perdido el link que ya funcionaba.
    get_notification_sender().send_invitation_email(target.email, email_link)

    # Reenvío = revocar la viva + insertar una nueva (design.md, decisión 9).
    live = _live_invitation_for(db, target.id)
    if live is not None:
        live.revoked_at = datetime.utcnow()

    invitation = models.MemberInvitation(
        user_id=target.id,
        email_token_hash=hash_invitation_token(email_token),
        phone_token_hash=hash_invitation_token(phone_token),
        created_at=now,
        expires_at=expires_at,
        created_by_user_id=current_user.id,
    )
    db.add(invitation)
    db.commit()

    return schemas.InvitationCreateOut(
        email_link=email_link,
        phone_link=phone_link,
        expires_at=expires_at,
    )
