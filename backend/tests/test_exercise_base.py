"""Tests de la base (series × reps · kg) en el flujo existente de alta/edición de un
ejercicio del catálogo (`POST`/`PUT /routines/exercises`, capability `routine-templates`,
requirement "Base del ejercicio al crear o editar en el catálogo"). Acción exclusiva del
Dueño, sin cambio de ese permiso (design D3).
"""

from tests.helpers import OWNER_EMAIL


def test_crear_un_ejercicio_indicando_su_base(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/routines/exercises",
        json={
            "name": "Press banca plano",
            "muscle_group": "Pecho",
            "base_sets": 4,
            "base_reps": 8,
            "base_weight_kg": 45,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["base_sets"] == 4
    assert body["base_reps"] == 8
    assert body["base_weight_kg"] == 45


def test_crear_un_ejercicio_sin_base_usa_el_default_3x10_0kg(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/routines/exercises",
        json={"name": "Ejercicio nuevo", "muscle_group": "Pecho"},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["base_sets"] == 3
    assert body["base_reps"] == 10
    assert body["base_weight_kg"] == 0


def test_editar_la_base_de_un_ejercicio_existente(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    create_response = client.post(
        "/routines/exercises",
        json={"name": "Sentadilla libre", "muscle_group": "Piernas"},
        headers=headers,
    )
    exercise_id = create_response.json()["id"]

    update_response = client.put(
        f"/routines/exercises/{exercise_id}",
        json={"base_sets": 5, "base_reps": 5, "base_weight_kg": 70},
        headers=headers,
    )

    assert update_response.status_code == 200, update_response.text
    body = update_response.json()
    assert body["base_sets"] == 5
    assert body["base_reps"] == 5
    assert body["base_weight_kg"] == 70


def test_una_base_invalida_es_rechazada(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/routines/exercises",
        json={
            "name": "Ejercicio invalido",
            "muscle_group": "Pecho",
            "base_sets": 0,
            "base_reps": 10,
            "base_weight_kg": -5,
        },
        headers=headers,
    )

    assert response.status_code == 422, response.text


def test_la_base_editada_cambia_el_plan_calculado_de_la_plantilla(client, owner_user, auth_header):
    """Usa el detalle de plantilla de `routine_templates.py` (grupo 4): la base
    editada en el catálogo es el punto de partida del plan de toda plantilla que
    incluya ese ejercicio (spec `routine-templates`, "Un Dueño edita la base...")."""
    headers = auth_header(OWNER_EMAIL)

    create_response = client.post(
        "/routines/exercises",
        json={
            "name": "Ejercicio con base editable",
            "muscle_group": "Pecho",
            "base_sets": 4,
            "base_reps": 8,
            "base_weight_kg": 40,
        },
        headers=headers,
    )
    exercise_id = create_response.json()["id"]

    template_response = client.post(
        "/routines/templates",
        json={"name": "Plantilla base editable", "tag": "", "day_ids": ["day-1"]},
        headers=headers,
    )
    template_id = template_response.json()["id"]

    def _planned_sets():
        detail = client.get(f"/routines/templates/{template_id}", headers=headers).json()
        exercise = next(
            item for item in detail["days"][0]["exercises"] if item["exercise_id"] == exercise_id
        )
        return exercise["planned_sets"]

    before = _planned_sets()
    assert [(item["weight_kg"], item["reps"]) for item in before] == [(40, 8), (40, 8), (40, 8), (40, 8)]

    client.put(
        f"/routines/exercises/{exercise_id}",
        json={"base_sets": 5, "base_reps": 5, "base_weight_kg": 70},
        headers=headers,
    )

    after = _planned_sets()
    assert [(item["weight_kg"], item["reps"]) for item in after] == [(70, 5)] * 5


def test_un_coach_no_puede_editar_la_base_de_un_ejercicio(client, owner_user, coach_user, auth_header):
    owner_headers = auth_header(OWNER_EMAIL)
    create_response = client.post(
        "/routines/exercises",
        json={"name": "Press militar con barra", "muscle_group": "Hombros"},
        headers=owner_headers,
    )
    exercise_id = create_response.json()["id"]

    coach_headers = auth_header(coach_user.email)
    response = client.put(
        f"/routines/exercises/{exercise_id}",
        json={"base_sets": 4, "base_reps": 8, "base_weight_kg": 28},
        headers=coach_headers,
    )

    assert response.status_code == 403, response.text
