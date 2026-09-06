"""Tests del motor de progresión (`app/progression.py`, capability `progression-strategies`).

Función pura: no usa `client` ni `db_session`, solo `plan_sets`. Los valores exactos
son los escenarios numéricos de
`openspec/changes/add-routine-templates/specs/progression-strategies/spec.md`,
incluidos los tres pisos de borde (Pirámide 3 reps, Rest-pause 1 rep, Invertida
2,5 kg) y el redondeo half-up de `1,5 × R` con R impar.
"""

from decimal import Decimal

from app.models import ProgressionStrategy
from app.progression import plan_sets, round_to_weight_step


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
