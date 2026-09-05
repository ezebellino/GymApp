"""Seed idempotente de los tres usuarios de desarrollo (Dueño, Coach, Miembro).

Los usa el widget de cambio de rol del frontend (`components/dev/DevRoleSwitcher`),
que loguea con estas credenciales contra `POST /auth/token`. La misma tabla vive en
`frontend/src/components/dev/devUsers.ts`, a propósito duplicada (ver
`openspec/changes/add-dev-role-switcher/design.md`, decisión 8): si los valores no
coinciden, el widget devuelve un 400 con un mensaje que dice qué correr.

Se corre con `make seed-dev` desde la raíz (detecta Docker vs. nativo) o, dentro de
`backend/`, con `python -m scripts.seed_dev_users`. Se niega a correr fuera de
desarrollo: doble candado sobre `ENVIRONMENT` y el host de `DATABASE_URL`.
"""

import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.auth import hash_password
from app.config import settings
from app.models import MembershipStatus, User, UserRole


DEV_PASSWORD = "devdev123"

# Única definición del lado backend. Mismos valores que `devUsers.ts` en el frontend.
DEV_USERS = [
    {
        "email": "dev.owner@miniespacio.local",
        "password": DEV_PASSWORD,
        "first_name": "Dev",
        "last_name": "Dueño",
        "role": UserRole.owner,
    },
    {
        "email": "dev.coach@miniespacio.local",
        "password": DEV_PASSWORD,
        "first_name": "Dev",
        "last_name": "Coach",
        "role": UserRole.coach,
    },
    {
        "email": "dev.member@miniespacio.local",
        "password": DEV_PASSWORD,
        "first_name": "Dev",
        "last_name": "Miembro",
        "role": UserRole.member,
    },
]

ALLOWED_ENVIRONMENTS = {"development", "local", "test"}
# "" cubre SQLite de archivo (`sqlite:///ruta`), que no tiene host.
ALLOWED_DB_HOSTS = {"localhost", "127.0.0.1", "db", ""}


def seed_dev_users(db: Session) -> dict:
    """Upsert por email de los tres usuarios. Sin guardas ni engine propio: recibe la
    sesión para poder correrse también sobre la SQLite de la suite de tests.

    Pisa nombre/password/rol/flags de una fila existente (mismo criterio que
    `create_owner.py`). Los campos no son decorativos, salen de los gates de
    `app/auth.py`: sin `password_hash` el login responde "invitación pendiente"; sin
    `email_verified` `/auth/me` responde 403; sin `is_active` responde 401; y un
    Miembro sin `membership_status=active` lo rechaza `is_membership_blocking_login`.
    """
    created = 0
    updated = 0

    for spec in DEV_USERS:
        user = db.query(User).filter(User.email == spec["email"]).first()
        is_member = spec["role"] == UserRole.member

        if user:
            user.first_name = spec["first_name"]
            user.last_name = spec["last_name"]
            user.password_hash = hash_password(spec["password"])
            user.role = spec["role"]
            user.is_active = True
            user.email_verified = True
            if is_member:
                user.membership_status = MembershipStatus.active
                if user.membership_start_date is None:
                    user.membership_start_date = datetime.utcnow()
                user.membership_cancelled_at = None
            updated += 1
            continue

        db.add(
            User(
                first_name=spec["first_name"],
                last_name=spec["last_name"],
                email=spec["email"],
                password_hash=hash_password(spec["password"]),
                role=spec["role"],
                is_active=True,
                email_verified=True,
                membership_status=(
                    MembershipStatus.active if is_member else MembershipStatus.none
                ),
                membership_start_date=datetime.utcnow() if is_member else None,
            )
        )
        created += 1

    db.commit()
    return {"created": created, "updated": updated}


def check_environment_guards() -> None:
    """Doble candado antes de abrir cualquier conexión (design, decisión 9).

    Sale con código 1 (no `return`): una negativa que termina en 0 se ve como éxito
    desde `make` y desde CI.
    """
    environment = settings.ENVIRONMENT.strip().lower()
    if environment not in ALLOWED_ENVIRONMENTS:
        print(
            "Me niego a seedear usuarios de desarrollo: ENVIRONMENT="
            f"{settings.ENVIRONMENT!r} no es de desarrollo "
            f"(esperaba uno de {sorted(ALLOWED_ENVIRONMENTS)}).\n"
            "Declará ENVIRONMENT=development en backend/.env si esta base es local."
        )
        sys.exit(1)

    db_host = (urlsplit(settings.DATABASE_URL).hostname or "").lower()
    if db_host not in ALLOWED_DB_HOSTS:
        print(
            "Me niego a seedear usuarios de desarrollo: el host de DATABASE_URL es "
            f"{db_host!r}, no una base local "
            f"(esperaba uno de {sorted(h or '<sin host>' for h in ALLOWED_DB_HOSTS)})."
        )
        sys.exit(1)


def main():
    check_environment_guards()

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM users LIMIT 1"))
    except ProgrammingError:
        print(
            "La tabla 'users' no existe. Corre las migraciones primero:\n"
            "  alembic upgrade head"
        )
        sys.exit(1)
    except OperationalError as exc:
        print(
            "No pude conectarme a la base. Revisa DATABASE_URL en .env y credenciales.\n",
            exc,
        )
        sys.exit(1)

    with SessionLocal() as db:
        result = seed_dev_users(db)

    print(
        f"Usuarios de desarrollo listos ({result['created']} creados, "
        f"{result['updated']} actualizados). Password de los tres: {DEV_PASSWORD}"
    )
    for spec in DEV_USERS:
        print(f"  {spec['role'].value:<7} {spec['email']}")


if __name__ == "__main__":
    main()
