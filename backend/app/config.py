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

    # Entorno de ejecución. Default deliberadamente "production": si nadie declara la
    # variable, los scripts que solo tienen sentido en desarrollo (p. ej.
    # `scripts/seed_dev_users.py`) se niegan a correr. Los `.env*.example` ya la
    # traen como `development`.
    ENVIRONMENT: str = "production"

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

    # Object storage del catálogo de ejercicios (`exercise-catalog`, design D8/D10).
    # Todas con default: un `.env` viejo sin estas variables no rompe el arranque.
    # El default apunta al MinIO local de `docker-compose.yml`, que es el entorno de
    # desarrollo por defecto del repo.
    STORAGE_BACKEND: str = "s3"  # "s3" | "memory" (la suite usa "memory")
    STORAGE_ENDPOINT_URL: str = "http://localhost:9000"  # vacío ⇒ AWS S3 real
    # Contra quién se firma la URL que ve el browser (design D3.1). Vacío ⇒ cae a
    # `STORAGE_ENDPOINT_URL`. Solo hace falta setearla en Compose, donde el backend
    # habla con MinIO por el hostname interno de la red (`http://minio:9000`) pero
    # esa URL prefirmada la resuelve el browser desde el host (`http://localhost:9000`).
    STORAGE_PUBLIC_ENDPOINT_URL: str = ""
    STORAGE_REGION: str = "us-east-1"  # MinIO la ignora, SigV4 la exige
    STORAGE_ACCESS_KEY_ID: str = ""
    STORAGE_SECRET_ACCESS_KEY: str = ""
    STORAGE_BUCKET: str = "gymapp-media"
    STORAGE_MAX_UPLOAD_BYTES: int = 26_214_400  # 25 MB, design D5
    STORAGE_URL_TTL_SECONDS: int = 3600  # design D3
    STORAGE_USE_PATH_STYLE: bool = True  # MinIO necesita path-style
    STORAGE_URL_WINDOW_SECONDS: int = 900  # cuantización de la firma, design D3

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
