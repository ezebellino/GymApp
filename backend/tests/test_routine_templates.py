"""Tests de `backend/app/routers/routine_templates.py` (capability `routine-templates`,
motor de progresión aplicado vía `progression-strategies`).
"""

from app import models
from tests.helpers import COACH_EMAIL, OWNER_EMAIL, create_user


def _create_template(client, headers, *, name="Fuerza 4 días", tag="FUERZA", day_ids=None):
    response = client.post(
        "/routines/templates",
        json={"name": name, "tag": tag, "day_ids": day_ids or ["day-1", "day-4"]},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_coach_crea_una_plantilla_con_dos_dias(client, coach_user, auth_header):
    headers = auth_header(COACH_EMAIL)

    body = _create_template(
        client, headers, name="Full body inicial", tag="INICIO", day_ids=["day-1", "day-4"]
    )

    assert body["name"] == "Full body inicial"
    assert body["tag"] == "INICIO"
    assert [day["day_id"] for day in body["days"]] == ["day-1", "day-4"]


def test_crear_una_plantilla_sin_dias_es_rechazado(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/routines/templates",
        json={"name": "Sin días", "tag": "", "day_ids": []},
        headers=headers,
    )

    assert response.status_code == 422, response.text
    assert db_session.query(models.RoutineTemplate).count() == 0


def test_editar_nombre_y_etiqueta_de_una_plantilla(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = client.patch(
        f"/routines/templates/{template['id']}",
        json={"name": "Fuerza 4 días · Avanzado", "tag": "AVANZADO"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Fuerza 4 días · Avanzado"
    assert body["tag"] == "AVANZADO"


def test_el_detalle_solo_devuelve_los_dias_de_la_plantilla(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(
        client, headers, name="Full body inicial", day_ids=["day-1", "day-4"]
    )

    response = client.get(f"/routines/templates/{template['id']}", headers=headers)

    assert response.status_code == 200, response.text
    day_ids = [day["day_id"] for day in response.json()["days"]]
    assert day_ids == ["day-1", "day-4"]


def test_rechaza_un_nombre_duplicado_ignorando_mayusculas(client, coach_user, auth_header):
    headers = auth_header(COACH_EMAIL)
    _create_template(client, headers, name="Fuerza 4 días")

    response = client.post(
        "/routines/templates",
        json={"name": "FUERZA 4 DÍAS", "tag": "", "day_ids": ["day-1"]},
        headers=headers,
    )

    assert response.status_code == 409, response.text
    assert "nombre" in response.json()["detail"].lower()


def test_rechaza_un_nombre_duplicado_ignorando_espacios_en_los_bordes(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    _create_template(client, headers, name="Fuerza 4 días")
    other = _create_template(client, headers, name="Otra plantilla", day_ids=["day-2"])

    response = client.patch(
        f"/routines/templates/{other['id']}",
        json={"name": " Fuerza 4 días "},
        headers=headers,
    )

    assert response.status_code == 409, response.text
    assert "nombre" in response.json()["detail"].lower()


def test_quitar_y_volver_a_agregar_un_dia_conserva_la_configuracion(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers, day_ids=["day-1", "day-4"])
    template_id = template["id"]

    configure = client.put(
        f"/routines/templates/{template_id}/days/day-4/exercises/legs-back-squat",
        json={"strategy": "pyramid", "is_active": True},
        headers=headers,
    )
    assert configure.status_code == 200, configure.text

    # Quitar el Día 4 de la selección
    removed = client.patch(
        f"/routines/templates/{template_id}", json={"day_ids": ["day-1"]}, headers=headers
    )
    assert removed.status_code == 200, removed.text
    assert [day["day_id"] for day in removed.json()["days"]] == ["day-1"]

    # Volver a agregarlo
    restored = client.patch(
        f"/routines/templates/{template_id}", json={"day_ids": ["day-1", "day-4"]}, headers=headers
    )
    assert restored.status_code == 200, restored.text

    day_four = next(day for day in restored.json()["days"] if day["day_id"] == "day-4")
    exercise = next(item for item in day_four["exercises"] if item["exercise_id"] == "legs-back-squat")
    assert exercise["strategy"] == "pyramid"
    assert exercise["is_active"] is True


def test_desactivar_un_ejercicio_conserva_su_estrategia(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers, day_ids=["day-1"])
    template_id = template["id"]

    client.put(
        f"/routines/templates/{template_id}/days/day-1/exercises/chest-cable-fly",
        json={"strategy": "pyramid"},
        headers=headers,
    )
    deactivate = client.put(
        f"/routines/templates/{template_id}/days/day-1/exercises/chest-cable-fly",
        json={"is_active": False},
        headers=headers,
    )
    assert deactivate.status_code == 200, deactivate.text
    assert deactivate.json()["is_active"] is False
    assert deactivate.json()["strategy"] == "pyramid"

    reactivate = client.put(
        f"/routines/templates/{template_id}/days/day-1/exercises/chest-cable-fly",
        json={"is_active": True},
        headers=headers,
    )
    assert reactivate.json()["strategy"] == "pyramid"
    assert reactivate.json()["is_active"] is True


def test_un_ejercicio_nuevo_en_una_plantilla_arranca_en_constante(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers, day_ids=["day-1"])

    response = client.get(f"/routines/templates/{template['id']}", headers=headers)
    day_one = response.json()["days"][0]
    for exercise in day_one["exercises"]:
        assert exercise["strategy"] == "constant"


def test_el_mismo_ejercicio_tiene_estrategia_propia_en_cada_plantilla(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template_a = _create_template(client, headers, name="Fuerza 4 días", day_ids=["day-1"])
    template_b = _create_template(client, headers, name="Hipertrofia 3 días", day_ids=["day-1"])

    client.put(
        f"/routines/templates/{template_a['id']}/days/day-1/exercises/chest-bench-press",
        json={"strategy": "pyramid"},
        headers=headers,
    )

    detail_a = client.get(f"/routines/templates/{template_a['id']}", headers=headers).json()
    detail_b = client.get(f"/routines/templates/{template_b['id']}", headers=headers).json()

    exercise_a = next(
        item for item in detail_a["days"][0]["exercises"] if item["exercise_id"] == "chest-bench-press"
    )
    exercise_b = next(
        item for item in detail_b["days"][0]["exercises"] if item["exercise_id"] == "chest-bench-press"
    )
    assert exercise_a["strategy"] == "pyramid"
    assert exercise_b["strategy"] == "constant"


def test_eliminar_una_plantilla_sin_asignaciones(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = client.delete(f"/routines/templates/{template['id']}", headers=headers)
    assert response.status_code == 204, response.text

    missing = client.get(f"/routines/templates/{template['id']}", headers=headers)
    assert missing.status_code == 404


def test_rechaza_eliminar_una_plantilla_con_asignaciones_e_informa_cuantos_miembros(
    client, owner_user, auth_header, db_session
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    member = create_user(
        db_session,
        email="miembro-plantillas@example.com",
        first_name="Miembro",
        role=models.UserRole.member,
    )
    db_session.add(
        models.RoutineAssignment(
            user_id=member.id,
            template_id=template["id"],
            status=models.RoutineAssignmentStatus.active,
        )
    )
    db_session.commit()

    response = client.delete(f"/routines/templates/{template['id']}", headers=headers)

    assert response.status_code == 409, response.text
    assert "1" in response.json()["detail"]
    assert "miembro" in response.json()["detail"].lower()


def test_cambiar_la_estrategia_devuelve_el_plan_recalculado(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers, day_ids=["day-1"])

    response = client.put(
        f"/routines/templates/{template['id']}/days/day-1/exercises/chest-bench-press",
        json={"strategy": "rest_pause"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["strategy"] == "rest_pause"
    # Base seedeada de chest-bench-press (routine_catalog.py): 4x8 · 45 kg.
    planned = body["planned_sets"]
    assert [item["reps"] for item in planned] == [8, 7, 6, 5]
    assert planned[1]["note"] == "20 s"


def test_un_reseed_del_catalogo_no_borra_la_configuracion_de_la_plantilla(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers, day_ids=["day-1"])

    client.put(
        f"/routines/templates/{template['id']}/days/day-1/exercises/chest-bench-press",
        json={"strategy": "pyramid", "is_active": False},
        headers=headers,
    )

    # `_ensure_seed_data` corre al entrar a cualquier endpoint de rutinas; llamarlo
    # de nuevo (vía otro endpoint) no debe tocar la configuración de la plantilla.
    for _ in range(2):
        listing = client.get("/routines/templates", headers=headers)
        assert listing.status_code == 200

    detail = client.get(f"/routines/templates/{template['id']}", headers=headers).json()
    exercise = next(
        item for item in detail["days"][0]["exercises"] if item["exercise_id"] == "chest-bench-press"
    )
    assert exercise["strategy"] == "pyramid"
    assert exercise["is_active"] is False


def test_un_miembro_no_puede_listar_plantillas(client, db_session, auth_header):
    create_user(
        db_session,
        email="miembro-sin-acceso@example.com",
        first_name="Miembro",
        role=models.UserRole.member,
    )
    headers = auth_header("miembro-sin-acceso@example.com")

    response = client.get("/routines/templates", headers=headers)

    assert response.status_code == 403, response.text
