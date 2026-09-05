"""`_progress_score`: puntaje 0-100 del reporte de progreso (`GET /routines/users/{id}/progress-report`).

Antes de existir esta función el endpoint respondía 500 (NameError) en toda invocación. El
puntaje tiene que ser coherente con los umbrales de `_motivation_for_metrics` y con el corte
de color del PDF (`emerald` a partir de 65).
"""

from app.routers.routines import _progress_score


def test_sin_actividad_da_cero():
    assert _progress_score(0, 0, 0) == 0


def test_valores_negativos_no_restan():
    assert _progress_score(-5, -1, -2) == 0


def test_satura_en_cien_aunque_supere_las_metas():
    assert _progress_score(500, 200, 40) == 100
    assert _progress_score(12, 8, 3) == 100


def test_constancia_excelente_pinta_verde():
    # 12 registros y 8 asistencias sin mejoras: el texto dice "excelente constancia",
    # el número tiene que cruzar el umbral verde del PDF (65).
    assert _progress_score(12, 8, 0) == 70


def test_buen_comienzo_queda_en_ambar():
    assert _progress_score(3, 1, 0) < 65


def test_cada_componente_suma_de_forma_independiente():
    assert _progress_score(12, 0, 0) == 40
    assert _progress_score(0, 8, 0) == 30
    assert _progress_score(0, 0, 3) == 30
