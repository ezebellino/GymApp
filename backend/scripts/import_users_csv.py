import csv
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.config import settings
from app.models import MembershipStatus, User, UserRole


def parse_bool(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() not in {"0", "false", "no", "n"}


def parse_date(value: str | None) -> datetime:
    if not value:
        return datetime.utcnow()
    return datetime.fromisoformat(value)


def main():
    if len(sys.argv) < 2:
        print(
            "Uso: python scripts/import_users_csv.py <ruta_csv>\n"
            "Columnas esperadas: first_name,last_name,email,phone,is_active,join_date\n"
            "(is_active acá es el estado de MEMBRESÍA -> membership_status "
            "active/cancelled, no la cuenta; join_date -> membership_start_date)"
        )
        return

    csv_path = Path(sys.argv[1]).resolve()
    if not csv_path.exists():
        print(f"No existe el archivo: {csv_path}")
        return

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)

    created = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)

        with Session() as db:
            for row in reader:
                first_name = (row.get("first_name") or "").strip()
                if not first_name:
                    continue

                membership_active = parse_bool(row.get("is_active"))
                join_date = parse_date(row.get("join_date"))

                user = User(
                    first_name=first_name,
                    last_name=(row.get("last_name") or "").strip() or None,
                    email=(row.get("email") or "").strip() or None,
                    phone=(row.get("phone") or "").strip() or None,
                    role=UserRole.member,
                    is_active=True,
                    membership_status=(
                        MembershipStatus.active if membership_active else MembershipStatus.cancelled
                    ),
                    membership_start_date=join_date,
                    membership_cancelled_at=None if membership_active else datetime.utcnow(),
                    password_hash=None,
                    email_verified=False,
                    phone_verified=False,
                )
                db.add(user)
                created += 1

            db.commit()

    print(f"Importacion finalizada. Usuarios (rol Miembro) creados: {created}")


if __name__ == "__main__":
    main()
