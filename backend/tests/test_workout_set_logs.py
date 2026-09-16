"""Tests de `PUT /routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}`
(`routine-progress-tracking`, `member-routine-copies`, design D3/D6): marcar o
corregir una serie de la copia propia. Grano una fila = una serie
(`WorkoutSetLog`), invariantes I7..I10, I14, I15, I17.
"""

from datetime import date, timedelta

from app import models
from tests.helpers import OWNER_EMAIL, assign_template_copy, create_user, mark_set


def _create_template(client, headers, *, name="Fuerza 4 días"):
    response = client.post("/routines/templates", json={"name": name, "tag": ""}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _save_days(client, headers, template_id, days):
    response = client.put(f"/routines/templates/{template_id}/days", json={"days": days}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _create_member(db_session, email="miembro-set-logs@example.com"):
    return create_user(db_session, email=email, first_name="Miembro", role=models.UserRole.member)


def _assignment_day_id(client, headers, user_id, assignment_id):
    detail = client.get(f"/routines/users/{user_id}/templates/{assignment_id}", headers=headers).json()
    return detail["days"][0]["day_id"]


def test_marcar_una_serie_registra_el_peso_y_las_reps_reales(
    client, owner_user, auth_header, db_session, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    body = mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=42.5, reps=8)

    assert body["exercise_id"] == "chest-bench-press"
    assert body["set_index"] == 1
    assert body["weight_kg"] == 42.5
    assert body["reps"] == 8
    assert body["performed_on"] == date.today().isoformat()


def test_remarcar_la_misma_serie_el_mismo_dia_corrige_en_vez_de_duplicar(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I9: `UNIQUE(user_id, assignment_day_id, exercise_id, set_index, performed_on)`."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=10)
    corrected = mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=45, reps=6)

    assert corrected["weight_kg"] == 45
    assert corrected["reps"] == 6

    rows = (
        db_session.query(models.WorkoutSetLog)
        .filter(
            models.WorkoutSetLog.user_id == member.id,
            models.WorkoutSetLog.assignment_day_id == day_id,
            models.WorkoutSetLog.exercise_id == "chest-bench-press",
            models.WorkoutSetLog.set_index == 1,
        )
        .all()
    )
    assert len(rows) == 1
    assert rows[0].weight_kg == 45


def test_marcar_una_serie_mas_alla_de_las_planificadas_es_400(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I8: base por defecto es 3 series constantes — la 4ta no está planificada."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    response = client.put(
        f"/routines/my/days/{day_id}/exercises/chest-bench-press/sets/4",
        json={"weight_kg": 40, "reps": 8},
        headers=member_headers,
    )

    assert response.status_code == 400, response.text


def test_marcar_un_ejercicio_que_no_esta_en_la_copia_es_400(
    client, owner_user, auth_header, db_session, catalog_basic
):
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    response = client.put(
        # "legs-back-squat" existe en el catálogo pero no está en este día de la copia.
        f"/routines/my/days/{day_id}/exercises/legs-back-squat/sets/1",
        json={"weight_kg": 40, "reps": 8},
        headers=member_headers,
    )

    assert response.status_code == 400, response.text


def test_un_miembro_no_puede_marcar_sobre_el_dia_de_otro_miembro(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I10: pedir el día de otro Miembro es indistinguible de pedir uno inexistente (400)."""
    headers = auth_header(OWNER_EMAIL)
    member_a = _create_member(db_session, email="miembro-set-logs-a@example.com")
    member_b = _create_member(db_session, email="miembro-set-logs-b@example.com")
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment_a = assign_template_copy(client, headers, member_a.id, template["id"])
    day_a_id = _assignment_day_id(client, headers, member_a.id, assignment_a["id"])

    other_headers = auth_header(member_b.email)
    response = client.put(
        f"/routines/my/days/{day_a_id}/exercises/chest-bench-press/sets/1",
        json={"weight_kg": 40, "reps": 8},
        headers=other_headers,
    )

    assert response.status_code == 400, response.text


def test_reducir_las_series_conserva_las_marcas_previas_fuera_del_plan_vigente(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I7: reducir la base de un ejercicio en la copia no borra las marcas que
    quedan fuera del plan recalculado."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [
            {"exercise_id": "chest-bench-press", "base": {"sets": 4, "reps": 8, "weight_kg": 40}}
        ]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    for set_index in range(1, 5):
        mark_set(client, member_headers, day_id, "chest-bench-press", set_index, weight_kg=40, reps=8)

    # Reducir la base a 2 series.
    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/days",
        json={"days": [{"day_id": day_id, "muscle_groups": [], "exercises": [
            {"exercise_id": "chest-bench-press", "base": {"sets": 2, "reps": 8, "weight_kg": 40}}
        ]}]},
        headers=headers,
    )

    plan = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers).json()
    exercise = plan["days"][0]["exercises"][0]
    assert len(exercise["planned_sets"]) == 2

    logs = client.get("/routines/my/logs", headers=member_headers).json()
    assert len(logs) == 4
    assert sorted(item["set_index"] for item in logs) == [1, 2, 3, 4]


def test_quitar_un_dia_de_la_copia_deja_las_marcas_con_day_id_nulo_y_day_name(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I7: quitar un día entero de la copia desvincula la FK (`SET NULL`,
    observable con `PRAGMA foreign_keys=ON` de `conftest.py`) sin borrar el
    histórico ni su `day_name`. **Grupos musculares no vacíos a propósito**
    (D3, corrección post-gate): con `muscle_groups: []` `day_title(...)` y
    `f"Día {position}"` dan el mismo string y el caso pasaría igual con
    `day_name` armado a partir de los grupos musculares en vez del snapshot
    de la posición."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [
            {"day_id": None, "muscle_groups": ["Pecho"], "exercises": [{"exercise_id": "chest-bench-press"}]},
            {"day_id": None, "muscle_groups": [], "exercises": []},
        ],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    detail = client.get(
        f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers
    ).json()
    day_one_id = detail["days"][0]["day_id"]
    day_two_id = detail["days"][1]["day_id"]

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_one_id, "chest-bench-press", 1, weight_kg=40, reps=8)

    # Quitar el Día 1 (dejar solo el Día 2).
    client.put(
        f"/routines/users/{member.id}/templates/{assignment['id']}/days",
        json={"days": [{"day_id": day_two_id, "muscle_groups": [], "exercises": []}]},
        headers=headers,
    )

    logs = client.get("/routines/my/logs", headers=member_headers).json()
    assert len(logs) == 1
    assert logs[0]["assignment_day_id"] is None
    assert logs[0]["day_name"] == "Día 1"


def test_el_plan_del_miembro_trae_marcadas_solo_las_series_de_hoy(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I14: `logged` solo se adjunta a la marca de **hoy**; una marca de otra
    fecha no debe aparecer en el plan."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [
            {"exercise_id": "chest-bench-press", "base": {"sets": 2, "reps": 8, "weight_kg": 40}}
        ]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=8)

    # Serie #2, marcada ayer (directo en la base: `mark_set` siempre usa hoy).
    db_session.add(
        models.WorkoutSetLog(
            user_id=member.id,
            assignment_day_id=day_id,
            day_name="Día 1",
            exercise_id="chest-bench-press",
            set_index=2,
            reps=8,
            weight_kg=38,
            performed_on=date.today() - timedelta(days=1),
            created_by_user_id=member.id,
        )
    )
    db_session.commit()

    plan = client.get(f"/routines/my/templates/{assignment['id']}", headers=member_headers).json()
    planned_sets = plan["days"][0]["exercises"][0]["planned_sets"]
    assert planned_sets[0]["logged"] is not None
    assert planned_sets[0]["logged"]["weight_kg"] == 40
    assert planned_sets[1]["logged"] is None


def test_un_miembro_sin_asignacion_activa_puede_marcar_sobre_una_alternativa(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I15: una copia Alternativa real y única (sin ninguna Activa) sigue
    siendo entrenable."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"], status="alternative")
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    body = mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=8)

    assert body["weight_kg"] == 40


def test_marcar_una_serie_no_crea_ninguna_asistencia(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """I17: marcar progreso no registra asistencia, comparando el conteo antes
    y después (no solo "está vacío")."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    # Una asistencia previa no relacionada, para que el conteo no arranque en 0.
    db_session.add(models.Attendance(user_id=member.id))
    db_session.commit()
    before = db_session.query(models.Attendance).count()

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=8)

    after = db_session.query(models.Attendance).count()
    assert after == before


def test_marcar_la_misma_serie_dos_veces_en_paralelo_no_devuelve_500(
    client, owner_user, auth_header, db_session, catalog_basic, monkeypatch
):
    """I23: dos requests solapados del mismo `PUT .../sets/{set_index}` no
    pueden pisarse en un `IntegrityError` sin capturar. Se simula la carrera
    parcheando `Query.first` para que la primera consulta de `WorkoutSetLog`
    dentro del endpoint devuelva `None` (como si el `SELECT` corriera antes
    de que la fila del otro request existiera), mientras la fila **ya**
    existe en la base (insertada directo, simulando el primer request ya
    aplicado) — el `INSERT` del endpoint choca contra el `UNIQUE` y el
    endpoint tiene que recuperarse en vez de devolver 500."""
    from sqlalchemy.orm import Query

    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    # El "primer request" ya aplicó su marca y quedó commiteada.
    db_session.add(
        models.WorkoutSetLog(
            user_id=member.id,
            assignment_day_id=day_id,
            day_name="Día 1",
            exercise_id="chest-bench-press",
            set_index=1,
            reps=5,
            weight_kg=99,
            performed_on=date.today(),
            created_by_user_id=member.id,
        )
    )
    db_session.commit()

    original_first = Query.first
    calls = {"count": 0}

    def _patched_first(self):
        descriptions = self.column_descriptions
        if (
            calls["count"] == 0
            and descriptions
            and descriptions[0].get("type") is models.WorkoutSetLog
        ):
            calls["count"] += 1
            return None
        return original_first(self)

    monkeypatch.setattr(Query, "first", _patched_first)

    member_headers = auth_header(member.email)
    response = client.put(
        f"/routines/my/days/{day_id}/exercises/chest-bench-press/sets/1",
        json={"weight_kg": 42, "reps": 6},
        headers=member_headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["weight_kg"] == 42
    assert response.json()["reps"] == 6

    rows = db_session.query(models.WorkoutSetLog).filter(models.WorkoutSetLog.user_id == member.id).all()
    assert len(rows) == 1
    assert rows[0].weight_kg == 42
    assert rows[0].reps == 6


def test_el_day_name_guardado_es_la_posicion_sin_los_grupos_musculares(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """`day_name` es el snapshot de `"Día {position}"` (D3, corrección
    post-gate), no el título con grupos musculares. **Grupos musculares no
    vacíos a propósito**: con `muscle_groups: []` las dos implementaciones
    producen el mismo string y el caso pasaría con el código roto."""
    headers = auth_header(OWNER_EMAIL)
    member = _create_member(db_session)
    template = _create_template(client, headers)
    _save_days(
        client, headers, template["id"],
        [{"day_id": None, "muscle_groups": ["Pecho"], "exercises": [{"exercise_id": "chest-bench-press"}]}],
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    day_id = _assignment_day_id(client, headers, member.id, assignment["id"])

    member_headers = auth_header(member.email)
    body = mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=8)

    assert body["day_name"] == "Día 1"
