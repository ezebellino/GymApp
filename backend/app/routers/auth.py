from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from ..deps import get_db
from ..security import optional_bearer
from .. import models
from ..auth import verify_password, create_access_token, hash_password, is_membership_blocking_login
from ..auth import get_current_user
from .. import schemas

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(optional_bearer)])


def _build_token_for_user(user: models.User) -> dict[str, str]:
    token = create_access_token(
        {
            "sub": user.id,
            "name": user.full_name,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else user.role,
        }
    )
    return {"access_token": token, "token_type": "bearer"}

@router.post("/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    # Gate de invitación pendiente ANTES de `verify_password`: llamarlo con un hash
    # `None` revienta con excepción, no devuelve `False` (ver design.md, decision 11).
    if user.password_hash is None:
        raise HTTPException(
            status_code=400, detail="Tu invitación está pendiente de completar"
        )
    if not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    # Gate de membresía dada de baja, scopeado por rol (solo bloquea a un Miembro).
    if is_membership_blocking_login(user):
        raise HTTPException(status_code=400, detail="Tu membresía está dada de baja")

    return _build_token_for_user(user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Devuelve el usuario autenticado (fuente de la verdad para frontend)."""
    from .users import _serialize_user_single  # import diferido: evita ciclo de módulos

    return _serialize_user_single(db, user)


@router.patch("/me/theme", response_model=schemas.UserOut)
def update_my_theme(
    payload: schemas.ThemeModeIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Actualiza la preferencia de tema del usuario autenticado (solo la propia)."""
    user.theme_preference = payload.theme_preference
    db.commit()
    db.refresh(user)
    from .users import _serialize_user_single  # import diferido: evita ciclo de módulos

    return _serialize_user_single(db, user)
