import hashlib
import secrets
from typing import Optional
from fastapi import Security
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/token",   # sin "/" inicial
    auto_error=False         # importante para uso opcional
)

def optional_bearer(token: Optional[str] = Security(oauth2_scheme)):
    # No valida nada; solo expone el esquema en OpenAPI para que Swagger adjunte el Bearer si estás "Authorize"
    return token


# --- Invitación de miembro (member-invitation, design.md decisión 9) ---------
# Dos tokens en claro (uno por canal). Se guarda solo el hash, nunca el token: el
# mismo criterio que `password_hash` — un dump de la base no debe alcanzar para
# tomar cuentas.

def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
