# scripts/seed_attendance.py
import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app import models


BATCH_SIZE = 1000

def main():
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    db = Session()

    try:
        # Trae solo IDs activos (como str)
        client_rows = db.query(models.Client.id).filter(models.Client.is_active.is_(True)).all()
        client_ids = [str(c.id) for (c,) in client_rows] if client_rows and isinstance(client_rows[0], tuple) else [str(c.id) for c in client_rows]
        if not client_ids:
            print("⚠️ No hay clientes activos. Abortando seed de asistencias.")
            return

        random.seed(54321)
        now = datetime.utcnow()
        start = now - timedelta(days=60)

        created = 0
        buffer = []

        for day in range(60):
            date = start + timedelta(days=day)

            # 10–30 asistencias por día
            for _ in range(random.randint(10, 30)):
                cid = random.choice(client_ids)
                hour = random.randint(8, 21)
                minute = random.choice([0, 15, 30, 45])
                checkin_at = date.replace(hour=hour, minute=minute, second=0, microsecond=0)

                a = models.Attendance(
                    # id: si tu modelo tiene default UUID en DB o en modelo, podés omitirlo
                    client_id=cid,           # 👈 str
                    coach_id=None,           # si querés, populate luego
                    checkin_at=checkin_at,
                )
                buffer.append(a)

                if len(buffer) >= BATCH_SIZE:
                    db.add_all(buffer)
                    db.commit()
                    created += len(buffer)
                    print(f"Insertadas {created} asistencias...")
                    buffer.clear()

        if buffer:
            db.add_all(buffer)
            db.commit()
            created += len(buffer)
            buffer.clear()

        print(f"✅ Listo. Insertadas {created} asistencias.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
