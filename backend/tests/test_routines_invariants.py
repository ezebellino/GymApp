"""Invariantes estructurales de `template-owned-routine-days` (design D13):
`routine_catalog` ya no existe en ningún módulo de `app/` (I9), y los
endpoints retirados del catálogo global de días y de la base editable del
catálogo devuelven 404 (no reviven por descuido).

Se conserva **solo** el test estructural del import de
`test_routines_seed.py` (`drop-static-exercise-catalog`); el resto de ese
archivo probaba `ensure_training_days`, el catálogo global fijo y el reseed —
retirados enteros en este change (`routine_catalog.py` se borró, junto con
`TrainingDay`/`TrainingDayExercise`)."""

import importlib
import pkgutil

import app
from tests.helpers import OWNER_EMAIL


def test_ningun_modulo_de_app_importa_el_catalogo_global_de_dias():
    """I9: recorre cada módulo de `backend/app/` (recursivo, incluido
    `app.routers.*`) y falla si alguno define o importa `routine_catalog`,
    `TrainingDay`, `TrainingDayExercise`, `ensure_training_days` o
    `sync_exercise_day_links` — todos retirados por `template-owned-routine-
    days` (design D2): el catálogo global de días no puede volver por
    descuido."""
    retired_symbols = {
        "routine_catalog",
        "TRAINING_DAYS",
        "TrainingDay",
        "TrainingDayExercise",
        "ensure_training_days",
        "sync_exercise_day_links",
    }
    offenders = []
    for module_info in pkgutil.walk_packages(app.__path__, prefix="app."):
        if module_info.name == "app.routine_catalog":
            offenders.append(module_info.name)
            continue
        module = importlib.import_module(module_info.name)
        found = retired_symbols & set(vars(module).keys())
        if found:
            offenders.append(f"{module_info.name}: {sorted(found)}")

    assert offenders == []


def test_los_endpoints_retirados_del_catalogo_global_devuelven_404(client, owner_user, auth_header):
    """I9: `GET /routines/catalog`, `GET /routines/days` y `GET
    /routines/exercises` (design D7) ya no existen — sin ruta registrada, un
    404 (no un 200 con lista vacía, que confundiría "no autorizado"/"vacío"
    con "el endpoint no existe")."""
    headers = auth_header(OWNER_EMAIL)

    for path in ("/routines/catalog", "/routines/days", "/routines/exercises"):
        response = client.get(path, headers=headers)
        assert response.status_code == 404, f"{path}: {response.text}"


def test_el_endpoint_de_base_del_catalogo_devuelve_404(client, owner_user, auth_header):
    """I9: `PUT /routines/exercises/{id}` (la base editable del catálogo,
    design D7) se retiró sin reemplazo — 404, no 405 ni 200."""
    headers = auth_header(OWNER_EMAIL)
    exercise = client.post(
        "/exercises/", json={"name": "Ejercicio para 404 de base (test)"}, headers=headers
    ).json()

    response = client.put(
        f"/routines/exercises/{exercise['id']}",
        json={"base_sets": 4, "base_reps": 8, "base_weight_kg": 20},
        headers=headers,
    )

    assert response.status_code == 404, response.text
