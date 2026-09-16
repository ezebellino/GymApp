"""Tests de la vista del miembro (`routine_assignments.py::my_router` y los
endpoints de `routines.py` que resuelven overview/logs/progreso sobre la
asignación Activa; capability `member-routine-view`,
`template-owned-routine-days`, `member-routine-copies`).
"""

from app import models
from app.auth import get_current_user
from app.main import app
from tests.helpers import OWNER_EMAIL, create_user, mark_set


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


# --- Histórico (`member-routine-copies`, design D6/D10) ---------------------
# El alta de logs por staff (`POST /routines/users/{id}/logs`) se retiró
# entero (D6): la única vía para registrar progreso es el propio Miembro,
# marcando serie por serie (`mark_set`, cubierto en `test_workout_set_logs.py`).


def test_el_historico_del_miembro_filtra_por_ejercicio_y_periodo(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """Fixture con registros dentro **y fuera** del período pedido, y de
    **otro** ejercicio: el filtro puede fallar de verdad si deja pasar
    cualquiera de los dos."""
    from datetime import date

    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [
            {"exercise_id": "chest-bench-press"}, {"exercise_id": "legs-back-squat"}
        ]}],
    )
    assignment = _assign(client, owner_headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=owner_headers
    ).json()
    day_id = detail["days"][0]["day_id"]

    def _log(exercise_id, set_index, performed_on):
        db_session.add(
            models.WorkoutSetLog(
                user_id=member.id,
                assignment_day_id=day_id,
                day_name="Día 1",
                exercise_id=exercise_id,
                set_index=set_index,
                reps=8,
                weight_kg=40,
                performed_on=performed_on,
                created_by_user_id=member.id,
            )
        )

    _log("chest-bench-press", 1, date(2024, 1, 10))  # dentro del período pedido
    _log("chest-bench-press", 2, date(2024, 3, 1))  # fuera del período pedido
    _log("legs-back-squat", 1, date(2024, 1, 15))  # dentro del período, otro ejercicio
    db_session.commit()

    member_headers = auth_header(member.email)
    response = client.get(
        "/routines/my/logs",
        params={"exercise_id": "chest-bench-press", "from": "2024-01-01", "to": "2024-01-31"},
        headers=member_headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["exercise_id"] == "chest-bench-press"
    assert body[0]["set_index"] == 1


def test_los_ejercicios_con_registros_incluyen_uno_quitado_de_la_copia(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """`GET /routines/users/{id}/logged-exercises` se alimenta del **histórico**,
    no de la copia vigente (design D6, D10): un ejercicio ya quitado sigue
    apareciendo si tiene marcas."""
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, owner_headers)
    _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = _assign(client, owner_headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=owner_headers
    ).json()
    day_id = detail["days"][0]["day_id"]

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=8)

    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/days",
        json={"days": [{"day_id": day_id, "muscle_groups": [], "exercises": []}]},
        headers=owner_headers,
    )

    response = client.get(f"/routines/users/{member.id}/logged-exercises", headers=owner_headers)
    assert response.status_code == 200, response.text
    assert [item["exercise_id"] for item in response.json()] == ["chest-bench-press"]


# --- `GET /routines/my/logged-exercises` (`member-routine-copies`, design D15) --


def test_el_miembro_lista_sus_ejercicios_con_registros_incluido_uno_quitado(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """Espejo del de staff, resuelto sobre el propio Miembro: marcar, quitar
    el ejercicio de la copia, y verificar que sigue apareciendo en el propio
    filtro (D15) — es la fuente del panel "Historial" cuando el ejercicio
    quitado hace rato salió de la ventana de marcas recientes."""
    owner_headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session, email="miembro-logged-exercises@example.com")
    template = _create_template(client, owner_headers)
    _save_days(
        client, owner_headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = _assign(client, owner_headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=owner_headers
    ).json()
    day_id = detail["days"][0]["day_id"]

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=8)

    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/days",
        json={"days": [{"day_id": day_id, "muscle_groups": [], "exercises": []}]},
        headers=owner_headers,
    )

    response = client.get("/routines/my/logged-exercises", headers=member_headers)

    assert response.status_code == 200, response.text
    assert [item["exercise_id"] for item in response.json()] == ["chest-bench-press"]


def test_los_ejercicios_con_registros_del_miembro_no_aceptan_un_user_id_ajeno(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """El scope `/my` no es un atajo para leer a otro Miembro (I10): pedir
    `/users/{otro}/logged-exercises` con un token de Miembro es 403, no una
    forma alternativa de llegar al mismo dato."""
    member = _create_member(db_session, email="miembro-a@example.com")
    otro_member = _create_member(db_session, email="miembro-b@example.com")
    member_headers = auth_header(member.email)

    response = client.get(f"/routines/users/{otro_member.id}/logged-exercises", headers=member_headers)

    assert response.status_code == 403, response.text
