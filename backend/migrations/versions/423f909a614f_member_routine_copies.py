"""member routine copies

`member-routine-copies`, design D11: asignar deja de ser una **referencia**
(`RoutineAssignment(user_id, template_id, status)`) y pasa a ser una **copia**
independiente de días/grupos musculares/ejercicios, propia de cada asignación.
El registro de progreso pasa del grano "un ejercicio hecho" (`workout_logs`,
`sets_count` como cantidad) al grano "una serie hecha" (`workout_set_logs`,
una fila por serie). El ajuste de base por cliente (`routine_assignment_bases`)
se retira entero: la base de un ejercicio de la copia se edita directo.

**Sin backfill** (regla de BETA de `AGENTS.md`): las asignaciones existentes
son referencias sin copia, y no hay forma honesta de construir esa copia sin
inventar contenido — se descartan. Sus ajustes de base y sus registros de
entrenamiento se pierden con ellas. Las plantillas, sus días y sus ejercicios
**no se tocan**: sobreviven intactos, listos para reasignarse a mano desde la
UI después de este `upgrade()`.

Orden, obligado por las FKs:

1. `drop_table("workout_logs")`: grano viejo, sin equivalente en el nuevo
   modelo (`sets_count` como cantidad no tiene traducción a "una fila = una
   serie"). Sus filas se pierden.
2. `drop_table("routine_assignment_bases")`: el ajuste por cliente se retira
   entero (design D4).
3. `DELETE FROM routine_assignments`: las asignaciones existentes son
   referencias sin copia; se borran antes de alterar la tabla para que los
   `add_column` de los pasos siguientes no necesiten un `server_default` de
   compromiso.
4. Sobre `routine_assignments`: se dropea `uq_routine_assignments_user_template`
   (D2 — reasignar la misma plantilla pasa a crear una copia nueva, no un
   upsert), se agregan `template_name` (NOT NULL, snapshot del nombre de
   origen) y `template_tag` (nullable), se recrea la FK a `routine_templates`
   con `ondelete="SET NULL"` y `template_id` pasa a nullable (D2b — una
   plantilla borrada con solo copias Alternativas deja `template_id IS NULL`
   sin tocar el resto de la copia). El índice parcial
   `ix_routine_assignments_user_active` **no se toca**: sigue sosteniendo "como
   máximo una Activa por usuario" (I5) y recrearlo perdería el
   `postgresql_where`/`sqlite_where` en silencio.
5. `create_table` de `routine_assignment_days`, `routine_assignment_day_muscle_
   groups` y `routine_assignment_day_exercises` (D1): espejo exacto de la
   estructura de plantilla, pero colgado de la asignación. `strategy` se
   declara con `postgresql.ENUM(..., name="progressionstrategy",
   create_type=False)`, no con `VARCHAR` (el tipo ya existe, creado por
   `3887b713f57d`).
6. `create_table("workout_set_logs")` (D3): una fila por serie marcada, con
   `assignment_day_id` `ondelete="SET NULL"` nullable y el `UNIQUE(user_id,
   assignment_day_id, exercise_id, set_index, performed_on)` que hace que
   remarcar la misma serie el mismo día corrija en vez de duplicar.

`downgrade()` es no-op documentado: no hay nada que restaurar (mismo criterio
que `bfc5002838bf` y `3887b713f57d`).

Revision ID: 423f909a614f
Revises: 3887b713f57d
Create Date: 2026-09-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '423f909a614f'
down_revision: Union[str, Sequence[str], None] = '3887b713f57d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Espejo de las constantes de `app/models.py` (las migraciones son fotos, no
# importan de `app/`).
_DEFAULT_BASE_SETS = 3
_DEFAULT_BASE_REPS = 10
_DEFAULT_BASE_WEIGHT_KG = 0.0


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Grano viejo de registro de progreso, sin equivalente en el nuevo
    # modelo: se pierde.
    op.drop_table("workout_logs")

    # 2. Ajuste de base por cliente, retirado entero (design D4).
    op.drop_table("routine_assignment_bases")

    # 3. Las asignaciones existentes son referencias sin copia: se borran
    # antes de alterar la tabla (docstring: sin backfill).
    routine_assignments_ids = sa.table("routine_assignments", sa.column("id", sa.String()))
    op.execute(routine_assignments_ids.delete())

    # 4. `routine_assignments` pasa de referencia a raíz de la copia (D2, D2b).
    op.drop_constraint(
        "uq_routine_assignments_user_template", "routine_assignments", type_="unique"
    )
    op.add_column(
        "routine_assignments",
        sa.Column("template_name", sa.String(), nullable=False, server_default=""),
    )
    op.alter_column("routine_assignments", "template_name", server_default=None)
    op.add_column(
        "routine_assignments", sa.Column("template_tag", sa.String(), nullable=True)
    )
    op.drop_constraint(
        "routine_assignments_template_id_fkey", "routine_assignments", type_="foreignkey"
    )
    op.create_foreign_key(
        "routine_assignments_template_id_fkey",
        "routine_assignments",
        "routine_templates",
        ["template_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column(
        "routine_assignments", "template_id", existing_type=sa.String(), nullable=True
    )

    # 5. Las tres tablas de la copia, espejo exacto de la estructura de
    # plantilla (D1).
    op.create_table(
        "routine_assignment_days",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("assignment_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["assignment_id"], ["routine_assignments.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "assignment_id", "position", name="uq_routine_assignment_days_assignment_position"
        ),
    )
    op.create_index(
        "ix_routine_assignment_days_assignment_id",
        "routine_assignment_days",
        ["assignment_id"],
        unique=False,
    )

    op.create_table(
        "routine_assignment_day_muscle_groups",
        sa.Column("assignment_day_id", sa.String(), primary_key=True),
        sa.Column("muscle_group", sa.String(), primary_key=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["assignment_day_id"], ["routine_assignment_days.id"], ondelete="CASCADE"
        ),
    )

    op.create_table(
        "routine_assignment_day_exercises",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("assignment_day_id", sa.String(), nullable=False),
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
            ["assignment_day_id"], ["routine_assignment_days.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "assignment_day_id", "exercise_id", name="uq_routine_assignment_day_exercises_day_exercise"
        ),
    )
    op.create_index(
        "ix_routine_assignment_day_exercises_assignment_day_id",
        "routine_assignment_day_exercises",
        ["assignment_day_id"],
        unique=False,
    )
    op.create_index(
        "ix_routine_assignment_day_exercises_exercise_id",
        "routine_assignment_day_exercises",
        ["exercise_id"],
        unique=False,
    )

    # 6. Grano nuevo de registro de progreso: una fila = una serie (D3).
    op.create_table(
        "workout_set_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("assignment_day_id", sa.String(), nullable=True),
        sa.Column("day_name", sa.String(), nullable=False),
        sa.Column("exercise_id", sa.String(), nullable=False),
        sa.Column("set_index", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("performed_on", sa.Date(), nullable=False),
        sa.Column("performed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by_user_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["assignment_day_id"], ["routine_assignment_days.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "user_id", "assignment_day_id", "exercise_id", "set_index", "performed_on",
            name="uq_workout_set_logs_user_day_exercise_set_performed_on",
        ),
    )
    op.create_index("ix_workout_set_logs_user_id", "workout_set_logs", ["user_id"], unique=False)
    op.create_index(
        "ix_workout_set_logs_assignment_day_id", "workout_set_logs", ["assignment_day_id"], unique=False
    )
    op.create_index(
        "ix_workout_set_logs_exercise_id", "workout_set_logs", ["exercise_id"], unique=False
    )
    op.create_index(
        "ix_workout_set_logs_performed_on", "workout_set_logs", ["performed_on"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema. No-op: no hay nada que restaurar (regla de BETA de
    `AGENTS.md`, mismo criterio que `bfc5002838bf` y `3887b713f57d`). Volver
    atrás significa revertir el código y recrear la base desde backup."""
    pass
