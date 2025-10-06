from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# Cambiar a Postgres en producción, ej: "postgresql+psycopg://user:pass@host/db"
DATABASE_URL = "postgresql+psycopg://postgres:Eze030790.@localhost:5432/LibreFuncional"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()