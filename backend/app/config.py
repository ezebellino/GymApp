# app/config.py
from pathlib import Path
from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ruta del .env: backend/.env (subimos 1 nivel desde app/)
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

class Settings(BaseSettings):
    # === Variables requeridas ===
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600
    DEBUG: bool = False

    # Config Pydantic v2
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",  # Ignorar variables extra en .env
    )

try:
    settings = Settings()
except ValidationError as e:
    # Mostramos el error claramente (cuáles variables faltan)
    print(f"[CONFIG] Error al cargar variables desde {ENV_PATH}:")
    for err in e.errors():
        loc = ".".join(str(x) for x in err.get("loc", []))
        msg = err.get("msg")
        print(f" - {loc}: {msg}")
    raise
