"""drop training_day_exercise is_active

Retira `training_day_exercises.is_active` (`drop-static-exercise-catalog`,
design D10). El vínculo día↔ejercicio pasa a ser puramente derivado del
`muscle_group` actual de `Exercise`: existe si y solo si el grupo muscular del
ejercicio corresponde a ese día (o si alguna `RoutineTemplateExercise` todavía
lo usa, ver `sync_exercise_day_links` en `app/routers/routines.py`). Ya no
guarda ninguna decisión humana propia — esa decisión pasó a apoyarse
enteramente en `Exercise.is_active` (D10.5/D10.6/D10.7).

`downgrade()` recrea la columna con default `True`, sin intentar restaurar
valores: no hay de dónde (regla de BETA de `AGENTS.md`, mismo criterio que
`bfc5002838bf`).

En la misma revision, D11: repara de una vez las 4 filas de `training_days`,
que `add-exercise-catalog` (`c387dcc091c2`) dejó desalineadas de
`TRAINING_DAYS` sin ninguna migración de datos — se reparaban solas porque
`_ensure_seed_data` las reescribía en cada request, reparación que
`drop-static-exercise-catalog` D1 retiró. Valores **literales**, no
importados de `app/routine_catalog.py` (D3: las migraciones son fotos).

Revision ID: 030412411aba
Revises: bfc5002838bf
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '030412411aba'
down_revision: Union[str, Sequence[str], None] = 'bfc5002838bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Foto de `TRAINING_DAYS` (`app/routine_catalog.py`) al momento de este change
# (design D11): (id, name, muscle_groups, day_order).
_TRAINING_DAYS = (
    ("day-1", "Dia 1", "Pecho, Tríceps", 1),
    ("day-2", "Dia 2", "Espalda, Bíceps", 2),
    ("day-3", "Dia 3", "Hombros", 3),
    ("day-4", "Dia 4", "Cuádriceps, Isquios, Gemelos", 4),
)


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("training_day_exercises", "is_active")

    training_days = sa.table(
        "training_days",
        sa.column("id", sa.String()),
        sa.column("name", sa.String()),
        sa.column("muscle_groups", sa.String()),
        sa.column("day_order", sa.Integer()),
    )
    for day_id, name, muscle_groups, day_order in _TRAINING_DAYS:
        op.execute(
            training_days.update()
            .where(training_days.c.id == day_id)
            .values(name=name, muscle_groups=muscle_groups, day_order=day_order)
        )


def downgrade() -> None:
    """Downgrade schema. Recrea la columna con default `True`, sin restaurar
    valores (no hay de dónde). No revierte el `UPDATE` de `training_days`: D11
    es una reparación de datos, no un cambio reversible con sentido."""
    op.add_column(
        "training_day_exercises",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("training_day_exercises", "is_active", server_default=None)
