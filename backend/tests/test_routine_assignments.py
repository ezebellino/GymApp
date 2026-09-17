"""Tests de `backend/app/routers/routine_assignments.py` (capability `routine-assignment`,
`member-routine-copies`), router `router` (`/routines/users/{user_id}/templates`, Dueño/Coach).
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app import models
from tests.helpers import (
    OWNER_EMAIL,
    assign_plan_to_member,
    assign_template_copy,
    create_user,
    mark_set,
)


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


# --- La copia (`member-routine-copies`, design D2/D5/D8) --------------------
# Los tests de ajuste de base por cliente se borraron enteros: ese mecanismo
# (`RoutineAssignmentBase`, `PUT`/`DELETE .../bases/{exercise_id}`) se retiró
# de punta a punta (D4) — la base de un ejercicio de la copia se edita ahora
# directo en `RoutineAssignmentDayExercise` vía `PUT .../days`, cubierto más
# abajo.


def test_asignar_copia_dias_grupos_ejercicios_base_y_estrategia(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I1: asignar copia fielmente los días, sus grupos musculares y sus
    ejercicios (con base y estrategia propias), no una referencia a la
    plantilla."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [
            {
                "day_id": None,
                "muscle_groups": ["Pecho"],
                "exercises": [
                    {
                        "exercise_id": "chest-bench-press",
                        "strategy": "pyramid",
                        "base": {"sets": 4, "reps": 8, "weight_kg": 45},
                    }
                ],
            },
            {
                "day_id": None,
                "muscle_groups": ["Cuádriceps"],
                "exercises": [{"exercise_id": "legs-back-squat"}],
            },
        ],
    )

    assignment = assign_template_copy(client, headers, member.id, template["id"])

    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()
    assert len(detail["days"]) == 2

    first_exercise = detail["days"][0]["exercises"][0]
    assert detail["days"][0]["muscle_groups"] == ["Pecho"]
    assert first_exercise["exercise_id"] == "chest-bench-press"
    assert first_exercise["strategy"] == "pyramid"
    assert first_exercise["base"] == {"sets": 4, "reps": 8, "weight_kg": 45}

    second_exercise = detail["days"][1]["exercises"][0]
    assert detail["days"][1]["muscle_groups"] == ["Cuádriceps"]
    assert second_exercise["exercise_id"] == "legs-back-squat"
    assert second_exercise["strategy"] == "constant"
    assert second_exercise["base"] == {"sets": 3, "reps": 10, "weight_kg": 0}


def test_editar_la_plantilla_origen_no_cambia_la_copia_ya_creada(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I4: lo que le pase a la plantilla después de copiar no se filtra hacia
    una copia ya creada."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])

    # Editar la plantilla origen después de copiar: swap de ejercicio.
    template_detail = client.get(f"/routines/templates/{template['id']}", headers=headers).json()
    day_id = template_detail["days"][0]["day_id"]
    _save_days(
        client, headers, template["id"],
        [{"day_id": day_id, "muscle_groups": [], "exercises": [{"exercise_id": "chest-cable-fly"}]}],
    )

    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()
    assert [item["exercise_id"] for item in detail["days"][0]["exercises"]] == ["chest-bench-press"]


def test_editar_la_copia_de_un_miembro_no_toca_la_copia_del_otro_ni_la_plantilla(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I3: editar la copia de un Miembro no modifica ninguna fila de
    `routine_template_*` ni de la copia de ningún otro Miembro, aunque las dos
    copias vengan de la misma plantilla."""
    headers = auth_header(OWNER_EMAIL)
    member_a = _create_member(db_session, email="miembro-copia-a@example.com")
    member_b = _create_member(db_session, email="miembro-copia-b@example.com")
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment_a = assign_template_copy(client, headers, member_a.id, template["id"])
    assignment_b = assign_template_copy(client, headers, member_b.id, template["id"])

    detail_a = client.get(
        f"/routines/users/{member_a.id}/templates/{assignment_a['id']}", headers=headers
    ).json()
    day_a_id = detail_a["days"][0]["day_id"]
    client.put(
        f"/routines/users/{member_a.id}/templates/{assignment_a['id']}/days",
        json={"days": [{"day_id": day_a_id, "muscle_groups": [], "exercises": [{"exercise_id": "chest-cable-fly"}]}]},
        headers=headers,
    )

    detail_b = client.get(
        f"/routines/users/{member_b.id}/templates/{assignment_b['id']}", headers=headers
    ).json()
    assert [item["exercise_id"] for item in detail_b["days"][0]["exercises"]] == ["chest-bench-press"]

    template_detail = client.get(f"/routines/templates/{template['id']}", headers=headers).json()
    assert [item["exercise_id"] for item in template_detail["days"][0]["exercises"]] == ["chest-bench-press"]


def test_reasignar_la_misma_plantilla_crea_copia_nueva_y_degrada_la_anterior(
    client, owner_user, auth_header, db_session
):
    """I6: reasignar la misma plantilla inserta una fila **nueva** (no un
    upsert) y degrada la anterior, sin borrar nada de ella."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)

    first = assign_template_copy(client, headers, member.id, template["id"])
    second = assign_template_copy(client, headers, member.id, template["id"])

    assert first["id"] != second["id"]

    listing = {item["id"]: item["status"] for item in client.get(
        f"/routines/users/{member.id}/templates", headers=headers
    ).json()}
    assert listing[first["id"]] == "alternative"
    assert listing[second["id"]] == "active"


def test_una_sola_asignacion_activa_por_usuario_con_varias_copias(
    client, owner_user, auth_header, db_session
):
    """I5: el índice único parcial, no solo el chequeo del endpoint —
    insertar una segunda fila Activa directo en la base (bypaseando el
    endpoint) tiene que violar la restricción."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    assign_template_copy(client, headers, member.id, template["id"], status="active")

    with pytest.raises(IntegrityError):
        db_session.add(
            models.RoutineAssignment(
                user_id=member.id,
                template_id=template["id"],
                template_name=template["name"],
                status=models.RoutineAssignmentStatus.active,
            )
        )
        db_session.commit()
    db_session.rollback()

    listing = client.get(f"/routines/users/{member.id}/templates", headers=headers).json()
    assert len([item for item in listing if item["status"] == "active"]) == 1


def test_guardar_la_copia_sin_tocar_un_dia_conserva_su_id_y_sus_marcas(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I2: guardar la copia sin tocar un día conserva su `id` — las marcas que
    lo referencian no quedan huérfanas."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": ["Pecho"], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()
    day_id = detail["days"][0]["day_id"]

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=42, reps=8)

    saved = client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/days",
        json={"days": [{"day_id": day_id, "muscle_groups": ["Pecho"], "exercises": [{"exercise_id": "chest-bench-press"}]}]},
        headers=headers,
    ).json()
    assert saved["days"][0]["day_id"] == day_id

    plan = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers).json()
    exercise = plan["days"][0]["exercises"][0]
    logged_sets = [item for item in exercise["planned_sets"] if item["logged"] is not None]
    assert len(logged_sets) == 1
    assert logged_sets[0]["logged"]["weight_kg"] == 42


def test_los_endpoints_de_ajuste_de_base_por_cliente_ya_no_existen(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I13: `PUT`/`DELETE .../bases/{exercise_id}` (design D4) se retiraron sin
    reemplazo."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])

    put_response = client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        json={"sets": 4, "reps": 6, "weight_kg": 50},
        headers=headers,
    )
    delete_response = client.delete(
        f"/routines/users/{member.id}/templates/{assignment['id']}/bases/chest-bench-press",
        headers=headers,
    )

    assert put_response.status_code == 404, put_response.text
    assert delete_response.status_code == 404, delete_response.text


def test_agregar_un_ejercicio_a_la_copia_arranca_en_constante_y_3x10x0(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """Mismo default que un ejercicio nuevo en una plantilla (design D8): la
    copia comparte la implementación de `routine_days.py`."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()
    day_id = detail["days"][0]["day_id"]

    saved = client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/days",
        json={"days": [{"day_id": day_id, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}]},
        headers=headers,
    ).json()

    exercise = saved["days"][0]["exercises"][0]
    assert exercise["strategy"] == "constant"
    assert exercise["base"] == {"sets": 3, "reps": 10, "weight_kg": 0}


def test_borrar_la_plantilla_origen_con_solo_copias_alternativas_deja_la_copia_entrenable(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I16: borrar la plantilla con solo copias Alternativas deja
    `template_id IS NULL` (el `SET NULL` solo se observa con
    `PRAGMA foreign_keys=ON`, ya activo en `conftest.py`), conserva
    `template_name`, los días/ejercicios y el histórico, y el Miembro sigue
    pudiendo marcar sobre ella."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers, name="Plantilla para borrar")
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"], status="alternative")

    delete_response = client.delete(f"/routines/templates/{template['id']}", headers=headers)
    assert delete_response.status_code == 204, delete_response.text

    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()
    assert detail["template_id"] is None
    assert detail["template_name"] == "Plantilla para borrar"
    assert len(detail["days"]) == 1
    day_id = detail["days"][0]["day_id"]

    member_headers = auth_header(member.email)
    marked = mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=30, reps=10)
    assert marked["weight_kg"] == 30

    logs = client.get(f"/routines/users/{member.id}/logs", headers=headers).json()
    assert len(logs) == 1
    assert logs[0]["exercise_id"] == "chest-bench-press"


# --- RIR y pausa en la copia (`routine-exercise-intensity`) -------------------


def test_la_copia_hereda_el_rir_y_la_pausa_de_la_plantilla(
    client, owner_user, auth_header, db_session, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client,
        headers,
        template["id"],
        [
            {
                "day_id": None,
                "muscle_groups": [],
                "exercises": [
                    {"exercise_id": "chest-bench-press", "rir": 2, "rest_seconds": 90}
                ],
            }
        ],
    )

    assignment = assign_template_copy(client, headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()

    exercise = detail["days"][0]["exercises"][0]
    assert exercise["rir"] == 2
    assert exercise["rest_seconds"] == 90


def test_editar_el_rir_de_la_copia_no_toca_la_plantilla_origen(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """Invariante I3: la copia es independiente, también en estos dos campos."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client,
        headers,
        template["id"],
        [
            {
                "day_id": None,
                "muscle_groups": [],
                "exercises": [
                    {"exercise_id": "chest-bench-press", "rir": 2, "rest_seconds": 90}
                ],
            }
        ],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()

    response = client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/days",
        json={
            "days": [
                {
                    "day_id": detail["days"][0]["day_id"],
                    "muscle_groups": [],
                    "exercises": [
                        {"exercise_id": "chest-bench-press", "rir": 0, "rest_seconds": 180}
                    ],
                }
            ]
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text

    copy_exercise = response.json()["days"][0]["exercises"][0]
    assert (copy_exercise["rir"], copy_exercise["rest_seconds"]) == (0, 180)

    template_detail = client.get(f"/routines/templates/{template['id']}", headers=headers).json()
    template_exercise = template_detail["days"][0]["exercises"][0]
    assert (template_exercise["rir"], template_exercise["rest_seconds"]) == (2, 90)
