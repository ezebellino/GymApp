"""Check-in por búsqueda de texto (`POST /attendance/checkin` con `q`).

Cubre el hallazgo N4 de `verification.md` de `unify-clients-into-users`: antes de acotar
la búsqueda a membresía activa, un Dueño/Coach homónimo sin membresía podía ganarle el
match a un Miembro real y el 400 resultante ("no tiene una membresía activa") confundía
en vez de resolver al miembro que sí quería hacer check-in.
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
