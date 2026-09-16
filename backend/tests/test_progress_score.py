"""`_progress_score`: puntaje 0-100 del reporte de progreso (`GET /routines/users/{id}/progress-report`).

Antes de existir esta función el endpoint respondía 500 (NameError) en toda invocación. El
puntaje tiene que ser coherente con los umbrales de `_motivation_for_metrics` y con el corte
de color del PDF (`emerald` a partir de 65).

`member-routine-copies` (design D14): el primer parámetro pasó a ser `session_count`
(`performed_on` distintos), no `len(logs)` — con `WorkoutSetLog` en el grano de una fila
por serie (design D3), contar filas satura el componente con una sola sesión. La meta
bajó de 12 (registros) a 4 (sesiones); los asserts de acá usan valores en el grano nuevo.
"""

from datetime import date, timedelta

from app import models
from app.routers.routines import _progress_score
from tests.helpers import OWNER_EMAIL, assign_template_copy, create_exercise, create_user, mark_set


def test_sin_actividad_da_cero():
    assert _progress_score(0, 0, 0) == 0


def test_valores_negativos_no_restan():
    assert _progress_score(-5, -1, -2) == 0


def test_satura_en_cien_aunque_supere_las_metas():
    assert _progress_score(500, 200, 40) == 100
    assert _progress_score(4, 8, 3) == 100


def test_constancia_excelente_pinta_verde():
    # 4 sesiones y 8 asistencias sin mejoras: el texto dice "excelente constancia",
    # el número tiene que cruzar el umbral verde del PDF (65).
    assert _progress_score(4, 8, 0) == 70


def test_buen_comienzo_queda_en_ambar():
    assert _progress_score(1, 1, 0) < 65


def test_cada_componente_suma_de_forma_independiente():
    assert _progress_score(4, 0, 0) == 40
    assert _progress_score(0, 8, 0) == 30
    assert _progress_score(0, 0, 3) == 30


# --- Grano del componente de "entrenamientos" (`member-routine-copies`, design
# D14): cuenta **sesiones** (`performed_on` distintos), no filas de
# `WorkoutSetLog`. Estos dos casos son los que distinguen el grano viejo del
# nuevo — con `len(logs)` (grano viejo) darían el mismo resultado.


def _insert_set_log(db_session, *, member_id, exercise_id, set_index, performed_on, weight_kg=40.0):
    from app import models as app_models

    db_session.add(
        app_models.WorkoutSetLog(
            user_id=member_id,
            assignment_day_id=None,
            day_name="Día 1",
            exercise_id=exercise_id,
            set_index=set_index,
            reps=8,
            weight_kg=weight_kg,
            performed_on=performed_on,
            created_by_user_id=member_id,
        )
    )


def test_una_sola_sesion_con_muchas_series_no_satura_el_componente_de_entrenamientos(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """4 ejercicios x 3 series, todos el **mismo día** (12 filas, una sola
    sesión): el componente da 10 de 40 (`_SCORE_SESSION_GOAL = 4`), no 40. Con
    el grano viejo (`len(logs)`) estas 12 filas saturarían el componente por
    su cuenta — es exactamente el defecto que D14 corrige."""
    headers = auth_header(OWNER_EMAIL)
    member = create_user(
        db_session, email="miembro-una-sesion@example.com", first_name="Miembro", role=models.UserRole.member
    )
    create_exercise(db_session, id="back-lat-pulldown", name="Jalón al pecho", muscle_group="Espalda")
    today = date.today()
    exercise_ids = ["chest-bench-press", "chest-cable-fly", "legs-back-squat", "back-lat-pulldown"]
    for exercise_id in exercise_ids:
        for set_index in range(1, 4):
            _insert_set_log(
                db_session, member_id=member.id, exercise_id=exercise_id, set_index=set_index, performed_on=today
            )
    db_session.commit()

    response = client.get(f"/routines/users/{member.id}/progress-summary", headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["session_count"] == 1
    assert body["score"] == 10


def test_cuatro_sesiones_de_una_serie_saturan_el_componente_de_entrenamientos(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """4 sesiones de una sola serie cada una (4 filas, 4 días distintos):
    saturan el componente en 40 de 40. Con el grano viejo, 4 filas quedarían
    lejos de las 12 que hacían falta — el mismo dato produce un resultado
    opuesto al caso de arriba, según qué se cuente."""
    headers = auth_header(OWNER_EMAIL)
    member = create_user(
        db_session, email="miembro-cuatro-sesiones@example.com", first_name="Miembro", role=models.UserRole.member
    )
    today = date.today()
    for offset in range(4):
        _insert_set_log(
            db_session,
            member_id=member.id,
            exercise_id="chest-bench-press",
            set_index=1,
            performed_on=today - timedelta(days=offset),
        )
    db_session.commit()

    response = client.get(f"/routines/users/{member.id}/progress-summary", headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["session_count"] == 4
    assert body["score"] == 40


# --- `total_volume` en el grano nuevo de `WorkoutSetLog` (`member-routine-copies`,
# design D3): `Σ reps × weight_kg` de cada marca, sin ningún factor `sets_count`.


def test_el_volumen_total_se_calcula_por_serie_marcada(
    client, owner_user, auth_header, db_session, catalog_basic
):
    """Dos marcas de la misma serie planificada (`set_index=1`), en dos
    sesiones distintas y con pesos distintos: el total tiene que ser la suma
    simple `reps × weight_kg` de cada una — si alguien reintroduce un factor
    `sets_count`, este número deja de coincidir."""
    headers = auth_header(OWNER_EMAIL)
    member = create_user(
        db_session, email="miembro-volumen@example.com", first_name="Miembro", role=models.UserRole.member
    )
    template = client.post("/routines/templates", json={"name": "Volumen", "tag": ""}, headers=headers).json()
    client.put(
        f"/routines/templates/{template['id']}/days",
        json={"days": [{"day_id": None, "muscle_groups": [], "exercises": [{"exercise_id": "chest-bench-press"}]}]},
        headers=headers,
    )
    assignment = assign_template_copy(client, headers, member.id, template["id"])
    detail = client.get(f"/routines/users/{member.id}/templates/{assignment['id']}", headers=headers).json()
    day_id = detail["days"][0]["day_id"]

    member_headers = auth_header(member.email)
    mark_set(client, member_headers, day_id, "chest-bench-press", 1, weight_kg=40, reps=8)  # hoy

    db_session.add(
        models.WorkoutSetLog(
            user_id=member.id,
            assignment_day_id=day_id,
            day_name="Día 1",
            exercise_id="chest-bench-press",
            set_index=1,
            reps=10,
            weight_kg=50,
            performed_on=date.today() - timedelta(days=1),
            created_by_user_id=member.id,
        )
    )
    db_session.commit()

    response = client.get(f"/routines/users/{member.id}/progress-summary", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["total_volume"] == 40 * 8 + 50 * 10
