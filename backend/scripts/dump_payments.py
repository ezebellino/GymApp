"""scripts/dump_payments.py

Quick helper to print recent payments from the DB for debugging.
Run from the repository root using the project's venv, e.g.:

  cd backend
  .\venv\Scripts\python.exe -m scripts.dump_payments

"""
import os
import sys
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models
from sqlalchemy.orm import joinedload


def main(limit: int = 50):
    db = SessionLocal()
    try:
        q = (
            db.query(models.Payment)
            .options(joinedload(models.Payment.client))
            .order_by(models.Payment.created_at.desc())
            .limit(limit)
        )
        rows = q.all()
        if not rows:
            print("No payment rows found.")
            return

        print(f"Showing {len(rows)} most recent payments (limit={limit}):\n")
        for p in rows:
            client = getattr(p, "client", None)
            client_name = client.full_name if client else (p.client_id or "-")
            created = p.created_at.isoformat() if isinstance(p.created_at, datetime) else str(p.created_at)
            print(f"id={p.id}\n  client_id={p.client_id}\n  client_name={client_name}\n  method={p.method}\n  method_channel={p.method_channel}\n  amount={p.amount}\n  period={p.period_month}/{p.period_year}\n  created_at={created}\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
