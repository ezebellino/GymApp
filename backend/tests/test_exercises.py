"""Tests de `backend/app/routers/exercises.py` (capability `exercise-catalog`).

Cubre el CRUD del catálogo para staff (Dueño/Coach): alta con nombre único, listas
fijas de grupo muscular y tipo de entrenamiento, edición sin romper referencias,
validación de URL externa, listado con filtros y `X-Total-Count`, activar/
desactivar, borrado angosto (S1), autorización de rol
(`staff-endpoint-authorization`) y la consistencia del reseed (grupo 3) con los
grupos musculares nuevos. Los tests de media (subida, ciclo de vida del objeto,
prioridad archivo/URL) viven en `test_exercise_media.py`.
"""

from app import models
from tests.helpers import CLIENT_EMAIL, OWNER_EMAIL, create_user


def _create_template(client, headers, *, name, day_ids):
    response = client.post(
        "/routines/templates",
        json={"name": name, "tag": "", "day_ids": day_ids},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _add_exercise_to_template(client, headers, template_id, day_id, exercise_id):
    response = client.put(
        f"/routines/templates/{template_id}/days/{day_id}/exercises/{exercise_id}",
        json={"is_active": True},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


# --- Alta y validación (task 6.1) --------------------------------------------


def test_crear_ejercicio_devuelve_201_con_grupo_y_tipos(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/exercises/",
        json={
            "name": "Press de banca",
            "muscle_group": "Pecho",
            "training_types": ["Fuerza", "Hipertrofia"],
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert "Location" in response.headers
    body = response.json()
    assert body["muscle_group"] == "Pecho"
    assert body["training_types"] == ["Fuerza", "Hipertrofia"]
    assert body["is_active"] is True


def test_crear_ejercicio_sin_grupo_ni_tipos_ni_media_nace_activo(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    response = client.post("/exercises/", json={"name": "Ejercicio simple"}, headers=headers)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["muscle_group"] is None
    assert body["training_types"] == []
    assert body["is_active"] is True
    assert body["media_kind"] is None
    assert body["external_media_url"] is None


def test_nombre_duplicado_ignorando_mayusculas_y_espacios_devuelve_409(
    client, owner_user, auth_header, db_session
):
    headers = auth_header(OWNER_EMAIL)
    client.post("/exercises/", json={"name": "Sentadilla libre (test)"}, headers=headers)

    response = client.post(
        "/exercises/", json={"name": "  SENTADILLA LIBRE (TEST)  "}, headers=headers
    )

    assert response.status_code == 409, response.text
    count = (
        db_session.query(models.Exercise)
        .filter(models.Exercise.name_normalized == "sentadilla libre (test)")
        .count()
    )
    assert count == 1


def test_nombre_vacio_o_solo_espacios_devuelve_422(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    empty = client.post("/exercises/", json={"name": ""}, headers=headers)
    assert empty.status_code == 422, empty.text

    blank = client.post("/exercises/", json={"name": "   "}, headers=headers)
    assert blank.status_code == 422, blank.text

    # H3 (verificación): `PATCH` con nombre en blanco o `null` explícito devolvía
    # 500 (`_normalize_name(None)`) en vez de 422.
    exercise = client.post("/exercises/", json={"name": "Ejercicio para PATCH inválido"}, headers=headers).json()

    blank_patch = client.patch(f"/exercises/{exercise['id']}", json={"name": "   "}, headers=headers)
    assert blank_patch.status_code == 422, blank_patch.text

    null_patch = client.patch(f"/exercises/{exercise['id']}", json={"name": None}, headers=headers)
    assert null_patch.status_code == 422, null_patch.text


# --- Listas fijas y edición (task 6.2) ---------------------------------------


def test_grupo_muscular_fuera_de_la_lista_fija_devuelve_422(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    # "Piernas" es justo el valor legacy que la migración manda a NULL (D9): no
    # pertenece a la lista fija, que la partió en Cuádriceps/Isquios/Gemelos.
    response = client.post(
        "/exercises/", json={"name": "Ejercicio con grupo raro", "muscle_group": "Piernas"}, headers=headers
    )

    assert response.status_code == 422, response.text


def test_tipo_de_entrenamiento_fuera_de_la_lista_fija_devuelve_422(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/exercises/",
        json={"name": "Ejercicio con tipo raro", "training_types": ["Crossfit"]},
        headers=headers,
    )

    assert response.status_code == 422, response.text


def test_patch_reemplaza_el_set_completo_de_tipos_de_entrenamiento(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    created = client.post(
        "/exercises/",
        json={"name": "Ejercicio con tipos", "training_types": ["Fuerza", "Hipertrofia", "Cardio"]},
        headers=headers,
    ).json()

    response = client.patch(
        f"/exercises/{created['id']}", json={"training_types": ["Movilidad"]}, headers=headers
    )

    assert response.status_code == 200, response.text
    assert response.json()["training_types"] == ["Movilidad"]


def test_editar_ejercicio_usado_en_plantilla_no_rompe_la_referencia(client, owner_user, auth_header):
    """Cubre tanto la descripción como el grupo muscular (H2, hallazgo de
    verificación): `sync_exercise_day_links` borraba el `TrainingDayExercise`
    del día viejo al cambiar `muscle_group` por `PATCH`, y con él se perdía la
    fila que enumera el ejercicio dentro de la plantilla — aunque
    `RoutineTemplateExercise` sobreviviera huérfana. El caso original (editar
    `name`/`description`) no alcanzaba a cubrir esa rama."""
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Press inclinado (test)", "muscle_group": "Pecho"}, headers=headers
    ).json()
    template = _create_template(client, headers, name="Plantilla editar ejercicio", day_ids=["day-1"])
    _add_exercise_to_template(client, headers, template["id"], "day-1", exercise["id"])

    response = client.patch(
        f"/exercises/{exercise['id']}",
        json={"name": "Press inclinado actualizado", "description": "Nueva descripción"},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    detail = client.get(f"/routines/templates/{template['id']}", headers=headers).json()
    in_template = next(
        item for item in detail["days"][0]["exercises"] if item["exercise_id"] == exercise["id"]
    )
    assert in_template["name"] == "Press inclinado actualizado"

    # Cambiar el grupo muscular es la rama que rompía la referencia (H2): el
    # ejercicio tiene que seguir apareciendo en la plantilla que ya lo usa.
    response = client.patch(
        f"/exercises/{exercise['id']}", json={"muscle_group": "Espalda"}, headers=headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["muscle_group"] == "Espalda"

    detail = client.get(f"/routines/templates/{template['id']}", headers=headers).json()
    in_template = next(
        (item for item in detail["days"][0]["exercises"] if item["exercise_id"] == exercise["id"]),
        None,
    )
    assert in_template is not None
    assert in_template["muscle_group"] == "Espalda"


def test_url_externa_invalida_devuelve_422_y_no_modifica_el_ejercicio(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/",
        json={"name": "Ejercicio con URL", "external_media_url": "https://youtube.com/watch?v=abc"},
        headers=headers,
    ).json()

    response = client.patch(
        f"/exercises/{exercise['id']}", json={"external_media_url": "no-es-una-url"}, headers=headers
    )
    assert response.status_code == 422, response.text

    unchanged = client.get(f"/exercises/{exercise['id']}", headers=headers).json()
    assert unchanged["external_media_url"] == "https://youtube.com/watch?v=abc"


# --- Listado y estado (task 6.3) ---------------------------------------------


def test_listado_filtra_por_grupo_tipo_y_estado_y_expone_total_count(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    a = client.post(
        "/exercises/",
        json={"name": "Filtro A", "muscle_group": "Cuádriceps", "training_types": ["Fuerza"]},
        headers=headers,
    ).json()
    client.post(
        "/exercises/",
        json={"name": "Filtro B", "muscle_group": "Cuádriceps", "training_types": ["Movilidad"]},
        headers=headers,
    )
    c = client.post(
        "/exercises/",
        json={"name": "Filtro C", "muscle_group": "Espalda", "training_types": ["Fuerza"]},
        headers=headers,
    ).json()
    client.post(f"/exercises/{c['id']}/deactivate", headers=headers)

    response = client.get(
        "/exercises/",
        params={"muscle_group": "Cuádriceps", "training_type": "Fuerza", "is_active": True},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.headers["X-Total-Count"] == "1"
    assert [item["id"] for item in response.json()] == [a["id"]]


def test_desactivar_ejercicio_lo_saca_del_listado_activo_y_conserva_la_plantilla(
    client, owner_user, auth_header
):
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Remo con barra (test)", "muscle_group": "Espalda"}, headers=headers
    ).json()
    template = _create_template(client, headers, name="Plantilla desactivar", day_ids=["day-2"])
    _add_exercise_to_template(client, headers, template["id"], "day-2", exercise["id"])

    response = client.post(f"/exercises/{exercise['id']}/deactivate", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["is_active"] is False

    active_ids = [
        item["id"]
        for item in client.get("/exercises/", params={"is_active": True}, headers=headers).json()
    ]
    assert exercise["id"] not in active_ids

    detail = client.get(f"/routines/templates/{template['id']}", headers=headers).json()
    assert any(item["exercise_id"] == exercise["id"] for item in detail["days"][0]["exercises"])


def test_reactivar_ejercicio_lo_vuelve_a_ofrecer_en_el_listado_activo(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Curl de biceps (test)", "muscle_group": "Bíceps"}, headers=headers
    ).json()
    client.post(f"/exercises/{exercise['id']}/deactivate", headers=headers)

    response = client.post(f"/exercises/{exercise['id']}/activate", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["is_active"] is True

    active_ids = [
        item["id"]
        for item in client.get("/exercises/", params={"is_active": True}, headers=headers).json()
    ]
    assert exercise["id"] in active_ids


# --- Borrado (task 6.4, S1) --------------------------------------------------


def test_borrar_ejercicio_nunca_usado_devuelve_204_y_lo_saca_del_catalogo(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post("/exercises/", json={"name": "Ejercicio descartable"}, headers=headers).json()

    response = client.delete(f"/exercises/{exercise['id']}", headers=headers)
    assert response.status_code == 204, response.text

    assert client.get(f"/exercises/{exercise['id']}", headers=headers).status_code == 404

    inactive_ids = [
        item["id"]
        for item in client.get("/exercises/", params={"is_active": False}, headers=headers).json()
    ]
    assert exercise["id"] not in inactive_ids


def test_borrar_ejercicio_usado_en_plantilla_devuelve_409(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Press militar (test)", "muscle_group": "Hombros"}, headers=headers
    ).json()
    template = _create_template(client, headers, name="Plantilla borrar", day_ids=["day-3"])
    _add_exercise_to_template(client, headers, template["id"], "day-3", exercise["id"])

    response = client.delete(f"/exercises/{exercise['id']}", headers=headers)

    assert response.status_code == 409, response.text
    still_there = client.get(f"/exercises/{exercise['id']}", headers=headers)
    assert still_there.status_code == 200
    assert still_there.json()["is_active"] is True


def test_borrar_ejercicio_con_solo_el_vinculo_automatico_de_dia_esta_permitido(
    client, owner_user, auth_header
):
    headers = auth_header(OWNER_EMAIL)
    # Dispara `_ensure_seed_data`: crea el vínculo automático `TrainingDayExercise`
    # de "legs-sissy-squat" con el Día 4 a partir de su grupo muscular, sin que
    # ninguna plantilla ni sesión lo referencien todavía.
    client.get("/routines/days", headers=headers)

    response = client.delete("/exercises/legs-sissy-squat", headers=headers)

    assert response.status_code == 204, response.text


# --- Autorización (task 6.5, delta staff-endpoint-authorization) ------------


def test_endpoints_de_ejercicios_sin_sesion_devuelve_401_y_con_rol_member_403(
    client, owner_user, auth_header, db_session
):
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post("/exercises/", json={"name": "Ejercicio de auth"}, headers=headers).json()

    create_user(
        db_session,
        email=CLIENT_EMAIL,
        first_name="Cliente",
        last_name="de Test",
        role=models.UserRole.member,
    )
    member_headers = auth_header(CLIENT_EMAIL)

    requests = [
        ("get", "/exercises/meta", None),
        ("get", "/exercises/", None),
        ("get", f"/exercises/{exercise['id']}", None),
        ("post", "/exercises/", {"name": "Otro ejercicio de auth"}),
        ("patch", f"/exercises/{exercise['id']}", {"description": "x"}),
        ("post", f"/exercises/{exercise['id']}/activate", None),
        ("post", f"/exercises/{exercise['id']}/deactivate", None),
        ("delete", f"/exercises/{exercise['id']}/media", None),
        ("delete", f"/exercises/{exercise['id']}", None),
    ]

    for method, url, json_body in requests:
        kwargs = {"json": json_body} if json_body is not None else {}
        no_token = getattr(client, method)(url, **kwargs)
        assert no_token.status_code == 401, f"{method} {url}: {no_token.text}"

        as_member = getattr(client, method)(url, **kwargs, headers=member_headers)
        assert as_member.status_code == 403, f"{method} {url}: {as_member.text}"

    no_token_media = client.post(f"/exercises/{exercise['id']}/media")
    assert no_token_media.status_code == 401, no_token_media.text
    as_member_media = client.post(f"/exercises/{exercise['id']}/media", headers=member_headers)
    assert as_member_media.status_code == 403, as_member_media.text


# --- Consistencia del reseed (task 6.6, grupo 3) -----------------------------


def test_seed_vincula_los_ejercicios_de_pierna_a_los_grupos_musculares_nuevos(
    client, owner_user, auth_header
):
    headers = auth_header(OWNER_EMAIL)

    response = client.get("/routines/days", headers=headers)
    assert response.status_code == 200, response.text

    day4 = next(day for day in response.json() if day["id"] == "day-4")
    exercises_by_id = {item["exercise_id"]: item for item in day4["exercises"]}

    assert exercises_by_id["legs-back-squat"]["muscle_group"] == "Cuádriceps"
    assert exercises_by_id["legs-romanian-deadlift"]["muscle_group"] == "Isquios"
    assert exercises_by_id["legs-standing-calf-raise"]["muscle_group"] == "Gemelos"


def test_ejercicio_sin_grupo_muscular_no_rompe_routines_days(client, owner_user, auth_header):
    """Regresión H1 (verificación, corrida completa): `RoutineExerciseOption`
    fue el único schema corregido en la primera pasada, pero quedaron otros
    cinco declarando `muscle_group: str` no-opcional contra la columna nullable
    (design D1) — `RoutineCatalogExercise`, `RoutineCatalogGroup`,
    `RoutineExerciseManageOut`, `RoutineTemplateExerciseOut` y `WorkoutLogOut`.
    Con un solo ejercicio sin grupo, `/routines/catalog` y `/routines/exercises`
    seguían dando 500, y `PUT /routines/exercises/{id}` (que
    `EditExerciseBaseDialog`/`AdjustExerciseBaseDialog` consumen) explotaba
    **después** de commitear el cambio. Este test cubre las cuatro superficies
    nombradas por el hallazgo, más el detalle de plantilla."""
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Ejercicio sin grupo (test)"}, headers=headers
    ).json()

    assert client.get("/routines/days", headers=headers).status_code == 200
    assert client.get("/routines/catalog", headers=headers).status_code == 200
    assert client.get("/routines/exercises", headers=headers).status_code == 200

    put_response = client.put(
        f"/routines/exercises/{exercise['id']}",
        json={"base_sets": 4, "base_reps": 8, "base_weight_kg": 20},
        headers=headers,
    )
    assert put_response.status_code == 200, put_response.text
    assert put_response.json()["muscle_group"] is None

    # Para el detalle de plantilla: un ejercicio se agrega a un día vía el
    # vínculo automático `TrainingDayExercise` (deriva del grupo muscular, no
    # hay forma de agregar uno arbitrario a un día por API). Se crea con grupo,
    # se agrega a la plantilla, y **después** se le quita el grupo — el mismo
    # camino que ejercita H2 (el vínculo se conserva por estar en uso) y que es
    # justo donde H1 explotaba al serializar la respuesta.
    grouped_exercise = client.post(
        "/exercises/", json={"name": "Ejercicio con grupo (test)", "muscle_group": "Pecho"}, headers=headers
    ).json()
    template = _create_template(
        client, headers, name="Plantilla sin grupo (test)", day_ids=["day-1"]
    )
    _add_exercise_to_template(client, headers, template["id"], "day-1", grouped_exercise["id"])
    patch_response = client.patch(
        f"/exercises/{grouped_exercise['id']}", json={"muscle_group": None}, headers=headers
    )
    assert patch_response.status_code == 200, patch_response.text

    detail_response = client.get(f"/routines/templates/{template['id']}", headers=headers)
    assert detail_response.status_code == 200, detail_response.text
    in_template = next(
        item
        for item in detail_response.json()["days"][0]["exercises"]
        if item["exercise_id"] == grouped_exercise["id"]
    )
    assert in_template["muscle_group"] is None


# --- Reactivar y catálogo fijo (task 12.9, H6/D7.1) --------------------------


def test_reactivar_no_reactiva_la_seleccion_por_dia_del_catalogo_fijo(client, owner_user, auth_header):
    """`activate` (task 12.8, design D7.1) ya no reactiva en bloque los
    `TrainingDayExercise` del ejercicio, a diferencia de la primera
    implementación que lo espejaba con `deactivate`. Reactivar tiene que dejar
    al ejercicio igual que uno recién creado: en el catálogo, pero sin volver a
    aparecer en la selección de un día de la que el staff ya lo había excluido
    a mano (invariante I10)."""
    headers = auth_header(OWNER_EMAIL)
    exercise_id = "chest-bench-press"

    day1 = next(
        day for day in client.get("/routines/days", headers=headers).json() if day["id"] == "day-1"
    )
    other_active_ids = [
        item["exercise_id"]
        for item in day1["exercises"]
        if item["is_active"] and item["exercise_id"] != exercise_id
    ]
    assert other_active_ids  # el Día 1 tiene otros ejercicios activos por default

    # El staff excluye "chest-bench-press" de la selección del Día 1 a mano.
    selection_response = client.put(
        "/routines/days/day-1/selection",
        json={"exercise_ids": other_active_ids},
        headers=headers,
    )
    assert selection_response.status_code == 200, selection_response.text
    day1_after_exclusion = selection_response.json()
    link = next(item for item in day1_after_exclusion["exercises"] if item["exercise_id"] == exercise_id)
    assert link["is_active"] is False

    # Desactivar y reactivar el ejercicio desde /exercises (catálogo).
    deactivate_response = client.post(f"/exercises/{exercise_id}/deactivate", headers=headers)
    assert deactivate_response.status_code == 200, deactivate_response.text
    activate_response = client.post(f"/exercises/{exercise_id}/activate", headers=headers)
    assert activate_response.status_code == 200, activate_response.text
    assert activate_response.json()["is_active"] is True

    # No vuelve a la selección del Día 1...
    day1_after_reactivate = next(
        day for day in client.get("/routines/days", headers=headers).json() if day["id"] == "day-1"
    )
    link_after = next(
        item for item in day1_after_reactivate["exercises"] if item["exercise_id"] == exercise_id
    )
    assert link_after["is_active"] is False

    # ...ni al `active_exercise_count` del overview de un usuario.
    overview_before = next(
        day
        for day in client.get(f"/routines/users/{owner_user.id}/overview", headers=headers).json()
        if day["day_id"] == "day-1"
    )
    assert overview_before["active_exercise_count"] == len(other_active_ids)
