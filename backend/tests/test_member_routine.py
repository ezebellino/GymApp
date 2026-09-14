"""Tests de la vista del miembro (`routine_assignments.py::my_router` y los
endpoints de `routines.py` que resuelven overview/logs/progreso sobre la
asignación Activa; capability `member-routine-view`,
`template-owned-routine-days`).
"""

from app import models
from app.auth import get_current_user
from app.main import app
from tests.helpers import OWNER_EMAIL, create_user


def _create_template(client, headers, *, name="Fuerza 4 días"):
    response = client.post("/routines/templates", json={"name": name, "tag": ""}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _save_days(client, headers, template_id, days):
    response = client.put(f"/routines/templates/{template_id}/days", json={"days": days}, headers=headers)
    assert response.status_code == 200, response.text
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
    change) bloquea con 401 cualquier request de un rol Miembro con membresía
    dada de baja, incluso con un token ya emitido — así que no se puede probar
    este invariante logueándose de nuevo por HTTP. Se verifica lo que sí es de
    este change (el endpoint no filtra por `membership_status`) con un
    override de `get_current_user` apuntando directo al Miembro ya dado de
    baja, igual que `conftest.py` overridea `get_db`."""
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


# --- Plan del Miembro: exactamente los días/ejercicios de la plantilla ------
# (design D10, invariantes I7, I8)


def test_mi_rutina_muestra_solo_los_dias_y_ejercicios_de_la_plantilla_asignada(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    _save_days(
        client, owner_headers, template["id"],
        [
            {"day_id": None, "muscle_groups": ["Pecho"], "exercises": [{"exercise_id": "chest-bench-press"}]},
            {"day_id": None, "muscle_groups": ["Cuádriceps"], "exercises": [{"exercise_id": "legs-back-squat"}]},
        ],
    )
    assignment = _assign(client, owner_headers, member.id, template["id"])

    member_headers = auth_header(member.email)
    response = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers)

    assert response.status_code == 200, response.text
    days = response.json()["days"]
    assert len(days) == 2
    assert [item["exercise_id"] for item in days[0]["exercises"]] == ["chest-bench-press"]
    assert [item["exercise_id"] for item in days[1]["exercises"]] == ["legs-back-squat"]


def test_un_ejercicio_quitado_del_dia_desaparece_del_plan_pero_sus_logs_siguen_consultables(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    created = _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    day_id = created["days"][0]["day_id"]
    assignment = _assign(client, owner_headers, member.id, template["id"])

    log_response = client.post(
        f"/routines/users/{member.id}/logs",
        json={"day_id": day_id, "exercise_id": "chest-bench-press", "sets_count": 3, "reps": 10, "weight_kg": 40},
        headers=owner_headers,
    )
    assert log_response.status_code == 201, log_response.text

    # Quitar el ejercicio del día (sin quitar el día).
    _save_days(client, owner_headers, template["id"], [{"day_id": day_id, "muscle_groups": [], "exercises": []}])

    member_headers = auth_header(member.email)
    plan = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers).json()
    assert plan["days"][0]["exercises"] == []

    logs = client.get(f"/routines/users/{member.id}/logs", headers=owner_headers)
    assert logs.status_code == 200, logs.text
    assert len(logs.json()) == 1
    assert logs.json()[0]["exercise_id"] == "chest-bench-press"


def test_quitar_un_dia_deja_sus_logs_con_day_id_nulo_y_conserva_el_nombre_del_dia(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    created = _save_days(
        client, owner_headers, template["id"],
        [
            {"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]},
            {"day_id": None, "muscle_groups": [], "exercises": []},
        ],
    )
    day_one_id = created["days"][0]["day_id"]
    day_two_id = created["days"][1]["day_id"]
    _assign(client, owner_headers, member.id, template["id"])

    log_response = client.post(
        f"/routines/users/{member.id}/logs",
        json={"day_id": day_one_id, "exercise_id": "chest-bench-press", "sets_count": 3, "reps": 10, "weight_kg": 40},
        headers=owner_headers,
    )
    assert log_response.status_code == 201, log_response.text

    # Quitar el Día 1 (dejar solo el Día 2, que sobrevive con nueva posición).
    _save_days(client, owner_headers, template["id"], [{"day_id": day_two_id, "muscle_groups": [], "exercises": []}])

    logs = client.get(f"/routines/users/{member.id}/logs", headers=owner_headers).json()
    assert len(logs) == 1
    assert logs[0]["day_id"] is None
    assert logs[0]["day_name"] == "Día 1"


def test_un_cambio_del_coach_en_la_plantilla_se_ve_en_el_siguiente_request_del_miembro(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    created = _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    day_id = created["days"][0]["day_id"]
    assignment = _assign(client, owner_headers, member.id, template["id"])

    member_headers = auth_header(member.email)
    before = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers).json()
    assert [item["exercise_id"] for item in before["days"][0]["exercises"]] == ["chest-bench-press"]

    _save_days(
        client, owner_headers, template["id"],
        [{"day_id": day_id, "muscle_groups": [], "exercises": [{"exercise_id": "chest-cable-fly"}]}],
    )

    after = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers).json()
    assert [item["exercise_id"] for item in after["days"][0]["exercises"]] == ["chest-cable-fly"]


# --- Overview/progreso siguen la asignación Activa (design D10) -------------


def test_mis_dias_sin_asignacion_activa_devuelve_lista_vacia_con_200(client, db_session, auth_header):
    member = _create_member(db_session)
    member_headers = auth_header(member.email)

    response = client.get("/routines/my/days", headers=member_headers)

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_el_overview_del_miembro_cuenta_los_ejercicios_del_dia_de_su_plantilla(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": ["Pecho"], "exercises": [
            {"exercise_id": "chest-bench-press"}, {"exercise_id": "chest-cable-fly"}
        ]}],
    )
    _assign(client, owner_headers, member.id, template["id"])

    member_headers = auth_header(member.email)
    response = client.get("/routines/my/overview", headers=member_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["active_exercise_count"] == 2


def test_el_overview_sigue_la_asignacion_activa_aunque_haya_una_alternativa(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    active_template = _create_template(client, owner_headers, name="Activa")
    _save_days(
        client, owner_headers, active_template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    alternative_template = _create_template(client, owner_headers, name="Alternativa")
    _save_days(
        client, owner_headers, alternative_template["id"],
        [
            {"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "legs-back-squat"}]},
            {"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-cable-fly"}]},
        ],
    )
    _assign(client, owner_headers, member.id, active_template["id"], status="active")
    _assign(client, owner_headers, member.id, alternative_template["id"], status="alternative")

    member_headers = auth_header(member.email)
    response = client.get("/routines/my/overview", headers=member_headers)

    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    assert response.json()[0]["active_exercise_count"] == 1


def test_el_progress_summary_sin_asignacion_activa_lo_indica_en_vez_de_usar_la_alternativa(
    client, owner_user, auth_header, db_session
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    alternative_template = _create_template(client, owner_headers, name="Alternativa")
    _assign(client, owner_headers, member.id, alternative_template["id"], status="alternative")

    response = client.get(f"/routines/users/{member.id}/progress-summary", headers=owner_headers)

    assert response.status_code == 200, response.text
    assert response.json()["active_assignment"] is None


# --- Alta de log: pertenencia al día/plantilla asignada (design D10, I12) ---


def test_registrar_un_log_contra_un_dia_de_otra_plantilla_es_400(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    assigned_template = _create_template(client, owner_headers, name="Asignada")
    _assign(client, owner_headers, member.id, assigned_template["id"])

    other_template = _create_template(client, owner_headers, name="Otra, no asignada")
    other_day_id = other_template["days"][0]["day_id"]

    response = client.post(
        f"/routines/users/{member.id}/logs",
        json={"day_id": other_day_id, "exercise_id": "chest-bench-press", "sets_count": 3, "reps": 10, "weight_kg": 40},
        headers=owner_headers,
    )

    assert response.status_code == 400, response.text


def test_registrar_un_log_contra_un_ejercicio_que_no_esta_en_el_dia_es_400(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    created = _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    day_id = created["days"][0]["day_id"]
    _assign(client, owner_headers, member.id, template["id"])

    response = client.post(
        f"/routines/users/{member.id}/logs",
        # "legs-back-squat" existe en el catálogo pero no está en este día.
        json={"day_id": day_id, "exercise_id": "legs-back-squat", "sets_count": 3, "reps": 10, "weight_kg": 40},
        headers=owner_headers,
    )

    assert response.status_code == 400, response.text


# --- Base ajustada por cliente y cambio de estrategia en vivo ---------------


def test_el_plan_del_miembro_usa_la_base_ajustada_para_ese_cliente(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
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


def test_cambiar_la_estrategia_se_refleja_en_el_plan_del_miembro(
    client, owner_user, auth_header, db_session, catalog_basic
):
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    created = _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [
            {"exercise_id": "chest-bench-press", "base": {"sets": 4, "reps": 8, "weight_kg": 45}}
        ]}],
    )
    day_id = created["days"][0]["day_id"]
    assignment = _assign(client, owner_headers, member.id, template["id"])

    _save_days(
        client, owner_headers, template["id"],
        [{"day_id": day_id, "muscle_groups": [], "exercises": [
            {"exercise_id": "chest-bench-press", "strategy": "rest_pause"}
        ]}],
    )

    member_headers = auth_header(member.email)
    response = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers)

    exercise = next(
        item for item in response.json()["days"][0]["exercises"] if item["exercise_id"] == "chest-bench-press"
    )
    assert exercise["strategy"] == "rest_pause"
    assert [item["reps"] for item in exercise["planned_sets"]] == [8, 7, 6, 5]
