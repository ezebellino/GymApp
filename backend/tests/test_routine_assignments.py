"""Tests de `backend/app/routers/routine_assignments.py` (capability `routine-assignment`),
router `router` (`/routines/users/{user_id}/templates`, Dueño/Coach).
"""

from app import models
from tests.helpers import OWNER_EMAIL, create_user


def _create_template(client, headers, *, name="Fuerza 4 días", day_ids=None):
    response = client.post(
        "/routines/templates",
        json={"name": name, "tag": "", "day_ids": day_ids or ["day-1"]},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_member(db_session, email="miembro-rutinas@example.com", membership_status=None):
    return create_user(
        db_session,
        email=email,
        first_name="Miembro",
        role=models.UserRole.member,
        membership_status=membership_status,
    )


def test_asignar_la_primera_plantilla_como_activa(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)

    response = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "active"
    assert body["template_id"] == template["id"]

    listing = client.get(f"/routines/users/{member.id}/templates", headers=headers)
    assert len(listing.json()) == 1
    assert listing.json()[0]["status"] == "active"


def test_asignar_una_segunda_plantilla_como_alternativa(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template_a = _create_template(client, headers, name="Fuerza 4 días", day_ids=["day-1"])
    template_b = _create_template(client, headers, name="Full body inicial", day_ids=["day-2"])

    client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_a["id"], "status": "active"},
        headers=headers,
    )
    response = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_b["id"], "status": "alternative"},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert response.json()["status"] == "alternative"

    listing = {item["template_id"]: item["status"] for item in client.get(
        f"/routines/users/{member.id}/templates", headers=headers
    ).json()}
    assert listing[template_a["id"]] == "active"
    assert listing[template_b["id"]] == "alternative"


def test_asignar_una_nueva_activa_deja_la_anterior_como_alternativa(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template_a = _create_template(client, headers, name="Fuerza 4 días", day_ids=["day-1"])
    template_b = _create_template(client, headers, name="Hipertrofia 3 días", day_ids=["day-2"])

    client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_a["id"], "status": "active"},
        headers=headers,
    )
    client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_b["id"], "status": "active"},
        headers=headers,
    )

    listing = {item["template_id"]: item["status"] for item in client.get(
        f"/routines/users/{member.id}/templates", headers=headers
    ).json()}
    assert listing[template_b["id"]] == "active"
    assert listing[template_a["id"]] == "alternative"


def test_asignar_a_un_miembro_dado_de_baja_responde_409(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session, membership_status=models.MembershipStatus.cancelled)
    template = _create_template(client, headers)

    response = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    )

    assert response.status_code == 409, response.text


def test_asignar_a_un_miembro_sin_membresia_responde_409(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session, membership_status=models.MembershipStatus.none)
    template = _create_template(client, headers)

    response = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    )

    assert response.status_code == 409, response.text


def test_reactivar_la_membresia_habilita_la_asignacion(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session, membership_status=models.MembershipStatus.cancelled)
    template = _create_template(client, headers)

    client.post(f"/users/{member.id}/membership/activate", headers=headers)

    response = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    )

    assert response.status_code == 201, response.text


def test_dar_de_baja_la_membresia_conserva_las_asignaciones(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    )

    cancel_response = client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)
    assert cancel_response.status_code == 200, cancel_response.text

    listing = client.get(f"/routines/users/{member.id}/templates", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["status"] == "active"


def test_no_se_puede_asignar_una_plantilla_a_un_coach(client, owner_user, coach_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = client.post(
        f"/routines/users/{coach_user.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    )

    assert response.status_code == 409, response.text


def test_ajustar_la_base_registra_autor_y_fecha(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers, day_ids=["day-1"])
    assignment = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    ).json()

    response = client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        json={"sets": 4, "reps": 6, "weight_kg": 50},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["adjustments_count"] == 1
    assert body["last_adjustment"] is not None
    assert body["last_adjustment"]["by_name"] == owner_user.full_name


def test_una_asignacion_sin_ajustes_se_reporta_sin_ajustes(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)

    response = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    )

    body = response.json()
    assert body["adjustments_count"] == 0
    assert body["last_adjustment"] is None


def test_quitar_el_ajuste_de_base_vuelve_a_la_base_del_catalogo(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers, day_ids=["day-1"])
    assignment = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    ).json()
    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        json={"sets": 4, "reps": 6, "weight_kg": 50},
        headers=headers,
    )

    response = client.delete(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["adjustments_count"] == 0
    assert body["last_adjustment"] is None


def test_quitar_una_asignacion_alternativa(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template_a = _create_template(client, headers, name="Fuerza 4 días", day_ids=["day-1"])
    template_b = _create_template(client, headers, name="Full body inicial", day_ids=["day-2"])
    client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_a["id"], "status": "active"},
        headers=headers,
    )
    alternative = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_b["id"], "status": "alternative"},
        headers=headers,
    ).json()

    response = client.delete(
        f"/routines/users/{member.id}/templates/{alternative['id']}", headers=headers
    )
    assert response.status_code == 204, response.text

    listing = client.get(f"/routines/users/{member.id}/templates", headers=headers).json()
    assert len(listing) == 1
    assert listing[0]["template_id"] == template_a["id"]
    assert listing[0]["status"] == "active"


def test_quitar_la_asignacion_activa_no_promueve_una_alternativa(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template_a = _create_template(client, headers, name="Fuerza 4 días", day_ids=["day-1"])
    template_b = _create_template(client, headers, name="Full body inicial", day_ids=["day-2"])
    active = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_a["id"], "status": "active"},
        headers=headers,
    ).json()
    client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template_b["id"], "status": "alternative"},
        headers=headers,
    )

    response = client.delete(
        f"/routines/users/{member.id}/templates/{active['id']}", headers=headers
    )
    assert response.status_code == 204, response.text

    listing = client.get(f"/routines/users/{member.id}/templates", headers=headers).json()
    assert len(listing) == 1
    assert listing[0]["template_id"] == template_b["id"]
    assert listing[0]["status"] == "alternative"
