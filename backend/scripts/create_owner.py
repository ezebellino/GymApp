import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.auth import hash_password
from app.config import settings
from app.models import User, UserRole


OWNER_USERNAME = "manga_aguirre"
OWNER_PASSWORD = "Miniespacio1"
OWNER_NAME = "Dueño Mini Espacio"


def main():
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM users LIMIT 1"))
    except ProgrammingError:
        print(
            "La tabla 'users' no existe. Corre las migraciones primero:\n"
            "  alembic upgrade head"
        )
        return
    except OperationalError as exc:
        print(
            "No pude conectarme a la base. Revisa DATABASE_URL en .env y credenciales.\n",
            exc,
        )
        return

    with Session() as db:
        existing_user = db.query(User).filter(User.email == OWNER_USERNAME).first()
        if existing_user:
            existing_user.full_name = OWNER_NAME
            existing_user.password_hash = hash_password(OWNER_PASSWORD)
            existing_user.role = UserRole.owner
            existing_user.is_active = True
            existing_user.email_verified = True
            db.commit()
            print("Dueño actualizado:", OWNER_USERNAME, f"pass={OWNER_PASSWORD}")
            return

        owner = User(
            full_name=OWNER_NAME,
            email=OWNER_USERNAME,
            password_hash=hash_password(OWNER_PASSWORD),
            role=UserRole.owner,
            is_active=True,
            email_verified=True,
        )
        db.add(owner)
        db.commit()
        print("Dueño creado:", OWNER_USERNAME, f"pass={OWNER_PASSWORD}")


if __name__ == "__main__":
    main()
