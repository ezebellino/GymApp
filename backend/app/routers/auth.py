from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from ..deps import get_db
from ..security import optional_bearer
from .. import models
from ..auth import verify_password, create_access_token
from ..auth import get_current_user
from .. import schemas

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(optional_bearer)])

@router.post("/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    token = create_access_token({
        "sub": user.id, 
        "name": user.full_name, 
        "email": user.email, 
        "role": user.role
        })
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    """Devuelve el usuario autenticado (fuente de la verdad para frontend)."""
    return user
