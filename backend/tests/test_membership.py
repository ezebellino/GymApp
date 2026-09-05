"""Tests del indicador de 3 estados (`payment-status-indicator`) y del bloqueo de
login por baja de membresía scopeado por rol (`user-management`).

Las dos reglas viven en módulos separados a propósito (design.md, decisión 4):
`utils.membership_indicator` (color, ignora el rol) y
`auth.is_membership_blocking_login` (acceso, ignora los pagos). Estos tests
verifican tanto cada regla por separado como que **no** se acoplen entre sí.
"""

from datetime import datetime, timedelta

from app import models
from app.utils import current_period
from tests.helpers import OWNER_EMAIL, PASSWORD, create_user, login


def _create_member(db_session, email="miembro@example.com", **kwargs):
    return create_user(
        db_session, email=email, first_name="Mi", last_name="Embro", role=models.UserRole.member, **kwargs
    )


def _add_payment(client, headers, user_id, month, year):
    response = client.post(
        "/payments/",
        json={
            "user_id": user_id,
            "amount": 1000,
            "method": "cash",
            "period_month": month,
            "period_year": year,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response


# --- Indicador de 3 estados --------------------------------------------------


def test_membresia_activa_sin_pagos_es_overdue(client, owner_user, auth_header, db_session):
    member = _create_member(db_session)

    response = client.get(f"/users/{member.id}", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text
    assert response.json()["membership_indicator"] == "overdue"


def test_ultimo_pago_del_periodo_actual_es_up_to_date(client, owner_user, auth_header, db_session):
    member = _create_member(db_session)
    cur_month, cur_year = current_period()
    _add_payment(client, auth_header(OWNER_EMAIL), member.id, cur_month, cur_year)

    response = client.get(f"/users/{member.id}", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text
    assert response.json()["membership_indicator"] == "up_to_date"


def test_ultimo_pago_de_un_periodo_anterior_es_overdue(client, owner_user, auth_header, db_session):
    member = _create_member(db_session)
    cur_month, cur_year = current_period()
    prev_month = 12 if cur_month == 1 else cur_month - 1
    prev_year = cur_year - 1 if cur_month == 1 else cur_year
    _add_payment(client, auth_header(OWNER_EMAIL), member.id, prev_month, prev_year)

    response = client.get(f"/users/{member.id}", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text
    assert response.json()["membership_indicator"] == "overdue"


def test_membresia_dada_de_baja_es_suspended_aunque_este_al_dia(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session)
    cur_month, cur_year = current_period()
    _add_payment(client, auth_header(OWNER_EMAIL), member.id, cur_month, cur_year)

    cancel = client.post(
        f"/users/{member.id}/membership/cancel", json={}, headers=auth_header(OWNER_EMAIL)
    )
    assert cancel.status_code == 200, cancel.text

    response = client.get(f"/users/{member.id}", headers=auth_header(OWNER_EMAIL))
    assert response.json()["membership_indicator"] == "suspended"


def test_usuario_que_nunca_fue_miembro_no_muestra_indicador(
    client, owner_user, coach_user, auth_header
):
    response = client.get(f"/users/{coach_user.id}", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text
    assert response.json()["membership_indicator"] == "none"


def test_un_pago_nuevo_actualiza_el_indicador_sin_cache(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session)
    headers = auth_header(OWNER_EMAIL)

    before = client.get(f"/users/{member.id}", headers=headers)
    assert before.json()["membership_indicator"] == "overdue"

    cur_month, cur_year = current_period()
    _add_payment(client, headers, member.id, cur_month, cur_year)

    after = client.get(f"/users/{member.id}", headers=headers)
    assert after.json()["membership_indicator"] == "up_to_date"


def test_reactivar_membresia_deja_de_estar_suspended(client, owner_user, auth_header, db_session):
    member = _create_member(db_session)
    headers = auth_header(OWNER_EMAIL)
    cur_month, cur_year = current_period()
    _add_payment(client, headers, member.id, cur_month, cur_year)
    client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)

    reactivate = client.post(f"/users/{member.id}/membership/activate", headers=headers)
    assert reactivate.status_code == 200, reactivate.text

    response = client.get(f"/users/{member.id}", headers=headers)
    assert response.json()["membership_indicator"] == "up_to_date"


# --- Bloqueo de login por baja de membresia, scopeado por rol ---------------


def test_baja_de_un_miembro_bloquea_su_login(client, owner_user, auth_header, db_session):
    member = _create_member(db_session, email="bloqueado@example.com")
    headers = auth_header(OWNER_EMAIL)

    cancel = client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)
    assert cancel.status_code == 200, cancel.text

    login_response = client.post(
        "/auth/token", data={"username": "bloqueado@example.com", "password": PASSWORD}
    )
    assert login_response.status_code == 400
    assert "access_token" not in login_response.json()


def test_reactivar_un_miembro_restaura_su_login(client, owner_user, auth_header, db_session):
    member = _create_member(db_session, email="reactivado@example.com")
    headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)
    client.post(f"/users/{member.id}/membership/activate", headers=headers)

    login_response = client.post(
        "/auth/token", data={"username": "reactivado@example.com", "password": PASSWORD}
    )
    assert login_response.status_code == 200, login_response.text


def test_baja_de_membresia_de_un_coach_no_bloquea_su_login(client, owner_user, db_session):
    # El Coach entra siendo owner quien lo da de baja, y verificamos que el propio
    # coach (marcado como miembro) sigue pudiendo loguearse.
    coach = create_user(
        db_session,
        email="coach.miembro@example.com",
        first_name="Coach",
        last_name="Miembro",
        role=models.UserRole.coach,
        membership_status=models.MembershipStatus.active,
    )
    owner_headers = login(client, OWNER_EMAIL, PASSWORD)
    cancel = client.post(
        f"/users/{coach.id}/membership/cancel", json={}, headers=owner_headers
    )
    assert cancel.status_code == 200, cancel.text

    login_response = client.post(
        "/auth/token",
        data={"username": "coach.miembro@example.com", "password": PASSWORD},
    )
    assert login_response.status_code == 200, login_response.text


def test_historial_sigue_existiendo_tras_la_baja(client, owner_user, auth_header, db_session):
    member = _create_member(db_session, email="con-historial@example.com")
    headers = auth_header(OWNER_EMAIL)
    cur_month, cur_year = current_period()
    _add_payment(client, headers, member.id, cur_month, cur_year)

    client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)

    payments = client.get(f"/payments/?user_id={member.id}", headers=headers)
    assert payments.status_code == 200, payments.text
    assert len(payments.json()) == 1


def test_no_se_puede_registrar_pago_de_un_miembro_dado_de_baja(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session, email="sin-pago@example.com")
    headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)

    cur_month, cur_year = current_period()
    response = client.post(
        "/payments/",
        json={
            "user_id": member.id,
            "amount": 1000,
            "method": "cash",
            "period_month": cur_month,
            "period_year": cur_year,
        },
        headers=headers,
    )
    assert response.status_code == 400


# --- El desacople: color rojo != bloqueo de acceso --------------------------


def test_coach_miembro_dado_de_baja_es_suspended_y_puede_loguearse(
    client, owner_user, auth_header, db_session
):
    coach = create_user(
        db_session,
        email="coach.desacoplado@example.com",
        first_name="Coach",
        last_name="Desacoplado",
        role=models.UserRole.coach,
        membership_status=models.MembershipStatus.active,
    )
    headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{coach.id}/membership/cancel", json={}, headers=headers)

    detail = client.get(f"/users/{coach.id}", headers=headers)
    assert detail.json()["membership_indicator"] == "suspended"

    login_response = client.post(
        "/auth/token",
        data={"username": "coach.desacoplado@example.com", "password": PASSWORD},
    )
    assert login_response.status_code == 200, login_response.text


# --- Enforcement en sesion abierta (get_current_user, no solo /auth/token) ---


def test_sesion_abierta_se_corta_con_401_al_dar_de_baja(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session, email="sesion-viva@example.com")
    member_headers = login(client, "sesion-viva@example.com", PASSWORD)

    still_ok = client.get("/auth/me", headers=member_headers)
    assert still_ok.status_code == 200

    owner_headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{member.id}/membership/cancel", json={}, headers=owner_headers)

    blocked = client.get("/auth/me", headers=member_headers)
    assert blocked.status_code == 401


# --- Fecha de baja -----------------------------------------------------------


def test_baja_sin_body_usa_la_fecha_actual(client, owner_user, auth_header, db_session):
    member = _create_member(db_session, email="baja-sin-fecha@example.com")
    headers = auth_header(OWNER_EMAIL)
    before = datetime.utcnow()

    response = client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)

    assert response.status_code == 200, response.text
    cancelled_at = datetime.fromisoformat(response.json()["membership_cancelled_at"])
    assert cancelled_at >= before - timedelta(seconds=5)


def test_baja_con_fecha_retroactiva_guarda_esa_fecha(client, owner_user, auth_header, db_session):
    member = _create_member(db_session, email="baja-retroactiva@example.com")
    headers = auth_header(OWNER_EMAIL)
    retro = "2026-01-15T00:00:00"

    response = client.post(
        f"/users/{member.id}/membership/cancel",
        json={"cancelled_at": retro},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["membership_cancelled_at"].startswith("2026-01-15")


def test_reactivacion_vuelve_a_dejar_la_fecha_de_baja_en_null(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session, email="reactivacion-null@example.com")
    headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)

    response = client.post(f"/users/{member.id}/membership/activate", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["membership_cancelled_at"] is None
