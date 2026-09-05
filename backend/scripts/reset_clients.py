import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.config import settings
from app.models import Attendance, Payment, User, UserRole, WorkoutLog

CONFIRM_TOKEN = "MINI-ESPACIO"


def main():
    if len(sys.argv) < 2 or sys.argv[1] != "--confirm":
        print(
            "Este script borra usuarios con rol Miembro y sus datos asociados "
            "(nunca Dueños ni Coaches).\n"
            f"Ejecuta: python scripts/reset_clients.py --confirm {CONFIRM_TOKEN}"
        )
        return

    if len(sys.argv) < 3 or sys.argv[2] != CONFIRM_TOKEN:
        print(f"Confirmacion invalida. Usa exactamente: {CONFIRM_TOKEN}")
        return

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        member_ids = [row.id for row in db.query(User.id).filter(User.role == UserRole.member).all()]

        clients_count = len(member_ids)
        payments_count = 0
        attendance_count = 0
        logs_count = 0

        if member_ids:
            # Los FK de historial son RESTRICT (ver unify-clients-into-users): hay
            # que borrar pagos/asistencias/rutinas antes de poder borrar los
            # usuarios Miembro.
            payments_count = (
                db.query(Payment).filter(Payment.user_id.in_(member_ids)).delete(synchronize_session=False)
            )
            attendance_count = (
                db.query(Attendance).filter(Attendance.user_id.in_(member_ids)).delete(synchronize_session=False)
            )
            logs_count = (
                db.query(WorkoutLog).filter(WorkoutLog.user_id.in_(member_ids)).delete(synchronize_session=False)
            )
            db.query(User).filter(User.id.in_(member_ids)).delete(synchronize_session=False)

        db.commit()

    print(
        "Usuarios Miembro limpiados (Dueños/Coaches no se tocan).\n"
        f"Usuarios Miembro borrados: {clients_count}\n"
        f"Pagos borrados: {payments_count}\n"
        f"Asistencias borradas: {attendance_count}\n"
        f"Avances de rutina borrados: {logs_count}"
    )


if __name__ == "__main__":
    main()
