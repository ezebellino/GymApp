"""drop static exercise catalog seed

Borra los 52 ejercicios que sembraba `EXERCISE_LIBRARY`
(`backend/app/routine_catalog.py`, retirada de `app/` en este mismo change,
`drop-static-exercise-catalog` design D3). Con este catálogo, el catálogo de
ejercicios arranca vacío en todos los entornos: ya no hay ningún proceso que lo
reponga al visitar un endpoint de Rutinas.

**Lista literal de ids, no un patrón (`id NOT LIKE 'custom-%'`).** Es una foto de
los ids que `EXERCISE_LIBRARY` tenía en el momento de este change (criterio de
`add-exercise-catalog` D9: "las constantes evolucionan, las migraciones son
fotos"). Un `LIKE` dependería de una convención de prefijos que este change deja
sin dueño (el reseed que la mantenía viva desaparece), y podría llevarse puesta
una fila que un alta manual futura o pasada haya creado con otro prefijo.

Cascada (todas las FK son `ondelete="CASCADE"`, ver `models.py`):
`exercise_training_types`, `training_day_exercises`, `workout_logs`,
`routine_template_exercises`, `routine_assignment_bases`. En castellano: se
pierden los vínculos día↔ejercicio de estos 52, la selección y configuración de
ejercicios de toda plantilla que los use, los registros de entrenamiento que los
referencien y las bases por asignación. Las plantillas, las asignaciones y los
días **no** se borran: quedan vivas y vacías — el estado que los estados vacíos
del frontend (D6 del mismo change) muestran. `training_days` no se toca.

Bajo la regla de BETA de `AGENTS.md` ("El proyecto está en BETA"), descartar estos
datos es aceptable: no hay usuarios finales todavía.

Revision ID: bfc5002838bf
Revises: c387dcc091c2
Create Date: 2026-09-12 16:00:19.908152

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bfc5002838bf'
down_revision: Union[str, Sequence[str], None] = 'c387dcc091c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Foto de los 52 ids que sembraba `EXERCISE_LIBRARY` al momento de este change
# (ver docstring del módulo: lista literal, no un patrón sobre el id).
_SEEDED_EXERCISE_IDS = (
    "back-lat-pulldown",
    "back-single-arm-row",
    "back-tbar-row",
    "back-seated-row",
    "back-single-leg-row",
    "back-supinated-pulldown",
    "back-barbell-row",
    "back-triangle-pulldown",
    "back-pull-up",
    "back-behind-neck-pulldown",
    "back-straight-arm-pulldown",
    "biceps-barbell-curl",
    "biceps-incline-curl",
    "biceps-hammer-curl",
    "biceps-preacher-curl",
    "biceps-concentration-curl",
    "biceps-spider-curl",
    "triceps-close-grip-bench",
    "triceps-pushdown",
    "triceps-overhead-extension",
    "triceps-skullcrusher",
    "triceps-dumbbell-french-press",
    "triceps-rope-pushdown",
    "shoulders-lateral-raise",
    "shoulders-front-raise",
    "shoulders-arnold-press",
    "shoulders-rear-delt-fly",
    "shoulders-overhead-press",
    "shoulders-dumbbell-press",
    "shoulders-upright-row",
    "shoulders-barbell-shrug",
    "shoulders-face-pull",
    "legs-back-squat",
    "legs-goblet-squat",
    "legs-leg-extension",
    "legs-romanian-deadlift",
    "legs-box-step-up",
    "legs-standing-calf-raise",
    "legs-bulgarian-split-squat",
    "legs-walking-lunge",
    "legs-leg-press",
    "legs-conventional-deadlift",
    "legs-leg-curl",
    "legs-sissy-squat",
    "legs-sumo-deadlift",
    "chest-bench-press",
    "chest-incline-dumbbell-press",
    "chest-cable-fly",
    "chest-front-raise-45",
    "chest-pec-deck",
    "chest-machine-press",
    "chest-push-up",
)


def upgrade() -> None:
    """Upgrade schema."""
    exercises_table = sa.table("exercises", sa.column("id", sa.String()))
    op.execute(
        exercises_table.delete().where(exercises_table.c.id.in_(_SEEDED_EXERCISE_IDS))
    )


def downgrade() -> None:
    """Downgrade schema. No-op: no hay nada que restaurar (regla de BETA de
    `AGENTS.md`). Recuperar datos de ejercicios de desarrollo se hace con
    `make seed-dev-exercises` (`backend/scripts/seed_dev_exercises.py`), no con
    un camino de vuelta de esta migración."""
    pass
