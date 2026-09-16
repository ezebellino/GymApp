"""Seed idempotente y **opcional** de los 52 ejercicios de desarrollo.

El catálogo de ejercicios arranca vacío en todos los entornos
(`drop-static-exercise-catalog`): ya no hay un sembrado automático que los cree al
visitar un endpoint de Rutinas. Este script existe solo para tener datos de prueba
utilizables en un entorno de desarrollo — no lo corre nadie salvo quien lo pida a
mano, y nunca corre contra producción (mismo doble candado que
`seed_dev_users.py`, ver `scripts/dev_guards.py`).

Se corre con `make seed-dev-exercises` desde la raíz (detecta Docker vs. nativo) o,
dentro de `backend/`, con `python -m scripts.seed_dev_exercises`.

`EXERCISE_LIBRARY` vivía en `backend/app/routine_catalog.py`: se mudó acá entera
porque `backend/scripts/` no es importable desde `backend/app/`, así que ningún
código de aplicación puede volver a derivar nada de esta lista (design D4, I2).

`template-owned-routine-days`: las claves `base_sets`/`base_reps`/`base_weight_kg`
se retiraron de las ~52 entradas (esas columnas ya no existen en `Exercise` — la
base pasó a ser exclusiva de cada combinación (plantilla, día, ejercicio), ver
`app/models.py::DEFAULT_EXERCISE_BASE_*`). Este seed sigue sin tocar días ni
plantillas: son datasets sin relación entre sí (ver `backend/AGENTS.md`).
"""

import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.config import settings
from app.models import Exercise
from app.routers.routines import _normalize_exercise_name
from scripts.dev_guards import check_environment_guards


EXERCISE_LIBRARY = [
    # --- Espalda ---------------------------------------------------------
    {"id": "back-lat-pulldown", "name": "Tirones en polea alta agarre amplio", "muscle_group": "Espalda"},
    {"id": "back-single-arm-row", "name": "Remo a 1 mano", "muscle_group": "Espalda"},
    {"id": "back-tbar-row", "name": "Remo potro Landmine", "muscle_group": "Espalda"},
    {"id": "back-seated-row", "name": "Remo bajo", "muscle_group": "Espalda"},
    {"id": "back-single-leg-row", "name": "Remo bajo unipodal", "muscle_group": "Espalda"},
    {"id": "back-supinated-pulldown", "name": "Tirones polea alta con agarre supino", "muscle_group": "Espalda"},
    {"id": "back-barbell-row", "name": "Remo con barra", "muscle_group": "Espalda"},
    {"id": "back-triangle-pulldown", "name": "Tirones polea alta con triangulo", "muscle_group": "Espalda"},
    {"id": "back-pull-up", "name": "Dominadas", "muscle_group": "Espalda"},
    {"id": "back-behind-neck-pulldown", "name": "Tirones polea alta tras nuca", "muscle_group": "Espalda"},
    {"id": "back-straight-arm-pulldown", "name": "Pullover en polea alta", "muscle_group": "Espalda"},
    # --- Biceps ------------------------------------------------------------
    {"id": "biceps-barbell-curl", "name": "Curl barra", "muscle_group": "Bíceps"},
    {"id": "biceps-incline-curl", "name": "Curl supinado banco inclinado", "muscle_group": "Bíceps"},
    {"id": "biceps-hammer-curl", "name": "Curl martillo", "muscle_group": "Bíceps"},
    {"id": "biceps-preacher-curl", "name": "Banco Scott", "muscle_group": "Bíceps"},
    {"id": "biceps-concentration-curl", "name": "Concentrado con mancuerna", "muscle_group": "Bíceps"},
    {"id": "biceps-spider-curl", "name": "Spiderman con barra o mancuerna", "muscle_group": "Bíceps"},
    # --- Triceps -----------------------------------------------------------
    {"id": "triceps-close-grip-bench", "name": "Press barra angosta", "muscle_group": "Tríceps"},
    {"id": "triceps-pushdown", "name": "Polea alta", "muscle_group": "Tríceps"},
    {"id": "triceps-overhead-extension", "name": "Copa", "muscle_group": "Tríceps"},
    {"id": "triceps-skullcrusher", "name": "Frances con barra W", "muscle_group": "Tríceps"},
    {"id": "triceps-dumbbell-french-press", "name": "Frances con mancuernas", "muscle_group": "Tríceps"},
    {"id": "triceps-rope-pushdown", "name": "Polea alta con soga", "muscle_group": "Tríceps"},
    # --- Hombros -------------------------------------------------------------
    {"id": "shoulders-lateral-raise", "name": "Vuelo lateral", "muscle_group": "Hombros"},
    {"id": "shoulders-front-raise", "name": "Vuelo frontal", "muscle_group": "Hombros"},
    {"id": "shoulders-arnold-press", "name": "Press Arnold", "muscle_group": "Hombros"},
    {"id": "shoulders-rear-delt-fly", "name": "Posteriores con mancuernas", "muscle_group": "Hombros"},
    {"id": "shoulders-overhead-press", "name": "Press militar con barra", "muscle_group": "Hombros"},
    {"id": "shoulders-dumbbell-press", "name": "Press militar con mancuerna", "muscle_group": "Hombros"},
    {"id": "shoulders-upright-row", "name": "Remo al menton agarre amplio con W", "muscle_group": "Hombros"},
    {"id": "shoulders-barbell-shrug", "name": "Encogimientos con barra", "muscle_group": "Hombros"},
    {"id": "shoulders-face-pull", "name": "Face pull", "muscle_group": "Hombros"},
    # --- Piernas (repartidos entre Cuádriceps/Isquios/Gemelos, exercise-catalog D9) ---
    {"id": "legs-back-squat", "name": "Sentadilla libre", "muscle_group": "Cuádriceps"},
    {"id": "legs-goblet-squat", "name": "Sentadilla goblet", "muscle_group": "Cuádriceps"},
    {"id": "legs-leg-extension", "name": "Extensiones", "muscle_group": "Cuádriceps"},
    {"id": "legs-romanian-deadlift", "name": "Peso muerto rumano", "muscle_group": "Isquios"},
    {"id": "legs-box-step-up", "name": "Subidas al cajon", "muscle_group": "Cuádriceps"},
    {"id": "legs-standing-calf-raise", "name": "Gemelos", "muscle_group": "Gemelos"},
    {"id": "legs-bulgarian-split-squat", "name": "Bulgaras", "muscle_group": "Cuádriceps"},
    {"id": "legs-walking-lunge", "name": "Estocadas", "muscle_group": "Cuádriceps"},
    {"id": "legs-leg-press", "name": "Prensa a 45 grados", "muscle_group": "Cuádriceps"},
    {"id": "legs-conventional-deadlift", "name": "Peso muerto convencional", "muscle_group": "Isquios"},
    {"id": "legs-leg-curl", "name": "Izquiotibiales en banco", "muscle_group": "Isquios"},
    {"id": "legs-sissy-squat", "name": "Sissy Squat", "muscle_group": "Cuádriceps"},
    {"id": "legs-sumo-deadlift", "name": "Sumo", "muscle_group": "Isquios"},
    # --- Pecho ---------------------------------------------------------------
    {"id": "chest-bench-press", "name": "Press en banco plano con barra", "muscle_group": "Pecho"},
    {"id": "chest-incline-dumbbell-press", "name": "Press en banco inclinado con barra", "muscle_group": "Pecho"},
    {"id": "chest-cable-fly", "name": "Apertura inclinadas con mancuernas", "muscle_group": "Pecho"},
    {"id": "chest-front-raise-45", "name": "Elevaciones en banco 45 grados con mancuernas", "muscle_group": "Pecho"},
    {"id": "chest-pec-deck", "name": "Peck Deck", "muscle_group": "Pecho"},
    {"id": "chest-machine-press", "name": "Press banco plano con mancuernas", "muscle_group": "Pecho"},
    {"id": "chest-push-up", "name": "Push ups", "muscle_group": "Pecho"},
]


def seed_dev_exercises(db: Session) -> dict:
    """Inserta por `id` los ejercicios de `EXERCISE_LIBRARY` que falten, sin pisar
    los que ya están (mismo criterio que el bloque de sembrado que se retiró de
    `routers/routines.py`).

    Sin guardas ni engine propio: recibe la sesión para poder correrse también
    sobre la SQLite de la suite de tests.
    """
    existing = db.query(Exercise.id, Exercise.name_normalized).all()
    existing_ids = {row.id for row in existing}
    # La idempotencia es por `id`, pero `exercises.name_normalized` es `unique`:
    # si el Dueño ya cargó a mano un ejercicio con uno de estos nombres, insertar
    # explotaría con un `IntegrityError` crudo. Se detecta antes y se reporta.
    existing_names = {row.name_normalized: row.id for row in existing}

    created = 0
    collisions = []
    for entry in EXERCISE_LIBRARY:
        if entry["id"] in existing_ids:
            continue
        normalized = _normalize_exercise_name(entry["name"])
        owner_id = existing_names.get(normalized)
        if owner_id is not None:
            collisions.append((entry["id"], entry["name"], owner_id))
            continue
        db.add(
            Exercise(
                id=entry["id"],
                name=entry["name"],
                name_normalized=normalized,
                muscle_group=entry["muscle_group"],
                is_active=True,
            )
        )
        existing_names[normalized] = entry["id"]
        created += 1

    db.commit()
    return {
        "created": created,
        "skipped": len(EXERCISE_LIBRARY) - created - len(collisions),
        "collisions": collisions,
    }


def main():
    check_environment_guards("ejercicios de desarrollo")

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM exercises LIMIT 1"))
    except ProgrammingError:
        print(
            "La tabla 'exercises' no existe. Corre las migraciones primero:\n"
            "  alembic upgrade head"
        )
        sys.exit(1)
    except OperationalError as exc:
        print(
            "No pude conectarme a la base. Revisa DATABASE_URL en .env y credenciales.\n",
            exc,
        )
        sys.exit(1)

    with SessionLocal() as db:
        result = seed_dev_exercises(db)

    print(
        f"Ejercicios de desarrollo listos ({result['created']} creados, "
        f"{result['skipped']} ya existían)."
    )
    if result["collisions"]:
        print(
            f"\n{len(result['collisions'])} ejercicio(s) del seed se saltearon porque ya hay "
            "uno con el mismo nombre cargado a mano (el nombre es único en el catálogo):"
        )
        for seed_id, name, owner_id in result["collisions"]:
            print(f"  - {name!r} (seed {seed_id}) choca con el ejercicio {owner_id}")
        print(
            "Renombrá o borrá esos ejercicios desde /exercises y volvé a correr el seed "
            "si los querés con los datos de prueba."
        )


if __name__ == "__main__":
    main()
