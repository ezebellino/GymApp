import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.config import settings
from app.models import Attendance, Client, Payment, WorkoutLog

CONFIRM_TOKEN = "MINI-ESPACIO"


def main():
    if len(sys.argv) < 2 or sys.argv[1] != "--confirm":
        print(
            "Este script borra clientes y sus datos asociados.\n"
            f"Ejecuta: python scripts/reset_clients.py --confirm {CONFIRM_TOKEN}"
        )
        return

    if len(sys.argv) < 3 or sys.argv[2] != CONFIRM_TOKEN:
        print(f"Confirmacion invalida. Usa exactamente: {CONFIRM_TOKEN}")
        return

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        clients_count = db.query(Client).count()
        payments_count = db.query(Payment).count()
        attendance_count = db.query(Attendance).count()
        logs_count = db.query(WorkoutLog).count()

        db.query(Payment).delete()
        db.query(Attendance).delete()
        db.query(WorkoutLog).delete()
        db.query(Client).delete()
        db.commit()

    print(
        "Base de clientes limpiada.\n"
        f"Clientes borrados: {clients_count}\n"
        f"Pagos borrados: {payments_count}\n"
        f"Asistencias borradas: {attendance_count}\n"
        f"Avances de rutina borrados: {logs_count}"
    )


if __name__ == "__main__":
    main()
