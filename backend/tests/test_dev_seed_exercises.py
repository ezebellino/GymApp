"""Seed opcional de ejercicios de desarrollo (`scripts/seed_dev_exercises.py`,
`drop-static-exercise-catalog` design D4): idempotencia real (no solo conteo de
filas) y las dos guardas de entorno, mismo patrón que `test_dev_seed.py`.

`seed_dev_exercises(db)` recibe la sesión y no toca entorno ni engine, así que
corre sobre la SQLite de la suite. Las guardas se prueban vía `main()`,
monkeypatcheando `settings` y reemplazando `create_engine` por un centinela que
falla si se llama: la negativa tiene que ocurrir **antes** de abrir cualquier
conexión.
"""

import pytest

from app import models
from scripts import seed_dev_exercises as seed_module
from scripts.seed_dev_exercises import (
    EXERCISE_LIBRARY,
    _normalize_exercise_name,
    seed_dev_exercises,
)


def test_seed_de_ejercicios_crea_los_52(db_session):
    """`template-owned-routine-days` (design D7): el seed ya no crea ningún
    vínculo de día — el catálogo no tiene ninguna relación con días, que ahora
    son propios de cada plantilla."""
    result = seed_dev_exercises(db_session)

    assert result == {"created": 52, "skipped": 0, "collisions": []}

    exercises = db_session.query(models.Exercise).all()
    assert len(exercises) == 52
    assert {e.id for e in exercises} == {entry["id"] for entry in EXERCISE_LIBRARY}


def test_seed_de_ejercicios_dos_veces_no_duplica_ni_pisa_un_grupo_editado(db_session):
    first = seed_dev_exercises(db_session)
    assert first == {"created": 52, "skipped": 0, "collisions": []}

    # Editar el grupo muscular de uno, simulando la edición de un Dueño en la UI.
    edited = db_session.query(models.Exercise).filter_by(id="chest-bench-press").one()
    edited.muscle_group = "Espalda"
    db_session.commit()

    second = seed_dev_exercises(db_session)
    assert second == {"created": 0, "skipped": 52, "collisions": []}

    assert db_session.query(models.Exercise).count() == 52
    still_edited = db_session.query(models.Exercise).filter_by(id="chest-bench-press").one()
    assert still_edited.muscle_group == "Espalda"


def test_seed_de_ejercicios_reporta_el_nombre_ya_cargado_en_vez_de_explotar(db_session):
    """`exercises.name_normalized` es único: si el Dueño ya cargó a mano un
    ejercicio con uno de los 52 nombres, el seed lo saltea y lo reporta, en vez
    de dejar salir un `IntegrityError` crudo (hallazgo 5 de la verificación)."""
    entry = next(e for e in EXERCISE_LIBRARY if e["id"] == "chest-bench-press")
    db_session.add(
        models.Exercise(
            id="custom-propio",
            name=entry["name"].upper(),
            name_normalized=_normalize_exercise_name(entry["name"]),
            muscle_group="Pecho",
            is_active=True,
        )
    )
    db_session.commit()

    result = seed_dev_exercises(db_session)

    assert result["created"] == 51
    assert result["collisions"] == [("chest-bench-press", entry["name"], "custom-propio")]
    # El ejercicio cargado a mano queda intacto y el del seed no se creó.
    assert db_session.query(models.Exercise).filter_by(id="chest-bench-press").one_or_none() is None
    assert db_session.query(models.Exercise).filter_by(id="custom-propio").one().name == (
        entry["name"].upper()
    )


def _forbid_engine(monkeypatch):
    """Reemplaza `create_engine` del módulo del seed por un centinela: si la
    guarda dejó pasar, el test falla acá con un mensaje claro en vez de
    conectarse."""

    def _boom(*args, **kwargs):
        raise AssertionError(
            "create_engine fue llamado: la guarda de entorno tenía que cortar antes"
        )

    monkeypatch.setattr(seed_module, "create_engine", _boom)


def test_seed_de_ejercicios_se_niega_a_correr_fuera_de_desarrollo(monkeypatch, db_session):
    monkeypatch.setattr(seed_module.settings, "ENVIRONMENT", "production")
    _forbid_engine(monkeypatch)

    with pytest.raises(SystemExit) as exc_info:
        seed_module.main()

    assert exc_info.value.code != 0
    assert db_session.query(models.Exercise).count() == 0


def test_seed_de_ejercicios_se_niega_con_database_url_remota(monkeypatch, db_session):
    monkeypatch.setattr(seed_module.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(
        seed_module.settings,
        "DATABASE_URL",
        "postgresql+psycopg://gymapp:secret@db.abcdefgh.supabase.co:5432/postgres",
    )
    _forbid_engine(monkeypatch)

    with pytest.raises(SystemExit) as exc_info:
        seed_module.main()

    assert exc_info.value.code != 0
    assert db_session.query(models.Exercise).count() == 0
