from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .deps import get_db
from . import models
from .config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Esquema OAuth2 estricto: siempre requiere token válido
strict_oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=True)

def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(p: str, hashed: str) -> bool:
    return pwd_context.verify(p, hashed)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(strict_oauth2),  # 👈 usamos el esquema estricto aquí
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # ✅ API moderna de SQLAlchemy
    user = db.get(models.User, user_id)
    if not user or not user.is_active:
        raise credentials_exception

    if getattr(user, "email_verified", True) is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )
    
    return user

def require_role(*roles: models.UserRole):
    def _dep(user: models.User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dep

def require_owner(user: models.User = Depends(get_current_user)):
    if user.role != models.UserRole.owner:
        raise HTTPException(status_code=403, detail="Solo Sergio puede realizar esta acción")
    return user

def require_coach_or_owner(user: models.User = Depends(get_current_user)):
    if user.role not in (models.UserRole.coach, models.UserRole.owner):
        raise HTTPException(status_code=403, detail="Acceso restringido a coaches y dueños.")
    return user