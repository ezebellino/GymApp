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
from app.models import Client


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
            "Uso: python scripts/import_clients_csv.py <ruta_csv>\n"
            "Columnas esperadas: full_name,email,phone,is_active,join_date"
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
                full_name = (row.get("full_name") or "").strip()
                if not full_name:
                    continue

                client = Client(
                    full_name=full_name,
                    email=(row.get("email") or "").strip() or None,
                    phone=(row.get("phone") or "").strip() or None,
                    is_active=parse_bool(row.get("is_active")),
                    join_date=parse_date(row.get("join_date")),
                )
                db.add(client)
                created += 1

            db.commit()

    print(f"Importacion finalizada. Clientes creados: {created}")


if __name__ == "__main__":
    main()
