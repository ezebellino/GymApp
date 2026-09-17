"""Tests de `backend/app/routers/routine_templates.py` (capability
`routine-templates`, `template-owned-routine-days`, motor de progresión
aplicado vía `progression-strategies`).
"""

from app import models
from tests.helpers import COACH_EMAIL, OWNER_EMAIL, assign_template_copy, create_user


def _create_template(client, headers, *, name="Fuerza 4 días", tag="FUERZA"):
    """`POST /routines/templates` (design D6): solo `{name, tag}`, nace con el
    Día 1 ya presente. Configurar días/ejercicios pasa por `_save_days`."""
    response = client.post(
        "/routines/templates",
        json={"name": name, "tag": tag},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _save_days(client, headers, template_id, days):
    return client.put(
        f"/routines/templates/{template_id}/days",
        json={"days": days},
        headers=headers,
    )


def _day_payload(*, day_id=None, muscle_groups=None, exercises=None):
    return {
        "day_id": day_id,
        "muscle_groups": muscle_groups or [],
        "exercises": exercises or [],
    }


def _exercise_payload(exercise_id, *, strategy=None, base=None, rir=None, rest_seconds=None):
    payload = {"exercise_id": exercise_id}
    if strategy is not None:
        payload["strategy"] = strategy
    if base is not None:
        payload["base"] = base
    # `rir`/`rest_seconds` son de reemplazo, no de "ausente ⇒ conservar": el
    # helper los omite solo para no ensuciar los payloads de los tests que no
    # los usan (donde el default `None` del schema hace lo mismo).
    if rir is not None:
        payload["rir"] = rir
    if rest_seconds is not None:
        payload["rest_seconds"] = rest_seconds
    return payload


# --- Alta (design D6, invariante I1) -----------------------------------------


def test_crear_plantilla_solo_con_nombre_y_etiqueta_nace_con_el_dia_1(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    body = _create_template(client, headers, name="Full body inicial", tag="INICIO")

    assert body["name"] == "Full body inicial"
    assert body["tag"] == "INICIO"
    assert len(body["days"]) == 1
    assert body["days"][0]["position"] == 1
    assert body["days"][0]["name"] == "Día 1"
    assert body["days"][0]["muscle_groups"] == []
    assert body["days"][0]["exercises"] == []


def test_crear_plantilla_con_day_ids_en_el_payload_es_422(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/routines/templates",
        json={"name": "Plantilla con day_ids", "tag": "", "day_ids": ["day-1"]},
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


def test_rechaza_un_nombre_duplicado_ignorando_mayusculas(client, coach_user, auth_header):
    headers = auth_header(COACH_EMAIL)
    _create_template(client, headers, name="Fuerza 4 días")

    response = client.post(
        "/routines/templates",
        json={"name": "FUERZA 4 DÍAS", "tag": ""},
        headers=headers,
    )

    assert response.status_code == 409, response.text
    assert "nombre" in response.json()["detail"].lower()


def test_rechaza_un_nombre_duplicado_ignorando_espacios_en_los_bordes(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    _create_template(client, headers, name="Fuerza 4 días")
    other = _create_template(client, headers, name="Otra plantilla")

    response = client.patch(
        f"/routines/templates/{other['id']}",
        json={"name": " Fuerza 4 días "},
        headers=headers,
    )

    assert response.status_code == 409, response.text
    assert "nombre" in response.json()["detail"].lower()


# --- Guardado del borrador: días (design D5, invariantes I1, I2, I11) -------


def test_guardar_el_borrador_persiste_dias_grupos_y_ejercicios_en_un_solo_request(
    client, owner_user, auth_header, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(
                muscle_groups=["Pecho"],
                exercises=[_exercise_payload("chest-bench-press"), _exercise_payload("chest-cable-fly")],
            ),
            _day_payload(muscle_groups=["Cuádriceps"], exercises=[_exercise_payload("legs-back-squat")]),
        ],
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["days"]) == 2
    assert body["days"][0]["muscle_groups"] == ["Pecho"]
    assert [item["exercise_id"] for item in body["days"][0]["exercises"]] == [
        "chest-bench-press",
        "chest-cable-fly",
    ]
    assert body["days"][1]["muscle_groups"] == ["Cuádriceps"]
    assert [item["exercise_id"] for item in body["days"][1]["exercises"]] == ["legs-back-squat"]


def test_guardar_un_sexto_dia_es_422_y_no_persiste_nada(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = _save_days(client, headers, template["id"], [_day_payload() for _ in range(6)])

    assert response.status_code == 422, response.text
    assert db_session.query(models.RoutineTemplateDay).filter(
        models.RoutineTemplateDay.template_id == template["id"]
    ).count() == 1


def test_guardar_cero_dias_es_422_y_la_plantilla_conserva_sus_dias(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = _save_days(client, headers, template["id"], [])

    assert response.status_code == 422, response.text
    assert db_session.query(models.RoutineTemplateDay).filter(
        models.RoutineTemplateDay.template_id == template["id"]
    ).count() == 1


def test_un_dia_que_no_cambia_conserva_su_id_entre_guardados(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    first = _save_days(
        client, headers, template["id"], [_day_payload(muscle_groups=["Pecho"])]
    ).json()
    day_id = first["days"][0]["day_id"]

    second = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(day_id=day_id, muscle_groups=["Pecho"], exercises=[_exercise_payload("chest-bench-press")])],
    ).json()

    assert second["days"][0]["day_id"] == day_id


def test_quitar_un_dia_elimina_sus_grupos_musculares_y_sus_ejercicios(
    client, owner_user, auth_header, db_session, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    created = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(muscle_groups=["Pecho"], exercises=[_exercise_payload("chest-bench-press")]),
            _day_payload(muscle_groups=["Cuádriceps"], exercises=[_exercise_payload("legs-back-squat")]),
        ],
    ).json()
    day_one_id = created["days"][0]["day_id"]
    day_two_id = created["days"][1]["day_id"]

    _save_days(client, headers, template["id"], [_day_payload(day_id=day_one_id, muscle_groups=["Pecho"])])

    assert db_session.query(models.RoutineTemplateDay).filter(
        models.RoutineTemplateDay.id == day_two_id
    ).first() is None
    assert db_session.query(models.RoutineTemplateDayMuscleGroup).filter(
        models.RoutineTemplateDayMuscleGroup.template_day_id == day_two_id
    ).count() == 0
    assert db_session.query(models.RoutineTemplateDayExercise).filter(
        models.RoutineTemplateDayExercise.template_day_id == day_two_id
    ).count() == 0


def test_quitar_un_dia_intermedio_renumera_las_posiciones_de_forma_contigua(
    client, owner_user, auth_header
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    created = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(muscle_groups=["Pecho"]), _day_payload(muscle_groups=["Espalda"]), _day_payload(muscle_groups=["Core"])],
    ).json()
    day_one_id = created["days"][0]["day_id"]
    day_three_id = created["days"][2]["day_id"]

    result = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(day_id=day_one_id, muscle_groups=["Pecho"]),
            _day_payload(day_id=day_three_id, muscle_groups=["Core"]),
        ],
    ).json()

    assert [day["position"] for day in result["days"]] == [1, 2]
    assert [day["day_id"] for day in result["days"]] == [day_one_id, day_three_id]
    assert result["days"][1]["name"] == "Día 2 - Core"


def test_editar_un_dia_de_una_plantilla_no_toca_los_dias_de_otra(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template_a = _create_template(client, headers, name="Plantilla A")
    template_b = _create_template(client, headers, name="Plantilla B")

    _save_days(
        client, headers, template_a["id"],
        [_day_payload(muscle_groups=["Pecho"], exercises=[_exercise_payload("chest-bench-press")])],
    )
    before_b = client.get(f"/routines/templates/{template_b['id']}", headers=headers).json()

    day_a_id = client.get(f"/routines/templates/{template_a['id']}", headers=headers).json()["days"][0]["day_id"]
    _save_days(
        client, headers, template_a["id"],
        [_day_payload(day_id=day_a_id, muscle_groups=["Espalda"])],
    )

    after_b = client.get(f"/routines/templates/{template_b['id']}", headers=headers).json()
    assert after_b == before_b


# --- Base y estrategia por par (día, ejercicio) (design D5/D9, I5) -----------


def test_agregar_un_ejercicio_arranca_en_3x10_0kg_y_estrategia_constante(
    client, owner_user, auth_header, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    result = _save_days(
        client, headers, template["id"], [_day_payload(exercises=[_exercise_payload("chest-bench-press")])]
    ).json()

    exercise = result["days"][0]["exercises"][0]
    assert exercise["base"] == {"sets": 3, "reps": 10, "weight_kg": 0}
    assert exercise["strategy"] == "constant"


def test_editar_la_base_de_un_ejercicio_de_un_dia_no_toca_la_del_mismo_ejercicio_en_otro_dia(
    client, owner_user, auth_header, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    created = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(exercises=[_exercise_payload("chest-bench-press")]),
            _day_payload(exercises=[_exercise_payload("chest-bench-press")]),
        ],
    ).json()
    day_one_id = created["days"][0]["day_id"]
    day_two_id = created["days"][1]["day_id"]

    result = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(
                day_id=day_one_id,
                exercises=[_exercise_payload("chest-bench-press", base={"sets": 5, "reps": 5, "weight_kg": 80})],
            ),
            _day_payload(day_id=day_two_id, exercises=[_exercise_payload("chest-bench-press")]),
        ],
    ).json()

    day_one = next(day for day in result["days"] if day["day_id"] == day_one_id)
    day_two = next(day for day in result["days"] if day["day_id"] == day_two_id)
    assert day_one["exercises"][0]["base"] == {"sets": 5, "reps": 5, "weight_kg": 80}
    assert day_two["exercises"][0]["base"] == {"sets": 3, "reps": 10, "weight_kg": 0}


def test_el_mismo_ejercicio_en_dos_plantillas_mantiene_bases_y_estrategias_independientes(
    client, owner_user, auth_header, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    template_a = _create_template(client, headers, name="Plantilla A")
    template_b = _create_template(client, headers, name="Plantilla B")

    _save_days(
        client, headers, template_a["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press", strategy="pyramid")])],
    )
    _save_days(
        client, headers, template_b["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press")])],
    )

    detail_a = client.get(f"/routines/templates/{template_a['id']}", headers=headers).json()
    detail_b = client.get(f"/routines/templates/{template_b['id']}", headers=headers).json()

    assert detail_a["days"][0]["exercises"][0]["strategy"] == "pyramid"
    assert detail_b["days"][0]["exercises"][0]["strategy"] == "constant"


# --- Orden, unicidad e identidad de días ajenos (design D5, I3, I11) --------


def test_el_orden_de_los_ejercicios_del_payload_se_persiste_como_sort_order(
    client, owner_user, auth_header, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    result = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(
                exercises=[
                    _exercise_payload("legs-back-squat"),
                    _exercise_payload("chest-bench-press"),
                    _exercise_payload("chest-cable-fly"),
                ]
            )
        ],
    ).json()

    assert [item["exercise_id"] for item in result["days"][0]["exercises"]] == [
        "legs-back-squat",
        "chest-bench-press",
        "chest-cable-fly",
    ]

    reordered = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(
                day_id=result["days"][0]["day_id"],
                exercises=[
                    _exercise_payload("chest-cable-fly"),
                    _exercise_payload("legs-back-squat"),
                    _exercise_payload("chest-bench-press"),
                ],
            )
        ],
    ).json()
    assert [item["exercise_id"] for item in reordered["days"][0]["exercises"]] == [
        "chest-cable-fly",
        "legs-back-squat",
        "chest-bench-press",
    ]


def test_repetir_un_ejercicio_dentro_del_mismo_dia_es_422(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press"), _exercise_payload("chest-bench-press")])],
    )

    assert response.status_code == 422, response.text


def test_repetir_un_day_id_dentro_del_mismo_guardado_es_422_y_no_persiste_nada(
    client, owner_user, auth_header, db_session
):
    """Un `day_id` no nulo repetido en el payload no puede colapsar dos días
    en una sola fila (rompería I1: posiciones contiguas 1..N)."""
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)
    day_id = template["days"][0]["day_id"]

    response = _save_days(
        client, headers, template["id"], [_day_payload(day_id=day_id), _day_payload(day_id=day_id)]
    )

    assert response.status_code == 422, response.text
    days_after = db_session.query(models.RoutineTemplateDay).filter(
        models.RoutineTemplateDay.template_id == template["id"]
    ).all()
    assert len(days_after) == 1
    assert days_after[0].id == day_id
    assert days_after[0].position == 1


def test_guardar_un_dia_que_es_de_otra_plantilla_es_400(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template_a = _create_template(client, headers, name="Plantilla A")
    template_b = _create_template(client, headers, name="Plantilla B")
    day_a_id = template_a["days"][0]["day_id"]

    response = _save_days(client, headers, template_b["id"], [_day_payload(day_id=day_a_id)])

    assert response.status_code == 400, response.text


def test_agregar_un_ejercicio_inactivo_es_400_pero_el_ya_agregado_sigue_en_el_detalle(
    client, owner_user, auth_header
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)
    exercise = client.post(
        "/exercises/",
        json={"name": "Ejercicio para desactivar (test)", "muscle_group": "Pecho"},
        headers=headers,
    ).json()

    added = _save_days(
        client, headers, template["id"], [_day_payload(exercises=[_exercise_payload(exercise["id"])])]
    ).json()
    day_id = added["days"][0]["day_id"]

    deactivate = client.post(f"/exercises/{exercise['id']}/deactivate", headers=headers)
    assert deactivate.status_code == 200, deactivate.text

    # El ejercicio ya agregado sigue en el detalle sin volver a mandarlo:
    # guardar el mismo día sin tocar la lista de ejercicios lo conserva.
    unchanged = _save_days(
        client, headers, template["id"],
        [_day_payload(day_id=day_id, exercises=[_exercise_payload(exercise["id"])])],
    )
    assert unchanged.status_code == 200, unchanged.text
    assert exercise["id"] in [item["exercise_id"] for item in unchanged.json()["days"][0]["exercises"]]

    # Pero agregarlo como par nuevo en otro día sí es 400 (está inactivo).
    other_template = _create_template(client, headers, name="Otra plantilla")
    response = _save_days(
        client, headers, other_template["id"],
        [_day_payload(exercises=[_exercise_payload(exercise["id"])])],
    )
    assert response.status_code == 400, response.text


def test_un_coach_puede_guardar_el_borrador_y_un_miembro_recibe_403(
    client, owner_user, coach_user, auth_header, db_session
):
    owner_headers = auth_header(OWNER_EMAIL)
    coach_headers = auth_header(COACH_EMAIL)
    template = _create_template(client, owner_headers)

    coach_response = _save_days(client, coach_headers, template["id"], [_day_payload(muscle_groups=["Pecho"])])
    assert coach_response.status_code == 200, coach_response.text

    create_user(
        db_session,
        email="miembro-sin-acceso-guardado@example.com",
        first_name="Miembro",
        role=models.UserRole.member,
    )
    member_headers = auth_header("miembro-sin-acceso-guardado@example.com")
    member_response = _save_days(client, member_headers, template["id"], [_day_payload()])
    assert member_response.status_code == 403, member_response.text


# --- Borrado y estrategia (sin cambios de contrato) --------------------------


def test_eliminar_una_plantilla_sin_asignaciones(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = client.delete(f"/routines/templates/{template['id']}", headers=headers)
    assert response.status_code == 204, response.text

    missing = client.get(f"/routines/templates/{template['id']}", headers=headers)
    assert missing.status_code == 404


def test_borrar_una_plantilla_con_una_copia_activa_es_409_y_lo_dice_en_el_mensaje(
    client, owner_user, auth_header, db_session
):
    """I16: borrar se rechaza si y solo si hay al menos una copia **Activa**."""
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)
    member = create_user(
        db_session,
        email="miembro-plantillas-activa@example.com",
        first_name="Miembro",
        role=models.UserRole.member,
    )
    assign_template_copy(client, headers, member.id, template["id"], status="active")

    response = client.delete(f"/routines/templates/{template['id']}", headers=headers)

    assert response.status_code == 409, response.text
    assert "1" in response.json()["detail"]
    assert "activa" in response.json()["detail"].lower()


def test_borrar_una_plantilla_con_solo_copias_alternativas_la_elimina(
    client, owner_user, auth_header, db_session
):
    """I16: una plantilla con solo copias Alternativas se puede eliminar (a
    diferencia de la guardia vieja, que bloqueaba con cualquier asignación).
    Fixture separado del anterior (Activa vs. Alternativa degradada) para que
    el par distinga la guardia nueva de la vieja."""
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)
    member = create_user(
        db_session,
        email="miembro-plantillas-alternativa@example.com",
        first_name="Miembro",
        role=models.UserRole.member,
    )
    assign_template_copy(client, headers, member.id, template["id"], status="alternative")

    response = client.delete(f"/routines/templates/{template['id']}", headers=headers)

    assert response.status_code == 204, response.text


def test_cambiar_la_estrategia_devuelve_el_plan_recalculado(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)
    created = _save_days(
        client, headers, template["id"],
        [_day_payload(exercises=[_exercise_payload(
            "chest-bench-press", base={"sets": 4, "reps": 8, "weight_kg": 45}
        )])],
    ).json()
    day_id = created["days"][0]["day_id"]

    response = _save_days(
        client, headers, template["id"],
        [_day_payload(day_id=day_id, exercises=[_exercise_payload("chest-bench-press", strategy="rest_pause")])],
    )

    assert response.status_code == 200, response.text
    exercise = response.json()["days"][0]["exercises"][0]
    assert exercise["strategy"] == "rest_pause"
    planned = exercise["planned_sets"]
    assert [item["reps"] for item in planned] == [8, 7, 6, 5]
    assert planned[1]["note"] == "20 s"


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


# --- RIR y pausa (`routine-exercise-intensity`) -------------------------------


def test_un_ejercicio_sin_rir_ni_pausa_los_devuelve_en_null(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    result = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press")])],
    ).json()

    exercise = result["days"][0]["exercises"][0]
    assert exercise["rir"] is None
    assert exercise["rest_seconds"] is None


def test_guardar_rir_y_pausa_de_un_ejercicio_los_persiste(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    result = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(
                exercises=[_exercise_payload("chest-bench-press", rir=2, rest_seconds=90)]
            )
        ],
    ).json()

    exercise = result["days"][0]["exercises"][0]
    assert exercise["rir"] == 2
    assert exercise["rest_seconds"] == 90


def test_el_rir_admite_medios(client, owner_user, auth_header, catalog_basic):
    """RIR 1.5 es RPE 8.5: la escala admite medios, por eso la columna es Float."""
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    result = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press", rir=1.5)])],
    ).json()

    assert result["days"][0]["exercises"][0]["rir"] == 1.5


def test_guardar_sin_rir_borra_el_que_habia(client, owner_user, auth_header, catalog_basic):
    """Reemplazo, no "ausente ⇒ conservar" (a diferencia de `base`/`strategy`):
    el borrador manda siempre el estado completo, así que quitar la
    prescripción en la UI tiene que borrarla en el servidor."""
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    created = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press", rir=2, rest_seconds=90)])],
    ).json()
    day_id = created["days"][0]["day_id"]

    result = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(day_id=day_id, exercises=[_exercise_payload("chest-bench-press")])],
    ).json()

    exercise = result["days"][0]["exercises"][0]
    assert exercise["rir"] is None
    assert exercise["rest_seconds"] is None


def test_un_rir_fuera_de_la_escala_0_10_es_422(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press", rir=11)])],
    )

    assert response.status_code == 422, response.text


def test_una_pausa_negativa_es_422(client, owner_user, auth_header, catalog_basic):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    response = _save_days(
        client,
        headers,
        template["id"],
        [_day_payload(exercises=[_exercise_payload("chest-bench-press", rest_seconds=-1)])],
    )

    assert response.status_code == 422, response.text


def test_el_rir_y_la_pausa_de_un_dia_no_tocan_los_del_mismo_ejercicio_en_otro_dia(
    client, owner_user, auth_header, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    template = _create_template(client, headers)

    created = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(exercises=[_exercise_payload("chest-bench-press")]),
            _day_payload(exercises=[_exercise_payload("chest-bench-press")]),
        ],
    ).json()
    day_one_id = created["days"][0]["day_id"]
    day_two_id = created["days"][1]["day_id"]

    result = _save_days(
        client,
        headers,
        template["id"],
        [
            _day_payload(
                day_id=day_one_id,
                exercises=[_exercise_payload("chest-bench-press", rir=3, rest_seconds=120)],
            ),
            _day_payload(day_id=day_two_id, exercises=[_exercise_payload("chest-bench-press")]),
        ],
    ).json()

    day_one = next(day for day in result["days"] if day["day_id"] == day_one_id)
    day_two = next(day for day in result["days"] if day["day_id"] == day_two_id)
    assert (day_one["exercises"][0]["rir"], day_one["exercises"][0]["rest_seconds"]) == (3, 120)
    assert day_two["exercises"][0]["rir"] is None
    assert day_two["exercises"][0]["rest_seconds"] is None
