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

    email = "owner@miniespacio.com"
    with Session() as db:
        exists = db.query(User).filter(User.email == email).first()
        if exists:
            print("El dueño ya existe:", email)
            return

        owner = User(
            full_name="Dueño",
            email=email,
            password_hash=hash_password("Cambiar123"),
            role=UserRole.owner,
        )
        db.add(owner)
        db.commit()
        print("Dueño creado:", email, "pass=Cambiar123")


if __name__ == "__main__":
    main()
