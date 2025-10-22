# scripts/seed_clients.py
import os
import math
import random
import argparse
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Client  # ajustá si tu modelo vive en otro path
from app.config import settings  # para tomar DATABASE_URL

def make_session():
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    return sessionmaker(bind=engine)()

def random_join_date(months_back=18):
    # fecha dentro de los últimos 'months_back' meses
    days = months_back * 30
    delta_days = random.randint(0, days)
    return datetime.utcnow() - timedelta(days=delta_days)

def phone_arg():
    # genera un teléfono simple 10 dígitos
    return "".join(random.choice("0123456789") for _ in range(10))

def main():
    parser = argparse.ArgumentParser(description="Seed clients with fake data.")
    parser.add_argument("--n", type=int, default=200, help="Cantidad de clientes a crear")
    parser.add_argument("--locale", type=str, default="es_AR", help="Locale de Faker (es_AR recomendado)")
    parser.add_argument("--active-rate", type=float, default=0.85, help="Proporción de clientes activos (0..1)")
    parser.add_argument("--months-back", type=int, default=18, help="Antigüedad máxima de join_date en meses")
    parser.add_argument("--batch", type=int, default=200, help="Tamaño de lote para commits")
    args = parser.parse_args()

    from faker import Faker
    fake = Faker(args.locale)
    Faker.seed(12345)
    random.seed(12345)

    db = make_session()

    created = 0
    batch_size = args.batch
    objs = []

    for i in range(args.n):
        full_name = fake.name()
        # emails únicos:
        email = fake.unique.email()
        phone = phone_arg()
        is_active = random.random() < args.active_rate
        join_date = random_join_date(args.months_back)

        obj = Client(
            id=str(uuid4()),
            full_name=full_name,
            email=email,
            phone=phone,
            is_active=is_active,
            join_date=join_date,
        )
        objs.append(obj)

        if len(objs) >= batch_size:
            db.bulk_save_objects(objs)
            db.commit()
            created += len(objs)
            print(f"Insertados {created}/{args.n}...")
            objs.clear()

    if objs:
        db.bulk_save_objects(objs)
        db.commit()
        created += len(objs)

    print(f"✅ Listo. Insertados {created} clientes.")
    db.close()

if __name__ == "__main__":
    main()
