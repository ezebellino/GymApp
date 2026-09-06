"""Tests de la vista del miembro (`routine_assignments.py`, `my_router`,
capability `member-routine-view`).
"""

from app import models
from app.auth import get_current_user
from app.main import app
from tests.helpers import OWNER_EMAIL, create_user


def _create_template(client, headers, *, name="Fuerza 4 días", day_ids=None):
    response = client.post(
        "/routines/templates",
        json={"name": name, "tag": "", "day_ids": day_ids or ["day-1"]},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_member(db_session, email="miembro-mi-rutina@example.com"):
    return create_user(
        db_session, email=email, first_name="Miembro", role=models.UserRole.member
    )


def _assign(client, headers, user_id, template_id, status="active"):
    response = client.post(
        f"/routines/users/{user_id}/templates",
        json={"template_id": template_id, "status": status},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_el_miembro_solo_ve_sus_plantillas_asignadas(client, owner_user, auth_header, db_session):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    other_member = _create_member(db_session, email="otro-miembro@example.com")
    template = _create_template(client, owner_headers)

    _assign(client, owner_headers, member.id, template["id"])
    _assign(client, owner_headers, other_member.id, template["id"])

    member_headers = auth_header(member.email)
    response = client.get("/routines/my/templates", headers=member_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["template_id"] == template["id"]


def test_el_miembro_sin_asignaciones_recibe_una_lista_vacia(client, db_session, auth_header):
    member = _create_member(db_session)
    member_headers = auth_header(member.email)

    response = client.get("/routines/my/templates", headers=member_headers)

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_un_miembro_no_puede_ver_la_asignacion_de_otro(client, owner_user, auth_header, db_session):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    other_member = _create_member(db_session, email="otro-miembro-2@example.com")
    template = _create_template(client, owner_headers)
    assignment = _assign(client, owner_headers, member.id, template["id"])

    other_headers = auth_header(other_member.email)
    response = client.get(f"/routines/my/templates/{assignment['id']}", headers=other_headers)

    # 404, no 403: pedir la asignación de otro Miembro no filtra existencia
    # (invariante I7).
    assert response.status_code == 404, response.text


def test_el_miembro_dado_de_baja_sigue_viendo_sus_plantillas(client, owner_user, auth_header, db_session):
    """`is_membership_blocking_login` (`app/auth.py`, fuera de alcance de este
    change — invariante I5) bloquea con 401 cualquier request de un rol Miembro
    con membresía dada de baja, incluso con un token ya emitido — así que no se
    puede probar este invariante logueándose de nuevo por HTTP. Se verifica lo
    que sí es de este change (el endpoint no filtra por `membership_status`,
    invariante I13) con un override de `get_current_user` apuntando directo al
    Miembro ya dado de baja, igual que `conftest.py` overridea `get_db`."""
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    _assign(client, owner_headers, member.id, template["id"])

    cancel_response = client.post(f"/users/{member.id}/membership/cancel", json={}, headers=owner_headers)
    assert cancel_response.status_code == 200, cancel_response.text
    db_session.refresh(member)
    assert member.membership_status == models.MembershipStatus.cancelled

    app.dependency_overrides[get_current_user] = lambda: member
    try:
        response = client.get("/routines/my/templates")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "active"


def test_el_detalle_del_miembro_solo_trae_los_dias_de_la_plantilla(client, owner_user, auth_header, db_session):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers, day_ids=["day-1", "day-4"])
    assignment = _assign(client, owner_headers, member.id, template["id"])

    member_headers = auth_header(member.email)
    response = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers)

    assert response.status_code == 200, response.text
    day_ids = [day["day_id"] for day in response.json()["days"]]
    assert day_ids == ["day-1", "day-4"]


def test_un_ejercicio_desactivado_no_aparece_en_el_plan_del_miembro(client, owner_user, auth_header, db_session):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers, day_ids=["day-1"])
    assignment = _assign(client, owner_headers, member.id, template["id"])

    client.put(
        f"/routines/templates/{template['id']}/days/day-1/exercises/chest-bench-press",
        json={"is_active": False},
        headers=owner_headers,
    )

    member_headers = auth_header(member.email)
    response = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers)

    exercise_ids = [item["exercise_id"] for item in response.json()["days"][0]["exercises"]]
    assert "chest-bench-press" not in exercise_ids


def test_el_plan_del_miembro_usa_la_base_ajustada_para_ese_cliente(client, owner_user, auth_header, db_session):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers, day_ids=["day-1"])
    assignment = _assign(client, owner_headers, member.id, template["id"])

    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        json={"sets": 4, "reps": 6, "weight_kg": 50},
        headers=owner_headers,
    )

    member_headers = auth_header(member.email)
    response = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers)

    exercise = next(
        item for item in response.json()["days"][0]["exercises"] if item["exercise_id"] == "chest-bench-press"
    )
    assert exercise["base"] == {"sets": 4, "reps": 6, "weight_kg": 50}
    assert [(item["weight_kg"], item["reps"]) for item in exercise["planned_sets"]] == [(50, 6)] * 4


def test_cambiar_la_estrategia_se_refleja_en_el_plan_del_miembro(client, owner_user, auth_header, db_session):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers, day_ids=["day-1"])
    assignment = _assign(client, owner_headers, member.id, template["id"])

    client.put(
        f"/routines/templates/{template['id']}/days/day-1/exercises/chest-bench-press",
        json={"strategy": "rest_pause"},
        headers=owner_headers,
    )

    member_headers = auth_header(member.email)
    response = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers)

    exercise = next(
        item for item in response.json()["days"][0]["exercises"] if item["exercise_id"] == "chest-bench-press"
    )
    assert exercise["strategy"] == "rest_pause"
    # Base seedeada de chest-bench-press (routine_catalog.py): 4x8 · 45 kg.
    assert [item["reps"] for item in exercise["planned_sets"]] == [8, 7, 6, 5]
