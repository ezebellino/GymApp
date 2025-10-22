import sys
from pathlib import Path
# Asegurar que 'backend/' esté en sys.path si alguien corre el script desde otro lado
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import User, UserRole
from app.auth import hash_password
from sqlalchemy.exc import ProgrammingError, OperationalError

def main():
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)

    # Verificar que exista la tabla 'users' (por si faltan migraciones)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM users LIMIT 1"))
    except ProgrammingError:
        print("❌ La tabla 'users' no existe. Corré las migraciones primero:\n"
              "   alembic upgrade head")
        return
    except OperationalError as e:
        print("❌ No pude conectarme a la base. Revisá DATABASE_URL en .env y credenciales.\n", e)
        return

    email = "owner@librefuncional.com"
    with Session() as db:
        exists = db.query(User).filter(User.email == email).first()
        if exists:
            print("ℹ️  Owner ya existe:", email)
            return
        u = User(
            full_name="Owner",
            email=email,
            password_hash=hash_password("Cambiar123"),
            role=UserRole.owner
        )
        db.add(u)
        db.commit()
        print("✅ Owner creado:", email, "pass=Cambiar123")

if __name__ == "__main__":
    main()
