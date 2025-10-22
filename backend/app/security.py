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
