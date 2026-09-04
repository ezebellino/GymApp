from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from ..deps import get_db
from ..security import optional_bearer
from .. import models
from ..auth import verify_password, create_access_token, hash_password
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
            "client_id": user.client_id,
        }
    )
    return {"access_token": token, "token_type": "bearer"}

@router.post("/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    return _build_token_for_user(user)


@router.post("/client-register")
def client_register(payload: schemas.ClientRegisterIn, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()

    existing_user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email ya registrado")

    client = db.query(models.Client).filter(models.Client.email == normalized_email).first()
    if not client:
        client = models.Client(
            full_name=payload.full_name,
            email=normalized_email,
            phone=payload.phone,
            is_active=True,
        )
        db.add(client)
        db.flush()

    existing_client_user = (
        db.query(models.User)
        .filter(models.User.client_id == client.id, models.User.role == models.UserRole.user)
        .first()
    )
    if existing_client_user:
        raise HTTPException(
            status_code=400,
            detail="Este cliente ya tiene una cuenta de acceso. Usá recuperar contraseña.",
        )

    user = models.User(
        full_name=payload.full_name,
        email=normalized_email,
        password_hash=hash_password(payload.password),
        email_verified=True,
        role=models.UserRole.user,
        client_id=client.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _build_token_for_user(user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    """Devuelve el usuario autenticado (fuente de la verdad para frontend)."""
    return user


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
    return user
