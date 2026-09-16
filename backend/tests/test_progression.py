"""Tests del motor de progresión (`app/progression.py`, capability `progression-strategies`)
y de `GET /routines/progression/preview` (`member-routine-copies`, design D13).

Las primeras clases son función pura: no usan `client` ni `db_session`, solo `plan_sets`.
Los valores exactos son los escenarios numéricos de
`openspec/changes/add-routine-templates/specs/progression-strategies/spec.md`,
incluidos los tres pisos de borde (Pirámide 3 reps, Rest-pause 1 rep, Invertida
2,5 kg) y el redondeo half-up de `1,5 × R` con R impar. Los tests del endpoint de
previsualización sí usan `client`/`db_session`: verifican que el endpoint sin
estado no diverge del `PUT` de guardado (el punto de toda la decisión D13).
"""

from decimal import Decimal

from app import models
from app.models import ProgressionStrategy
from app.progression import plan_sets, round_to_weight_step
from tests.helpers import OWNER_EMAIL, create_user


def _as_tuples(planned):
    """(weight_kg, reps, note) por serie, para comparar contra la spec sin acoplar
    el test al orden de los campos del dataclass."""
    return [(item.weight_kg, item.reps, item.note) for item in planned]


def test_constante_repite_la_base_en_todas_las_series():
    planned = plan_sets(ProgressionStrategy.constant, sets=4, reps=8, weight_kg=45)
    assert _as_tuples(planned) == [
        (45, 8, None),
        (45, 8, None),
        (45, 8, None),
        (45, 8, None),
    ]


def test_piramide_press_banca_4x8_45kg():
    planned = plan_sets(ProgressionStrategy.pyramid, sets=4, reps=8, weight_kg=45)
    assert _as_tuples(planned) == [
        (45, 8, None),
        (47.5, 6, None),
        (50, 4, None),
        (52.5, 3, None),
    ]


def test_piramide_sentadilla_5x5_70kg_respeta_el_piso_de_reps():
    planned = plan_sets(ProgressionStrategy.pyramid, sets=5, reps=5, weight_kg=70)
    assert _as_tuples(planned) == [
        (70, 5, None),
        (75, 3, None),
        (77.5, 3, None),
        (82.5, 3, None),
        (87.5, 3, None),
    ]


def test_piramide_dominadas_4x6_20kg():
    planned = plan_sets(ProgressionStrategy.pyramid, sets=4, reps=6, weight_kg=20)
    assert _as_tuples(planned) == [
        (20, 6, None),
        (20, 4, None),
        (22.5, 3, None),
        (22.5, 3, None),
    ]


def test_piramide_aperturas_3x12_14kg():
    planned = plan_sets(ProgressionStrategy.pyramid, sets=3, reps=12, weight_kg=14)
    assert _as_tuples(planned) == [
        (15, 12, None),
        (15, 10, None),
        (15, 8, None),
    ]


def test_invertida_press_banca_4x8_45kg():
    planned = plan_sets(ProgressionStrategy.inverted, sets=4, reps=8, weight_kg=45)
    assert _as_tuples(planned) == [
        (45, 8, None),
        (42.5, 10, None),
        (40, 12, None),
        (37.5, 14, None),
    ]


def test_invertida_aperturas_3x12_14kg():
    planned = plan_sets(ProgressionStrategy.inverted, sets=3, reps=12, weight_kg=14)
    assert _as_tuples(planned) == [
        (15, 12, None),
        (12.5, 14, None),
        (12.5, 16, None),
    ]


def test_invertida_respeta_el_piso_de_2_5_kg():
    planned = plan_sets(ProgressionStrategy.inverted, sets=10, reps=5, weight_kg=2.5)
    # Serie 10 (i=9): sin piso, 2,5 * (1 - 0,06*9) = 2,5 * 0,46 = 1,15 -> redondea a
    # 0 kg. Con el piso, se mantiene en 2,5 kg (spec, "Invertida respeta el piso...").
    assert planned[-1].weight_kg == 2.5
    assert planned[-1].reps == 5 + 2 * 9


def test_drop_set_marca_al_fallo_la_ultima_serie():
    planned = plan_sets(ProgressionStrategy.drop_set, sets=4, reps=8, weight_kg=45)
    assert _as_tuples(planned) == [
        (45, 8, None),
        (45, 8, None),
        (45, 8, None),
        (35, 12, "al fallo"),
    ]


def test_drop_set_redondea_para_arriba_las_reps_con_r_impar():
    planned = plan_sets(ProgressionStrategy.drop_set, sets=4, reps=7, weight_kg=50)
    # 1,5 * 7 = 10,5 -> half-up -> 11 (round() de Python redondearía a 10, banker's).
    assert _as_tuples(planned) == [
        (50, 7, None),
        (50, 7, None),
        (50, 7, None),
        (40, 11, "al fallo"),
    ]


def test_rest_pause_anota_la_pausa_desde_la_segunda_serie():
    planned = plan_sets(ProgressionStrategy.rest_pause, sets=4, reps=8, weight_kg=45)
    assert _as_tuples(planned) == [
        (45, 8, None),
        (45, 7, "20 s"),
        (45, 6, "20 s"),
        (45, 5, "20 s"),
    ]


def test_rest_pause_respeta_el_piso_de_una_repeticion():
    planned = plan_sets(ProgressionStrategy.rest_pause, sets=5, reps=4, weight_kg=20)
    assert _as_tuples(planned) == [
        (20, 4, None),
        (20, 3, "20 s"),
        (20, 2, "20 s"),
        (20, 1, "20 s"),
        (20, 1, "20 s"),
    ]


def test_el_redondeo_de_medio_paso_va_para_arriba():
    """`round()` de Python usa banker's rounding: `round(Decimal("8.5")) == 8`. El
    redondeo de peso tiene que ir para arriba en la mitad exacta (`ROUND_HALF_UP`).

    21,25 kg / 2,5 = 8,5 exacto: `round()` nativo daría 8 (8 es par) -> 20 kg, un
    peso que la spec no pediría nunca. Con `ROUND_HALF_UP` sube a 9 -> 22,5 kg.
    """
    assert round(Decimal("8.5")) == 8  # banker's rounding de Python, para contraste
    assert round_to_weight_step(Decimal("21.25")) == Decimal("22.5")


# --- `GET /routines/progression/preview` (design D13) ------------------------


def test_la_previsualizacion_devuelve_el_mismo_plan_que_el_guardado(
    client, owner_user, auth_header, catalog_basic
):
    """El test que detecta divergencia, no solo que el endpoint responde: la
    misma tupla `(strategy, sets, reps, weight_kg)` tiene que producir
    exactamente los `planned_sets` que el `PUT` de días persiste y devuelve."""
    headers = auth_header(OWNER_EMAIL)
    template = client.post(
        "/routines/templates", json={"name": "Previsualización", "tag": "PREV"}, headers=headers
    ).json()
    saved = client.put(
        f"/routines/templates/{template['id']}/days",
        json={
            "days": [
                {
                    "day_id": None,
                    "muscle_groups": [],
                    "exercises": [
                        {
                            "exercise_id": "chest-bench-press",
                            "strategy": "pyramid",
                            "base": {"sets": 4, "reps": 8, "weight_kg": 45},
                        }
                    ],
                }
            ]
        },
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    saved_planned = saved.json()["days"][0]["exercises"][0]["planned_sets"]

    preview = client.get(
        "/routines/progression/preview",
        params={"strategy": "pyramid", "sets": 4, "reps": 8, "weight_kg": 45},
        headers=headers,
    )

    assert preview.status_code == 200, preview.text
    preview_planned = preview.json()["planned_sets"]
    assert preview_planned == saved_planned
    assert all(item["logged"] is None for item in preview_planned)


def test_la_previsualizacion_le_responde_403_a_un_miembro(client, db_session, auth_header):
    create_user(
        db_session,
        email="miembro-preview@example.com",
        first_name="Miembro",
        role=models.UserRole.member,
    )
    headers = auth_header("miembro-preview@example.com")

    response = client.get(
        "/routines/progression/preview",
        params={"strategy": "constant", "sets": 3, "reps": 10, "weight_kg": 40},
        headers=headers,
    )

    assert response.status_code == 403, response.text


def test_la_previsualizacion_rechaza_una_base_fuera_de_rango(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    too_few_sets = client.get(
        "/routines/progression/preview",
        params={"strategy": "constant", "sets": 0, "reps": 10, "weight_kg": 40},
        headers=headers,
    )
    too_many_sets = client.get(
        "/routines/progression/preview",
        params={"strategy": "constant", "sets": 999, "reps": 10, "weight_kg": 40},
        headers=headers,
    )

    assert too_few_sets.status_code == 422, too_few_sets.text
    assert too_many_sets.status_code == 422, too_many_sets.text
