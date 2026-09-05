# app/config.py
from pathlib import Path
import json
from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ruta del .env: backend/.env (subimos 1 nivel desde app/)
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600
    DEBUG: bool = False
    
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "https://libre-funcional.vercel.app",
        "https://miniespacio.vercel.app"
    ]

    # Origen público del frontend, para construir el link de invitación
    # (`/invitacion/{channel}/{token}`) que se manda por email/WhatsApp.
    FRONTEND_BASE_URL: str = "http://localhost:5173"

    # Entrega del link de invitación (member-invitation, design.md decisión 12).
    # "log" (default): no manda nada de verdad, deja el link en backend/logs/.
    # "smtp": smtplib de la biblioteca estándar, sin dependencias nuevas.
    NOTIFICATIONS_BACKEND: str = "log"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_FROM_NAME: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if isinstance(value, str) and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("["):
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value


    # Config Pydantic v2
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",  # Ignorar variables extra en .env
    )

try:
    settings = Settings()  # pyright: ignore[reportCallIssue]
except ValidationError as e:
    # Mostramos el error claramente (cuáles variables faltan)
    print(f"[CONFIG] Error al cargar variables desde {ENV_PATH}:")
    for err in e.errors():
        loc = ".".join(str(x) for x in err.get("loc", []))
        msg = err.get("msg")
        print(f" - {loc}: {msg}")
    raise
