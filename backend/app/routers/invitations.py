"""Endpoints públicos del flujo de invitación (`member-invitation`).

Sin auth: el token *es* la credencial (design.md, decisión 10). El endpoint
autenticado que crea/reenvía la invitación (`POST /users/{id}/invitation`) vive en
`routers/users.py`, junto al resto del ABM de usuarios.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import hash_password, is_membership_blocking_login
from ..deps import get_db
from ..security import hash_invitation_token

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _invitation_by_token(
    db: Session, channel: schemas.InvitationChannel, token: str
) -> models.MemberInvitation | None:
    token_hash = hash_invitation_token(token)
    column = (
        models.MemberInvitation.email_token_hash
        if channel == "email"
        else models.MemberInvitation.phone_token_hash
    )
    return db.query(models.MemberInvitation).filter(column == token_hash).first()


def _validate_not_expired_or_revoked(invitation: models.MemberInvitation) -> None:
    if invitation.completed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "La invitación ya fue completada")
    if invitation.revoked_at is not None or invitation.expires_at < datetime.utcnow():
        raise HTTPException(
            status.HTTP_410_GONE, "El link de invitación expiró o fue revocado"
        )


@router.get("/{channel}/{token}", response_model=schemas.InvitationStateOut)
def get_invitation_state(
    channel: schemas.InvitationChannel, token: str, db: Session = Depends(get_db)
):
    invitation = _invitation_by_token(db, channel, token)
    if not invitation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitación no encontrada")
    _validate_not_expired_or_revoked(invitation)

    now = datetime.utcnow()
    if channel == "email" and invitation.email_verified_at is None:
        invitation.email_verified_at = now
    if channel == "phone" and invitation.phone_verified_at is None:
        invitation.phone_verified_at = now
    db.commit()
    db.refresh(invitation)

    user = db.get(models.User, invitation.user_id)
    return schemas.InvitationStateOut(
        first_name=user.first_name,
        email_verified=invitation.email_verified_at is not None,
        phone_verified=invitation.phone_verified_at is not None,
        can_set_password=(
            invitation.email_verified_at is not None
            and invitation.phone_verified_at is not None
        ),
    )


@router.post("/{channel}/{token}/complete")
def complete_invitation(
    channel: schemas.InvitationChannel,
    token: str,
    payload: schemas.InvitationCompleteIn,
    db: Session = Depends(get_db),
):
    invitation = _invitation_by_token(db, channel, token)
    if not invitation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitación no encontrada")
    _validate_not_expired_or_revoked(invitation)

    missing = [
        label
        for label, verified_at in (
            ("email", invitation.email_verified_at),
            ("phone", invitation.phone_verified_at),
        )
        if verified_at is None
    ]
    if missing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Falta verificar un canal", "missing_channels": missing},
        )

    user = db.get(models.User, invitation.user_id)
    user.password_hash = hash_password(payload.password)
    user.email_verified = True
    user.phone_verified = True
    invitation.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    # La contraseña ya quedó guardada arriba (completar la invitación no se pierde),
    # pero si la membresía fue dada de baja mientras la invitación estaba en curso,
    # no se entrega token (member-invitation, "Login bloqueado hasta completar la
    # invitación" + "Baja posterior bloquea a un miembro que ya había completado").
    if is_membership_blocking_login(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu membresía está dada de baja")

    from .auth import _build_token_for_user  # import diferido: evita ciclo de módulos

    return _build_token_for_user(user)
