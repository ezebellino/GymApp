"""template owned routine days

`template-owned-routine-days`, design D12: los días de rutina dejan de ser un
catálogo global (`training_days` + `training_day_exercises`) y pasan a ser
propiedad directa de cada `RoutineTemplate`. Sin backfill (regla de BETA de
`AGENTS.md`): la configuración de días/ejercicios de toda plantilla existente
se descarta, y **se borran todos los `workout_logs`** — sus `day_id` apuntaban
a un `training_days` que deja de existir y no hay forma honesta de reasignarlos
al día "equivalente" de la plantilla asignada de cada Miembro. Las plantillas y
las asignaciones sobreviven (nombre, etiqueta, asignaciones); cada plantilla
que sobrevive gana un `routine_template_days(position=1)` vacío para no violar
la invariante "toda plantilla tiene al menos un día" (I1) — es una reparación
estructural, no un backfill de datos de negocio.

Orden (obligado por las FKs):
1. `workout_logs`: se dropea la FK vieja a `training_days`, `day_id` pasa a
   nullable, se agrega `day_name` NOT NULL y se borran todas las filas.
2. `drop_table` de `routine_template_exercises` y `training_day_exercises`.
3. `drop_table` de la vieja `routine_template_days` y `create_table` de las
   tres tablas nuevas (`routine_template_days`, `routine_template_day_muscle_
   groups`, `routine_template_day_exercises`).
4. `drop_table` de `training_days` (sin referentes).
4bis. `exercises` pierde `base_sets`/`base_reps`/`base_weight_kg`.
5. FK nueva de `workout_logs.day_id` -> `routine_template_days.id`,
   `ondelete="SET NULL"`.
6. `routine_assignment_bases` no se toca (D4).
7. Se inserta un `routine_template_days(position=1)` por cada plantilla
   sobreviviente.

`downgrade()` es no-op documentado: no hay nada que restaurar (mismo criterio
que `bfc5002838bf`).

Revision ID: 3887b713f57d
Revises: 030412411aba
Create Date: 2026-09-14 10:31:51.447348

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '3887b713f57d'
down_revision: Union[str, Sequence[str], None] = '030412411aba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Espejo de las constantes de `app/models.py` (design D5): las migraciones son
# fotos, no importan de `app/`.
_DEFAULT_BASE_SETS = 3
_DEFAULT_BASE_REPS = 10
_DEFAULT_BASE_WEIGHT_KG = 0.0


def upgrade() -> None:
    """Upgrade schema."""
    # 1. `workout_logs`: FK vieja fuera, `day_id` nullable, `day_name` nuevo, y
    # se borran todas las filas (docstring: no hay forma honesta de reasignarlas).
    op.drop_constraint("workout_logs_day_id_fkey", "workout_logs", type_="foreignkey")
    op.alter_column("workout_logs", "day_id", existing_type=sa.String(), nullable=True)
    op.add_column(
        "workout_logs",
        sa.Column("day_name", sa.String(), nullable=False, server_default="Día 1"),
    )
    op.alter_column("workout_logs", "day_name", server_default=None)

    workout_logs = sa.table("workout_logs", sa.column("id", sa.String()))
    op.execute(workout_logs.delete())

    # 2. Tablas ralas viejas, ya sin filas que conservar.
    op.drop_table("routine_template_exercises")
    op.drop_table("training_day_exercises")

    # 3. La vieja `routine_template_days` (subconjunto ordenado de `training_days`)
    # se dropea y se recrea con el significado nuevo (propiedad de la plantilla).
    op.drop_table("routine_template_days")

    op.create_table(
        "routine_template_days",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("template_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["routine_templates.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "template_id", "position", name="uq_routine_template_days_template_position"
        ),
    )
    op.create_index(
        "ix_routine_template_days_template_id", "routine_template_days", ["template_id"], unique=False
    )

    op.create_table(
        "routine_template_day_muscle_groups",
        sa.Column("template_day_id", sa.String(), primary_key=True),
        sa.Column("muscle_group", sa.String(), primary_key=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["template_day_id"], ["routine_template_days.id"], ondelete="CASCADE"
        ),
    )

    op.create_table(
        "routine_template_day_exercises",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("template_day_id", sa.String(), nullable=False),
        sa.Column("exercise_id", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "strategy",
            postgresql.ENUM(
                "constant", "pyramid", "inverted", "drop_set", "rest_pause",
                name="progressionstrategy", create_type=False,
            ),
            nullable=False,
            server_default="constant",
        ),
        sa.Column("base_sets", sa.Integer(), nullable=False, server_default=str(_DEFAULT_BASE_SETS)),
        sa.Column("base_reps", sa.Integer(), nullable=False, server_default=str(_DEFAULT_BASE_REPS)),
        sa.Column(
            "base_weight_kg", sa.Float(), nullable=False, server_default=str(_DEFAULT_BASE_WEIGHT_KG)
        ),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by_user_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["template_day_id"], ["routine_template_days.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "template_day_id", "exercise_id", name="uq_routine_template_day_exercises_day_exercise"
        ),
    )
    op.create_index(
        "ix_routine_template_day_exercises_template_day_id",
        "routine_template_day_exercises",
        ["template_day_id"],
        unique=False,
    )
    op.create_index(
        "ix_routine_template_day_exercises_exercise_id",
        "routine_template_day_exercises",
        ["exercise_id"],
        unique=False,
    )

    # 4. `training_days` ya sin referentes.
    op.drop_table("training_days")

    # 4bis. La base editable del catálogo se retira entera (design D7).
    op.drop_column("exercises", "base_sets")
    op.drop_column("exercises", "base_reps")
    op.drop_column("exercises", "base_weight_kg")

    # 5. FK nueva de `workout_logs.day_id` -> `routine_template_days.id`.
    op.create_foreign_key(
        "workout_logs_day_id_fkey",
        "workout_logs",
        "routine_template_days",
        ["day_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 7. Reparación estructural de I1: toda plantilla sobreviviente gana un
    # Día 1 vacío (no hay grupos musculares ni ejercicios que preservar).
    routine_templates = sa.table("routine_templates", sa.column("id", sa.String()))
    routine_template_days = sa.table(
        "routine_template_days",
        sa.column("id", sa.String()),
        sa.column("template_id", sa.String()),
        sa.column("position", sa.Integer()),
    )
    connection = op.get_bind()
    template_ids = [row[0] for row in connection.execute(sa.select(routine_templates.c.id))]
    for template_id in template_ids:
        op.execute(
            routine_template_days.insert().values(
                id=str(uuid.uuid4()), template_id=template_id, position=1
            )
        )


def downgrade() -> None:
    """Downgrade schema. No-op: no hay nada que restaurar (regla de BETA de
    `AGENTS.md`, mismo criterio que `bfc5002838bf`). Volver atrás significa
    revertir el código y restaurar la base desde backup."""
    pass
