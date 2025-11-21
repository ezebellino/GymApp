# routers/coaches.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..deps import get_db
from ..auth import require_owner, hash_password
from ..schemas import UserCreate, UserUpdate, UserOut
from ..models import User, UserRole

router = APIRouter(prefix="/coaches", tags=["coaches"])

@router.get("", response_model=list[UserOut])
def list_coaches(
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    return db.query(User).filter(User.role == UserRole.coach).all()

@router.post("", response_model=UserOut, status_code=201)
def create_coach(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    # Forzamos role = "coach"
    # Force role = coach server-side (ignore client-provided role)
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        role=UserRole.coach,
        password_hash=hash_password(payload.password),
        is_active=True,
        email_verified=True,  # Coach creado por owner: marcar verificado para permitir uso inmediato
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # acá luego podés disparar mail de verificación
    return user

@router.patch("/{coach_id}", response_model=UserOut)
def update_coach(
    coach_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    user = db.query(User).filter(User.id == coach_id, User.role == UserRole.coach).first()
    if not user:
        raise HTTPException(status_code=404, detail="Coach no encontrado")
    data = payload.dict(exclude_unset=True)

    # Prevent changing role via this endpoint
    if "role" in data:
        data.pop("role")

    # If updating email, ensure uniqueness
    if "email" in data:
        existing = db.query(User).filter(User.email == data["email"], User.id != coach_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email ya registrado por otro usuario")

    # If password provided, hash it and set `password_hash`
    if "password" in data:
        data["password_hash"] = hash_password(data.pop("password"))

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user

@router.delete("/{coach_id}", status_code=204)
def delete_coach(
    coach_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    user = db.query(User).filter(User.id == coach_id, User.role == UserRole.coach).first()
    if not user:
        raise HTTPException(status_code=404, detail="Coach no encontrado")
    db.delete(user)
    db.commit()
