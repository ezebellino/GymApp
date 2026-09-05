# scripts/seed_payments.py
import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import random
from datetime import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app import models

BATCH_SIZE = 500

def main():
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    db = Session()

    try:
        clients = (
            db.query(models.User.id, models.User.membership_start_date)
            .filter(
                models.User.role == models.UserRole.member,
                models.User.membership_status == models.MembershipStatus.active,
                models.User.membership_start_date.isnot(None),
            )
            .all()
        )
        if not clients:
            print("⚠️ No hay miembros con membresía activa. Abortando seed de pagos.")
            return

        methods = ["cash", "card", "transfer"]
        prices = [Decimal("8000.00"), Decimal("9000.00"), Decimal("10000.00"), Decimal("12000.00")]

        random.seed(12345)

        created = 0
        buffer = []

        now = datetime.utcnow()

        for (cid, joined) in clients:
            cid = str(cid)  # 👈 asegurar string

            # Meses desde que se unió hasta hoy (>= 1)
            months = max(1, (now.year - joined.year) * 12 + (now.month - joined.month))

            # Elegir 3–8 meses aleatorios pagados
            k = min(months, random.randint(3, 8))
            paid_offsets = set(random.sample(range(months), k=k))

            base_year = joined.year
            base_month = joined.month

            for i in range(months):
                yy = base_year + (base_month + i - 1) // 12
                mm = (base_month + i - 1) % 12 + 1

                if i not in paid_offsets:
                    continue

                # Evitar duplicados (por constraint uq_payment_period)
                exists = (
                    db.query(models.Payment.id)
                    .filter(
                        models.Payment.user_id == cid,
                        models.Payment.period_year == yy,
                        models.Payment.period_month == mm,
                    )
                    .first()
                )
                if exists:
                    continue

                p = models.Payment(
                    user_id=cid,                            # 👈 str
                    amount=random.choice(prices),          # Decimal
                    period_year=yy,
                    period_month=mm,
                    method=random.choice(methods),
                    note=None,                             # 👈 tu modelo usa 'note'
                    created_by_user_id=None,               # si querés, setear a un owner
                    created_at=datetime.utcnow(),
                )
                buffer.append(p)

                if len(buffer) >= BATCH_SIZE:
                    db.add_all(buffer)
                    db.commit()
                    created += len(buffer)
                    print(f"Insertados {created} pagos...")
                    buffer.clear()

        if buffer:
            db.add_all(buffer)
            db.commit()
            created += len(buffer)
            buffer.clear()

        print(f"✅ Listo. Insertados {created} pagos.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
