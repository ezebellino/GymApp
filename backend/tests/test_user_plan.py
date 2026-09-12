"""Tests del plan de membresía del usuario (`membership-plans`, `user-management`):
alta de un Miembro exige plan, activar membresía exige plan, cambio de plan desde
`POST /users/{id}/plan` (registra autor y fecha, no toca pagos ya registrados) y
asignación a un miembro preexistente sin plan (D3).
"""

from datetime import datetime

from app import models
from tests.helpers import CLIENT_EMAIL, OWNER_EMAIL, create_plan, create_user


def _member_payload(**overrides):
    payload = {
        "first_name": "Nuevo",
        "last_name": "Miembro",
        "role": "member",
    }
    payload.update(overrides)
    return payload


def test_alta_de_miembro_sin_plan_devuelve_400(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)

    response = client.post("/users/", json=_member_payload(), headers=headers)

    assert response.status_code == 400, response.text
    assert db_session.query(models.User).filter(models.User.role == models.UserRole.member).count() == 0


def test_alta_de_miembro_con_plan_inactivo_devuelve_400(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    activo = create_plan(client, headers, name="Activo")
    inactivo = create_plan(client, headers, name="Inactivo")
    client.post(f"/membership-plans/{inactivo['id']}/deactivate", headers=headers)

    response = client.post(
        "/users/",
        json=_member_payload(membership_plan_id=inactivo["id"]),
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert db_session.query(models.User).filter(models.User.role == models.UserRole.member).count() == 0
    # el plan activo sigue disponible: la fixture no queda pisada por el intento
    assert activo["is_active"] is True


def test_alta_de_miembro_con_plan_activo_queda_asignado(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")

    response = client.post(
        "/users/",
        json=_member_payload(membership_plan_id=plan["id"]),
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["membership_plan"]["id"] == plan["id"]
    assert body["plan_since"] is not None


def test_activar_membresia_sin_plan_devuelve_400(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = create_user(
        db_session,
        email="sin-plan@example.com",
        first_name="Sin",
        last_name="Plan",
        role=models.UserRole.member,
        membership_status=models.MembershipStatus.cancelled,
    )

    response = client.post(f"/users/{member.id}/membership/activate", headers=headers)

    assert response.status_code == 400, response.text
    db_session.refresh(member)
    assert member.membership_status == models.MembershipStatus.cancelled


def test_cambiar_plan_registra_plan_since_y_autor(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan_a = create_plan(client, headers, name="Plan A")
    plan_b = create_plan(client, headers, name="Plan B")
    member = create_user(
        db_session,
        email="con-plan@example.com",
        first_name="Con",
        last_name="Plan",
        role=models.UserRole.member,
    )
    member.membership_plan_id = plan_a["id"]
    db_session.commit()

    response = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": plan_b["id"]},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["membership_plan"]["id"] == plan_b["id"]
    assert body["plan_since"] is not None

    db_session.refresh(member)
    assert member.membership_plan_id == plan_b["id"]
    assert member.plan_changed_by_user_id == owner_user.id


def test_cambiar_plan_no_modifica_los_pagos_existentes(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan_a = create_plan(client, headers, name="Plan A", amount=10000)
    plan_b = create_plan(client, headers, name="Plan B", amount=20000)
    member = create_user(
        db_session,
        email="con-pago@example.com",
        first_name="Con",
        last_name="Pago",
        role=models.UserRole.member,
    )
    member.membership_plan_id = plan_a["id"]
    db_session.commit()

    payment = client.post(
        "/payments/",
        json={
            "user_id": member.id,
            "amount": 10000,
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert payment.status_code == 201, payment.text
    payment_id = payment.json()["id"]

    response = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": plan_b["id"]},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    unchanged = client.get(f"/payments/{payment_id}", headers=headers)
    assert unchanged.status_code == 200, unchanged.text
    assert unchanged.json()["amount"] == 10000


def test_asignar_plan_a_miembro_preexistente_sin_plan_devuelve_200(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    member = create_user(
        db_session,
        email="preexistente@example.com",
        first_name="Preexistente",
        last_name="Sin Plan",
        role=models.UserRole.member,
    )
    assert member.membership_plan_id is None

    response = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": plan["id"]},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["membership_plan"]["id"] == plan["id"]
    assert body["plan_since"] is not None


def test_listado_de_usuarios_expone_el_plan_vigente_y_null_si_no_tiene(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General", amount=12000)
    con_plan = create_user(
        db_session,
        email="con-plan-listado@example.com",
        first_name="Con",
        last_name="Plan",
        role=models.UserRole.member,
    )
    con_plan.membership_plan_id = plan["id"]
    db_session.commit()
    create_user(
        db_session,
        email="sin-plan-listado@example.com",
        first_name="Sin",
        last_name="Plan",
        role=models.UserRole.member,
    )

    response = client.get("/users/", headers=headers)

    assert response.status_code == 200, response.text
    by_email = {user["email"]: user for user in response.json()}
    assert by_email["con-plan-listado@example.com"]["membership_plan"]["id"] == plan["id"]
    assert by_email["con-plan-listado@example.com"]["membership_plan"]["current_amount"] == 12000
    assert by_email["sin-plan-listado@example.com"]["membership_plan"] is None


def test_asignar_plan_a_miembro_dado_de_baja_devuelve_200(client, owner_user, auth_header, db_session):
    """D2.1: `change_user_plan` ya no exige membresía activa; un miembro `cancelled` puede
    recibir plan igual que uno `active`."""
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    member = create_user(
        db_session,
        email="dado-de-baja@example.com",
        first_name="Dado",
        last_name="De Baja",
        role=models.UserRole.member,
        membership_status=models.MembershipStatus.cancelled,
    )
    assert member.membership_plan_id is None

    response = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": plan["id"]},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["membership_plan"]["id"] == plan["id"]
    assert body["plan_since"] is not None


def test_asignar_plan_no_cambia_el_estado_de_membresia(client, owner_user, auth_header, db_session):
    """I11: asignar/cambiar plan no toca `membership_status` ni `membership_cancelled_at`."""
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    cancelled_at = datetime.utcnow().replace(microsecond=0)
    member = create_user(
        db_session,
        email="baja-con-fecha@example.com",
        first_name="Baja",
        last_name="Con Fecha",
        role=models.UserRole.member,
        membership_status=models.MembershipStatus.cancelled,
    )
    member.membership_cancelled_at = cancelled_at
    db_session.commit()

    response = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": plan["id"]},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    db_session.refresh(member)
    assert member.membership_status == models.MembershipStatus.cancelled
    assert member.membership_cancelled_at == cancelled_at


def test_asignar_plan_a_usuario_que_nunca_fue_miembro_devuelve_400(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    coach = create_user(
        db_session,
        email="coach-sin-perfil@example.com",
        first_name="Coach",
        last_name="Sin Perfil",
        role=models.UserRole.coach,
    )
    assert coach.membership_status == models.MembershipStatus.none

    response = client.post(
        f"/users/{coach.id}/plan",
        json={"membership_plan_id": plan["id"]},
        headers=headers,
    )

    assert response.status_code == 400, response.text
    db_session.refresh(coach)
    assert coach.membership_plan_id is None


def test_miembro_dado_de_baja_sin_plan_puede_recibir_plan_y_reactivarse(client, owner_user, auth_header, db_session):
    """I10: cierra el ciclo del bloqueo mutuo — asignar plan y después activar la membresía."""
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    member = create_user(
        db_session,
        email="atrapado@example.com",
        first_name="Atrapado",
        last_name="Sin Salida",
        role=models.UserRole.member,
        membership_status=models.MembershipStatus.cancelled,
    )
    assert member.membership_plan_id is None

    plan_response = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": plan["id"]},
        headers=headers,
    )
    assert plan_response.status_code == 200, plan_response.text

    activate_response = client.post(f"/users/{member.id}/membership/activate", headers=headers)
    assert activate_response.status_code == 200, activate_response.text
    assert activate_response.json()["membership_status"] == "active"


def test_cambiar_plan_sin_sesion_devuelve_401_y_con_rol_member_403(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    member = create_user(
        db_session,
        email="objetivo-cambio@example.com",
        first_name="Objetivo",
        last_name="Cambio",
        role=models.UserRole.member,
    )
    create_user(
        db_session,
        email=CLIENT_EMAIL,
        first_name="Cliente",
        last_name="de Test",
        role=models.UserRole.member,
    )
    member_headers = auth_header(CLIENT_EMAIL)

    no_token = client.post(f"/users/{member.id}/plan", json={"membership_plan_id": plan["id"]})
    assert no_token.status_code == 401, no_token.text

    as_member = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": plan["id"]},
        headers=member_headers,
    )
    assert as_member.status_code == 403, as_member.text

    db_session.refresh(member)
    assert member.membership_plan_id is None


def test_activar_membresia_de_quien_nunca_fue_miembro_con_plan_devuelve_200(
    client, owner_user, auth_header, db_session
):
    """D2.2: bloqueante de la segunda pasada de verificación — un usuario con
    `membership_status = 'none'` (nunca fue miembro) se activa mandando el plan
    en el mismo `POST /membership/activate`. Falla con el bug presente: antes
    de D2.2 este endpoint no aceptaba `membership_plan_id` y devolvía 400."""
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    coach = create_user(
        db_session,
        email="coach-nunca-miembro@example.com",
        first_name="Coach",
        last_name="Nunca Miembro",
        role=models.UserRole.coach,
    )
    assert coach.membership_status == models.MembershipStatus.none
    assert coach.membership_plan_id is None

    response = client.post(
        f"/users/{coach.id}/membership/activate",
        json={"membership_plan_id": plan["id"]},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["membership_status"] == "active"
    assert body["membership_plan"]["id"] == plan["id"]
    assert body["plan_since"] is not None


def test_activar_membresia_de_quien_nunca_fue_miembro_sin_plan_devuelve_400(
    client, owner_user, auth_header, db_session
):
    headers = auth_header(OWNER_EMAIL)
    coach = create_user(
        db_session,
        email="coach-sin-plan-activar@example.com",
        first_name="Coach",
        last_name="Sin Plan",
        role=models.UserRole.coach,
    )

    response = client.post(f"/users/{coach.id}/membership/activate", headers=headers)

    assert response.status_code == 400, response.text
    db_session.refresh(coach)
    assert coach.membership_status == models.MembershipStatus.none
    assert coach.membership_plan_id is None


def test_activar_membresia_con_plan_distinto_del_asignado_devuelve_400(
    client, owner_user, auth_header, db_session
):
    headers = auth_header(OWNER_EMAIL)
    plan_a = create_plan(client, headers, name="Plan A")
    plan_b = create_plan(client, headers, name="Plan B")
    member = create_user(
        db_session,
        email="con-plan-activar@example.com",
        first_name="Con",
        last_name="Plan",
        role=models.UserRole.member,
        membership_status=models.MembershipStatus.cancelled,
    )
    member.membership_plan_id = plan_a["id"]
    db_session.commit()

    response = client.post(
        f"/users/{member.id}/membership/activate",
        json={"membership_plan_id": plan_b["id"]},
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert "Cambiar plan" in response.json()["detail"]
    db_session.refresh(member)
    assert member.membership_plan_id == plan_a["id"]
    assert member.membership_status == models.MembershipStatus.cancelled


def test_activar_membresia_con_plan_escribe_plan_since_y_autor(
    client, owner_user, auth_header, db_session
):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")
    coach = create_user(
        db_session,
        email="coach-plan-since@example.com",
        first_name="Coach",
        last_name="Plan Since",
        role=models.UserRole.coach,
    )

    response = client.post(
        f"/users/{coach.id}/membership/activate",
        json={"membership_plan_id": plan["id"]},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    db_session.refresh(coach)
    assert coach.membership_plan_id == plan["id"]
    assert coach.plan_since is not None
    assert coach.plan_changed_by_user_id == owner_user.id


def test_activar_membresia_con_plan_inexistente_no_activa_la_membresia(
    client, owner_user, auth_header, db_session
):
    """Atomicidad (D2.2): un `membership_plan_id` inexistente devuelve 404 y no
    deja ningún rastro — ni el plan, ni el estado de membresía cambian."""
    headers = auth_header(OWNER_EMAIL)
    coach = create_user(
        db_session,
        email="coach-plan-inexistente@example.com",
        first_name="Coach",
        last_name="Plan Inexistente",
        role=models.UserRole.coach,
    )

    response = client.post(
        f"/users/{coach.id}/membership/activate",
        json={"membership_plan_id": "no-existe"},
        headers=headers,
    )

    assert response.status_code == 404, response.text
    db_session.refresh(coach)
    assert coach.membership_status == models.MembershipStatus.none
    assert coach.membership_plan_id is None
    assert coach.plan_since is None
