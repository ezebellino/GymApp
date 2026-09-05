"""Seed de usuarios de desarrollo (`scripts/seed_dev_users.py`, capability
`dev-role-switcher`): idempotencia, login real de los tres usuarios y guardas de
entorno.

`seed_dev_users(db)` recibe la sesión y no toca entorno ni engine, así que corre
sobre la SQLite de la suite. Las guardas se prueban vía `main()`, monkeypatcheando
`settings` y reemplazando `create_engine` por un centinela que falla si se llama: la
negativa tiene que ocurrir **antes** de abrir cualquier conexión.
"""

import pytest

from app import models
from scripts import seed_dev_users as seed_module
from scripts.seed_dev_users import DEV_PASSWORD, DEV_USERS, seed_dev_users

DEV_EMAILS = [spec["email"] for spec in DEV_USERS]


def _dev_users_in_db(db_session):
    return (
        db_session.query(models.User)
        .filter(models.User.email.in_(DEV_EMAILS))
        .order_by(models.User.email)
        .all()
    )


def test_seed_dev_users_crea_los_tres_usuarios_una_vez_por_rol(db_session):
    result = seed_dev_users(db_session)

    assert result == {"created": 3, "updated": 0}
    users = _dev_users_in_db(db_session)
    assert sorted(u.email for u in users) == sorted(DEV_EMAILS)
    assert sorted(u.role for u in users) == sorted(
        [models.UserRole.owner, models.UserRole.coach, models.UserRole.member]
    )

    member = next(u for u in users if u.role == models.UserRole.member)
    assert member.membership_status == models.MembershipStatus.active
    assert member.membership_start_date is not None
    for user in users:
        assert user.is_active is True
        assert user.email_verified is True
        assert user.password_hash is not None


def test_seed_dev_users_dos_veces_no_duplica_usuarios(db_session):
    first = seed_dev_users(db_session)
    second = seed_dev_users(db_session)

    assert first == {"created": 3, "updated": 0}
    assert second == {"created": 0, "updated": 3}
    users = _dev_users_in_db(db_session)
    assert len(users) == 3
    assert len({u.email for u in users}) == 3
    member = next(u for u in users if u.role == models.UserRole.member)
    assert member.membership_status == models.MembershipStatus.active


@pytest.mark.parametrize(
    "spec", DEV_USERS, ids=[spec["role"].value for spec in DEV_USERS]
)
def test_cada_usuario_de_desarrollo_puede_loguearse(client, db_session, spec):
    # Prueba de verdad los gates de `routers/auth.py::login` y `get_current_user`
    # (password_hash / email_verified / is_active / membership_status), en
    # particular para el Miembro, el único con un gate no obvio.
    seed_dev_users(db_session)

    token_response = client.post(
        "/auth/token", data={"username": spec["email"], "password": DEV_PASSWORD}
    )
    assert token_response.status_code == 200, token_response.text
    token = token_response.json()["access_token"]

    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200, me_response.text
    body = me_response.json()
    assert body["email"] == spec["email"]
    assert body["role"] == spec["role"].value


def _forbid_engine(monkeypatch):
    """Reemplaza `create_engine` del módulo del seed por un centinela: si la guarda
    dejó pasar, el test falla acá con un mensaje claro en vez de conectarse."""

    def _boom(*args, **kwargs):
        raise AssertionError(
            "create_engine fue llamado: la guarda de entorno tenía que cortar antes"
        )

    monkeypatch.setattr(seed_module, "create_engine", _boom)


def test_seed_se_niega_a_correr_fuera_de_desarrollo(monkeypatch, db_session):
    monkeypatch.setattr(seed_module.settings, "ENVIRONMENT", "production")
    _forbid_engine(monkeypatch)

    with pytest.raises(SystemExit) as exc_info:
        seed_module.main()

    assert exc_info.value.code != 0
    assert _dev_users_in_db(db_session) == []


def test_seed_se_niega_con_database_url_remota(monkeypatch, db_session):
    monkeypatch.setattr(seed_module.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(
        seed_module.settings,
        "DATABASE_URL",
        "postgresql+psycopg://gymapp:secret@db.abcdefgh.supabase.co:5432/postgres",
    )
    _forbid_engine(monkeypatch)

    with pytest.raises(SystemExit) as exc_info:
        seed_module.main()

    assert exc_info.value.code != 0
    assert _dev_users_in_db(db_session) == []
