"""Tests de `backend/app/routers/routine_assignments.py` (capability `routine-assignment`),
router `router` (`/routines/users/{user_id}/templates`, Dueño/Coach).
"""

from app import models
from tests.helpers import OWNER_EMAIL, assign_plan_to_member, create_user


def _create_template(client, headers, *, name="Fuerza 4 días"):
    response = client.post(
        "/routines/templates",
        json={"name": name, "tag": ""},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _save_days(client, headers, template_id, days):
    response = client.put(f"/routines/templates/{template_id}/days", json={"days": days}, headers=headers)
    assert response.status_code == 200, response.text
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
    template_a = _create_template(client, headers, name="Fuerza 4 días")
    template_b = _create_template(client, headers, name="Full body inicial")

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
    template_a = _create_template(client, headers, name="Fuerza 4 días")
    template_b = _create_template(client, headers, name="Hipertrofia 3 días")

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
    assign_plan_to_member(db_session, member)
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


def test_ajustar_la_base_registra_autor_y_fecha(client, owner_user, auth_header, db_session, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(client, headers, template["id"], [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}])
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


def test_quitar_el_ajuste_de_base_vuelve_a_la_base_propia_del_par(client, owner_user, auth_header, db_session, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(client, headers, template["id"], [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}])
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
    template_a = _create_template(client, headers, name="Fuerza 4 días")
    template_b = _create_template(client, headers, name="Full body inicial")
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
    template_a = _create_template(client, headers, name="Fuerza 4 días")
    template_b = _create_template(client, headers, name="Full body inicial")
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


# --- Precedencia del ajuste por cliente sobre la base propia (design D4) ----


def test_el_ajuste_de_base_por_cliente_pisa_la_base_propia_de_la_plantilla(
    client, owner_user, auth_header, db_session, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [
            {"exercise_id": "chest-bench-press", "base": {"sets": 4, "reps": 8, "weight_kg": 45}}
        ]}],
    )
    assignment = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    ).json()

    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        json={"sets": 5, "reps": 5, "weight_kg": 90},
        headers=headers,
    )

    member_headers = auth_header(member.email)
    detail = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers).json()
    exercise = next(item for item in detail["days"][0]["exercises"] if item["exercise_id"] == "chest-bench-press")
    assert exercise["base"] == {"sets": 5, "reps": 5, "weight_kg": 90}


def test_quitar_de_la_plantilla_un_ejercicio_con_ajuste_conserva_la_asignacion_y_el_historico(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """`_validate_exercise_in_template` sigue permitiendo el ajuste al momento
    de crearlo; una vez quitado el ejercicio del día, el ajuste **queda** (no
    hay FK que lo borre, design D4) pero deja de tener efecto porque ya no hay
    ningún `routine_template_day_exercises` que lo consuma — la asignación y
    el histórico de logs se conservan intactos."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    created = _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    day_id = created["days"][0]["day_id"]
    assignment = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    ).json()
    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        json={"sets": 5, "reps": 5, "weight_kg": 90},
        headers=headers,
    )
    log_response = client.post(
        f"/routines/users/{member.id}/logs",
        json={"day_id": day_id, "exercise_id": "chest-bench-press", "sets_count": 3, "reps": 10, "weight_kg": 40},
        headers=headers,
    )
    assert log_response.status_code == 201, log_response.text

    # Quitar el ejercicio del día.
    _save_days(client, headers, template["id"], [{"day_id": day_id, "muscle_groups": [], "exercises": []}])

    # La asignación sigue existiendo, con el ajuste todavía registrado...
    listing = client.get(f"/routines/users/{member.id}/templates", headers=headers).json()
    assert len(listing) == 1
    assert listing[0]["adjustments_count"] == 1

    # ...y el histórico de logs sigue consultable.
    logs = client.get(f"/routines/users/{member.id}/logs", headers=headers).json()
    assert len(logs) == 1
    assert logs[0]["exercise_id"] == "chest-bench-press"


def test_ajustar_la_base_de_un_ejercicio_que_no_esta_en_la_plantilla_es_400(
    client, owner_user, auth_header, db_session, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = client.post(
        f"/routines/users/{member.id}/templates",
        json={"template_id": template["id"], "status": "active"},
        headers=headers,
    ).json()

    response = client.put(
        # "legs-back-squat" existe en el catálogo pero no está en ningún día de esta plantilla.
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/legs-back-squat",
        json={"sets": 4, "reps": 6, "weight_kg": 50},
        headers=headers,
    )

    assert response.status_code == 400, response.text
