"""Configuracion compartida de la suite de tests del backend.

Las variables de entorno se setean **antes** de cualquier `import app.*`: en
pydantic-settings las env vars ganan sobre el `env_file`, asi que el `backend/.env`
real del dev queda intacto y sin efecto sobre los tests. Es la red de seguridad que
garantiza que la suite no pueda tocar la base de desarrollo ni la de produccion.
"""

import os
import tempfile

# --- Entorno de test: setear ANTES de importar la app -----------------------
# SQLite de archivo (no `:memory:`): `app/database.py` crea el engine con
# `pool_size=2, max_overflow=0`, y con SQLite en memoria SQLAlchemy elige
# SingletonThreadPool, que rechaza `max_overflow` y rompe el import.
_TMP_DIR = tempfile.mkdtemp(prefix="miniespacio-tests-")
_DB_PATH = os.path.join(_TMP_DIR, "test.db")
TEST_DATABASE_URL = f"sqlite:///{_DB_PATH}"

# Asignacion directa (no setdefault): una variable exportada en la shell no gana.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
# OJO: no setear CORS_ORIGINS. Es `list[str]` y pydantic-settings intenta parsear
# JSON en la fuente de entorno antes de que corra el field_validator que soporta el
# formato coma-separado; exportarla hace fallar el import con SettingsError.

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app import models  # noqa: E402
from app.auth import hash_password  # noqa: E402
from app.deps import get_db  # noqa: E402
from app.models import Base  # noqa: E402
from app.main import app  # noqa: E402
from tests.helpers import CLIENT_EMAIL, COACH_EMAIL, OWNER_EMAIL, PASSWORD, login  # noqa: E402

test_engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@pytest.fixture(autouse=True)
def db_schema():
    """Esquema limpio por test: dos corridas seguidas dan el mismo resultado."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# --- Usuarios ---------------------------------------------------------------
# bcrypt cuesta ~0.28 s por hash: no crear usuarios que el test no use.
# Los emails y el helper `login` viven en `tests/helpers.py`: importarlos desde acá
# con `from tests.conftest import ...` cargaria el conftest una segunda vez.


def _create_user(session, *, email, full_name, role):
    user = models.User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(PASSWORD),
        email_verified=True,
        role=role,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture
def owner_user(db_session):
    return _create_user(
        db_session,
        email=OWNER_EMAIL,
        full_name="Duenio de Test",
        role=models.UserRole.owner,
    )


@pytest.fixture
def coach_user(db_session):
    return _create_user(
        db_session,
        email=COACH_EMAIL,
        full_name="Coach de Test",
        role=models.UserRole.coach,
    )


@pytest.fixture
def client_user(client):
    """Rol `user`, creado por el endpoint real de registro.

    Es el unico camino que linkea `client_id`, y sin ese link
    `GET /routines/my/client` no devuelve 200.
    """
    response = client.post(
        "/auth/client-register",
        json={
            "full_name": "Cliente de Test",
            "email": CLIENT_EMAIL,
            "password": PASSWORD,
        },
    )
    assert response.status_code == 200, response.text
    return {"email": CLIENT_EMAIL, "token": response.json()["access_token"]}


@pytest.fixture
def auth_header(client):
    """`auth_header(email)` -> header Authorization de ese usuario ya registrado."""

    def _auth_header(email, password=PASSWORD):
        return login(client, email, password)

    return _auth_header
