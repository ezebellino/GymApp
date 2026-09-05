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
from app.deps import get_db  # noqa: E402
from app.models import Base  # noqa: E402
from app.main import app  # noqa: E402
from tests.helpers import (  # noqa: E402
    CLIENT_EMAIL,
    COACH_EMAIL,
    OWNER_EMAIL,
    PASSWORD,
    create_user,
    login,
)

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
# `create_user`, los emails y el helper `login` viven en `tests/helpers.py`:
# importarlos desde un test con `from tests.conftest import ...` cargaria el
# conftest una segunda vez (ver docstring de helpers.py).


@pytest.fixture
def owner_user(db_session):
    return create_user(
        db_session,
        email=OWNER_EMAIL,
        first_name="Duenio",
        last_name="de Test",
        role=models.UserRole.owner,
    )


@pytest.fixture
def coach_user(db_session):
    return create_user(
        db_session,
        email=COACH_EMAIL,
        first_name="Coach",
        last_name="de Test",
        role=models.UserRole.coach,
    )


@pytest.fixture
def client_user(client, db_session):
    """Rol Miembro con membresía activa y acceso ya creado directamente en la base.

    Ya no hay auto-registro (`/auth/client-register` se retiró: ver capability
    `register-client-view`); el alta de un Miembro y su acceso al portal los inicia
    siempre un admin/coach a través de `member-invitation`. Para el smoke de
    autenticación alcanza con una cuenta ya seedeada, así que se crea directo acá.
    """
    create_user(
        db_session,
        email=CLIENT_EMAIL,
        first_name="Cliente",
        last_name="de Test",
        role=models.UserRole.member,
    )
    response = client.post(
        "/auth/token", data={"username": CLIENT_EMAIL, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"email": CLIENT_EMAIL, "token": response.json()["access_token"]}


@pytest.fixture
def auth_header(client):
    """`auth_header(email)` -> header Authorization de ese usuario ya registrado."""

    def _auth_header(email, password=PASSWORD):
        return login(client, email, password)

    return _auth_header
