"""
Script para marcar todos los usuarios con role 'coach' como `email_verified=True`.
Usar localmente desde la carpeta `backend`:

python -m scripts.mark_coaches_verified

Asegurate de activar el virtualenv y tener la misma configuración de DB que la app.
"""
from app.database import SessionLocal
from app import models


def main():
    updated = 0
    db = SessionLocal()
    try:
        users = db.query(models.User).filter(models.User.role == models.UserRole.coach).all()
        for u in users:
            if not getattr(u, "email_verified", False):
                u.email_verified = True
                updated += 1
        if updated:
            db.commit()
    finally:
        db.close()

    print(f"Marked {updated} coach(es) as email_verified=True")


if __name__ == "__main__":
    main()
