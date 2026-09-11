"""Check-in por búsqueda de texto (`POST /attendance/checkin` con `q`) y autorización
del historial (`GET /attendance/`, capability `staff-endpoint-authorization`).

El bloque de check-in cubre el hallazgo N4 de `verification.md` de
`unify-clients-into-users`: antes de acotar la búsqueda a membresía activa, un
Dueño/Coach homónimo sin membresía podía ganarle el match a un Miembro real y el 400
resultante ("no tiene una membresía activa") confundía en vez de resolver al miembro
que sí quería hacer check-in.

El bloque de autorización cubre `secure-staff-endpoints`: antes de ese change,
`GET /attendance/` respondía sin exigir sesión ni rol pese a que el router declaraba
`Depends(optional_bearer)`, que no valida nada (solo declara el esquema en OpenAPI).
"""

from app import models
from tests.helpers import COACH_EMAIL, create_user


def test_checkin_por_q_ignora_homonimo_sin_membresia_activa(
    client, coach_user, auth_header, db_session
):
    create_user(
        db_session,
        email="ana.coach@example.com",
        first_name="Ana",
        last_name="Coach",
        role=models.UserRole.coach,
    )
    miembro = create_user(
        db_session,
        email="ana.miembro@example.com",
        first_name="Ana",
        last_name="Miembro",
        role=models.UserRole.member,
    )

    response = client.post(
        "/attendance/checkin",
        json={"q": "Ana"},
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 201, response.text
    assert response.json()["user_id"] == miembro.id


def test_checkin_por_q_sin_ningun_miembro_activo_responde_404(
    client, coach_user, auth_header, db_session
):
    create_user(
        db_session,
        email="beto.coach@example.com",
        first_name="Beto",
        last_name="Coach",
        role=models.UserRole.coach,
    )

    response = client.post(
        "/attendance/checkin",
        json={"q": "Beto"},
        headers=auth_header(COACH_EMAIL),
    )

    assert response.status_code == 404


def test_list_attendance_sin_token_responde_401(client):
    response = client.get("/attendance/")

    assert response.status_code == 401


def test_list_attendance_con_miembro_responde_403(client, client_user):
    response = client.get(
        "/attendance/", headers={"Authorization": f"Bearer {client_user['token']}"}
    )

    assert response.status_code == 403


def test_coach_lista_el_historial_de_asistencias(
    client, coach_user, auth_header, db_session
):
    headers = auth_header(COACH_EMAIL)
    miembro = create_user(
        db_session,
        email="miembro.asistencias@example.com",
        first_name="Miembro",
        last_name="Asistencias",
        role=models.UserRole.member,
    )

    checkin_response = client.post(
        "/attendance/checkin",
        json={"user_id": miembro.id},
        headers=headers,
    )
    assert checkin_response.status_code == 201, checkin_response.text

    response = client.get("/attendance/", headers=headers)

    assert response.status_code == 200, response.text
    assert any(item["user_id"] == miembro.id for item in response.json())
