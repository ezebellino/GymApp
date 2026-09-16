"""Tests de `backend/app/routers/exercises.py` (capability `exercise-catalog`).

Cubre el CRUD del catálogo para staff (Dueño/Coach): alta con nombre único, listas
fijas de grupo muscular y tipo de entrenamiento, edición sin romper referencias,
validación de URL externa, listado con filtros y `X-Total-Count`, activar/
desactivar, borrado angosto (S1) y autorización de rol
(`staff-endpoint-authorization`). Los tests de media (subida, ciclo de vida del
objeto, prioridad archivo/URL) viven en `test_exercise_media.py`.

`template-owned-routine-days`: el catálogo ya no tiene ningún vínculo derivado a
un día (`routine_catalog.py`/`TrainingDayExercise` se borraron enteros) ni base
propia (`base_sets`/`base_reps`/`base_weight_kg` se dropearon de `Exercise`) —
los tests que cubrían esa indirección (nacer activo para "el día del grupo
muscular", moverse de día al cambiar el grupo, `_offered_as_new_option`, la
base editable vía `PUT /routines/exercises/{id}`) se borraron con ella: no hay
comportamiento que sigan probando. Lo que sobrevive de esos escenarios —"un
ejercicio en uso en una plantilla no se puede borrar", "editarlo no rompe la
referencia"— se re-testea contra `routine_template_day_exercises`.
"""

from app import models
from tests.helpers import CLIENT_EMAIL, OWNER_EMAIL, create_user


def _create_template(client, headers, *, name):
    response = client.post("/routines/templates", json={"name": name, "tag": ""}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _add_exercise_to_template(client, headers, template_id, exercise_id):
    """Agrega `exercise_id` al Día 1 (ya existente) de la plantilla vía el
    `PUT` de guardado del borrador (`template-owned-routine-days`, design D5):
    ya no hay un endpoint granular por (día, ejercicio)."""
    template = client.get(f"/routines/templates/{template_id}", headers=headers).json()
    day_id = template["days"][0]["day_id"]
    response = client.put(
        f"/routines/templates/{template_id}/days",
        json={"days": [{"day_id": day_id, "muscle_groups": [], "exercises": [{"exercise_id": exercise_id}]}]},
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


def test_el_catalogo_de_ejercicios_ya_no_expone_ni_acepta_una_base(client, owner_user, auth_header):
    """`template-owned-routine-days` (design D7): la base editable del
    catálogo se retiró sin reemplazo. `POST`/`PATCH` ignoran cualquier
    `base_*` del payload (no rompen, tampoco lo persisten en ningún lado) y
    `ExerciseOut` nunca expone esos campos."""
    headers = auth_header(OWNER_EMAIL)

    created = client.post(
        "/exercises/",
        json={
            "name": "Ejercicio con base en el payload (test)",
            "muscle_group": "Pecho",
            "base_sets": 4,
            "base_reps": 8,
            "base_weight_kg": 20,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert "base_sets" not in body
    assert "base_reps" not in body
    assert "base_weight_kg" not in body
    assert "base" not in body

    patched = client.patch(
        f"/exercises/{body['id']}",
        json={"base_sets": 5, "base_reps": 5, "base_weight_kg": 90},
        headers=headers,
    )
    assert patched.status_code == 200, patched.text
    assert "base_sets" not in patched.json()


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
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Press inclinado (test)", "muscle_group": "Pecho"}, headers=headers
    ).json()
    template = _create_template(client, headers, name="Plantilla editar ejercicio")
    _add_exercise_to_template(client, headers, template["id"], exercise["id"])

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

    # Cambiar el grupo muscular no afecta el vínculo: es explícito y propio de
    # la plantilla, no derivado del grupo muscular (design D1/D2).
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


def test_busqueda_por_texto_matchea_nombre_o_grupo_muscular(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    por_nombre = client.post(
        "/exercises/",
        json={"name": "Curl biceps con mancuernas", "muscle_group": "Espalda"},
        headers=headers,
    ).json()
    por_grupo = client.post(
        "/exercises/",
        json={"name": "Martillo alterno", "muscle_group": "Bíceps"},
        headers=headers,
    ).json()
    client.post(
        "/exercises/", json={"name": "Sentadilla libre", "muscle_group": "Cuádriceps"}, headers=headers
    )

    # "biceps" sin tilde encuentra el del nombre y el del grupo muscular.
    found = {
        item["id"] for item in client.get("/exercises/", params={"q": "biceps"}, headers=headers).json()
    }
    assert por_nombre["id"] in found
    assert por_grupo["id"] in found
    assert len(found) == 2


def test_desactivar_ejercicio_lo_saca_del_listado_activo_y_conserva_la_plantilla(
    client, owner_user, auth_header
):
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Remo con barra (test)", "muscle_group": "Espalda"}, headers=headers
    ).json()
    template = _create_template(client, headers, name="Plantilla desactivar")
    _add_exercise_to_template(client, headers, template["id"], exercise["id"])

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
    template = _create_template(client, headers, name="Plantilla borrar")
    _add_exercise_to_template(client, headers, template["id"], exercise["id"])

    response = client.delete(f"/exercises/{exercise['id']}", headers=headers)

    assert response.status_code == 409, response.text
    still_there = client.get(f"/exercises/{exercise['id']}", headers=headers)
    assert still_there.status_code == 200
    assert still_there.json()["is_active"] is True


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
