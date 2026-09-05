"""Matriz de autorizacion por rol (owner / coach / member) en endpoints restringidos.

| Endpoint                 | owner | coach | member |
|--------------------------|-------|-------|--------|
| GET /users/               |  200  |  200  |  403   |
| GET /routines/my/profile  |  403  |  403  |  200   |

`/users/` va con barra final explicita: la ruta real es `@router.get("/")` sobre el
prefijo `/users`, y sin barra FastAPI responde 307.

Además, la regla de `require_can_manage_user` (`user-management`, "Permisos de
gestión por rol"): un Coach puede crear/editar solo usuarios con rol Miembro; un
Owner puede gestionar y cambiar el rol de cualquiera; y no existe ninguna ruta de
borrado de usuario ("No hay eliminación física").
"""

from app import models
from tests.helpers import COACH_EMAIL, OWNER_EMAIL, create_user


def _client_headers(client_user):
    return {"Authorization": f"Bearer {client_user['token']}"}


def test_member_no_accede_a_usuarios(client, client_user):
    response = client.get("/users/", headers=_client_headers(client_user))

    assert response.status_code == 403


def test_coach_accede_a_usuarios(client, coach_user, auth_header):
    response = client.get("/users/", headers=auth_header(COACH_EMAIL))

    assert response.status_code == 200, response.text


def test_owner_accede_a_usuarios(client, owner_user, auth_header):
    response = client.get("/users/", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text


def test_owner_no_accede_a_mi_perfil_de_rutina(client, owner_user, auth_header):
    response = client.get("/routines/my/profile", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 403


def test_coach_no_accede_a_mi_perfil_de_rutina(client, coach_user, auth_header):
    response = client.get("/routines/my/profile", headers=auth_header(COACH_EMAIL))

    assert response.status_code == 403


def test_member_accede_a_su_propio_perfil_de_rutina(client, client_user):
    response = client.get("/routines/my/profile", headers=_client_headers(client_user))

    assert response.status_code == 200, response.text


# --- Permisos de gestion (require_can_manage_user) --------------------------


def test_coach_crea_un_miembro(client, coach_user, auth_header):
    response = client.post(
        "/users/",
        json={"first_name": "Nuevo", "last_name": "Miembro", "role": "member"},
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 201, response.text
    assert response.json()["role"] == "member"


def test_coach_no_puede_crear_un_owner(client, coach_user, auth_header):
    response = client.post(
        "/users/",
        json={
            "first_name": "Intento",
            "last_name": "De Owner",
            "role": "owner",
            "password": "una-password-valida",
        },
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 403


def test_coach_no_puede_editar_a_otro_coach(client, coach_user, owner_user, auth_header, db_session):
    otro_coach = create_user(
        db_session,
        email="otro.coach@example.com",
        first_name="Otro",
        last_name="Coach",
        role=models.UserRole.coach,
    )

    response = client.patch(
        f"/users/{otro_coach.id}",
        json={"first_name": "Editado"},
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 403


def test_owner_puede_cambiar_el_rol_de_un_usuario(client, owner_user, coach_user, auth_header):
    response = client.patch(
        f"/users/{coach_user.id}",
        json={"role": "member"},
        headers=auth_header(OWNER_EMAIL),
    )

    assert response.status_code == 200, response.text
    assert response.json()["role"] == "member"


def test_no_existe_ruta_de_borrado_de_usuario(client, owner_user, coach_user, auth_header):
    response = client.delete(
        f"/users/{coach_user.id}",
        headers=auth_header(OWNER_EMAIL),
    )

    # FastAPI responde 405 (metodo no permitido) porque la ruta no registra DELETE.
    assert response.status_code == 405


# --- Password directo por PATCH (hallazgo 1 de verification.md) -------------


def test_coach_no_puede_setear_password_a_un_miembro_por_patch(
    client, coach_user, auth_header, db_session
):
    miembro = create_user(
        db_session,
        email="miembro.sin.invitar@example.com",
        first_name="Miembro",
        last_name="SinInvitar",
        role=models.UserRole.member,
        password_hash=None,
    )

    response = client.patch(
        f"/users/{miembro.id}",
        json={"password": "una-password-valida"},
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 400
    db_session.refresh(miembro)
    assert miembro.password_hash is None


def test_owner_puede_setear_password_directo_a_un_coach(
    client, owner_user, coach_user, auth_header, db_session
):
    response = client.patch(
        f"/users/{coach_user.id}",
        json={"password": "otra-password-valida"},
        headers=auth_header(OWNER_EMAIL),
    )

    assert response.status_code == 200, response.text
    db_session.refresh(coach_user)
    assert coach_user.password_hash is not None
    assert coach_user.email_verified is True


# --- Membresía de otro Dueño/Coach (hallazgo 2 de verification.md) ----------


def test_coach_no_puede_cancelar_la_membresia_de_un_owner(
    client, coach_user, owner_user, auth_header, db_session
):
    owner_user.membership_status = models.MembershipStatus.active
    db_session.add(owner_user)
    db_session.commit()

    response = client.post(
        f"/users/{owner_user.id}/membership/cancel",
        json={},
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 403


def test_coach_no_puede_activar_la_membresia_de_otro_coach(
    client, coach_user, auth_header, db_session
):
    otro_coach = create_user(
        db_session,
        email="otro.coach.membresia@example.com",
        first_name="Otro",
        last_name="Coach",
        role=models.UserRole.coach,
    )

    response = client.post(
        f"/users/{otro_coach.id}/membership/activate",
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 403


# --- Alta de Dueño/Coach sin email (hallazgo 9 de verification.md) ---------


def test_no_se_puede_crear_coach_con_password_sin_email(client, owner_user, auth_header):
    response = client.post(
        "/users/",
        json={
            "first_name": "Sin",
            "last_name": "Email",
            "role": "coach",
            "password": "una-password-valida",
        },
        headers=auth_header(OWNER_EMAIL),
    )

    assert response.status_code == 400


def test_no_se_puede_promover_a_coach_con_password_sin_email_por_patch(
    client, owner_user, auth_header
):
    # Alta mínima de un Miembro sin email (permitida por la spec) — el mismo
    # bug de "password sin email" del hallazgo 9, pero llegando por PATCH en
    # vez de POST (hallazgo N3 de la re-verificación).
    creado = client.post(
        "/users/",
        json={"first_name": "Sin", "last_name": "Email", "role": "member"},
        headers=auth_header(OWNER_EMAIL),
    )
    assert creado.status_code == 201, creado.text
    user_id = creado.json()["id"]

    response = client.patch(
        f"/users/{user_id}",
        json={"role": "coach", "password": "una-password-valida"},
        headers=auth_header(OWNER_EMAIL),
    )

    assert response.status_code == 400
