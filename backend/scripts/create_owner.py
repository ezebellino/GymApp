# scripts/create_owner.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User, UserRole
from app.auth import hash_password

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:TU_PASS@localhost:5432/LibreFuncional")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine)

with Session() as db:
    email = "owner@librefuncional.com"
    if not db.query(User).filter(User.email==email).first():
        u = User(
            full_name="Owner",
            email=email,
            password_hash=hash_password("Cambiar123"),
            role=UserRole.owner
        )
        db.add(u); db.commit()
        print("Owner creado:", email, "pass=Cambiar123")
    else:
        print("Owner ya existe.")
