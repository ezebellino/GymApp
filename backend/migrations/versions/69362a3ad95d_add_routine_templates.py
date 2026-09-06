"""add routine templates

Tablas del núcleo de `add-routine-templates` (ver design.md, decisiones D1/D2/D6/D7/D14):
`routine_templates`, `routine_template_days`, `routine_template_exercises`,
`routine_assignments` y `routine_assignment_bases`; más tres columnas de base
(`base_sets`/`base_reps`/`base_weight_kg`) en `exercises`, con backfill de los
ejercicios ya seedeados.

Es aditiva (invariante I8): no borra ni renombra ninguna tabla o columna existente,
y no modifica ninguna fila previa salvo el backfill de las tres columnas nuevas de
`exercises`. El autogenerate detectó además dos cambios de una sesión paralela sin
relación con este change (una FK renombrada de `member_invitations` y una expresión
de índice de `ix_users_full_name` con un cast distinto de Postgres) — se descartaron
a propósito, no son parte de este diff.

Revision ID: 69362a3ad95d
Revises: 0b1b3e72b287
Create Date: 2026-09-06 03:11:37.312490

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '69362a3ad95d'
down_revision: Union[str, Sequence[str], None] = '0b1b3e72b287'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Backfill de base (series x reps · kg) de los ejercicios ya seedeados. Copiado acá
# como snapshot (no se importa `routine_catalog.py`: una migración no depende de un
# archivo de datos de la app que puede cambiar mañana) — mismos valores que trae
# `EXERCISE_LIBRARY` en el momento de escribir este change.
_EXERCISE_BASE_BACKFILL = {
    "back-lat-pulldown": (3, 12, 40),
    "back-single-arm-row": (3, 10, 0),
    "back-tbar-row": (3, 10, 0),
    "back-seated-row": (3, 10, 0),
    "back-single-leg-row": (3, 10, 0),
    "back-supinated-pulldown": (3, 10, 0),
    "back-barbell-row": (4, 10, 38),
    "back-triangle-pulldown": (3, 10, 0),
    "back-pull-up": (4, 6, 20),
    "back-behind-neck-pulldown": (3, 10, 0),
    "back-straight-arm-pulldown": (3, 10, 0),
    "biceps-barbell-curl": (4, 10, 22),
    "biceps-incline-curl": (3, 10, 0),
    "biceps-hammer-curl": (3, 12, 12),
    "biceps-preacher-curl": (3, 10, 0),
    "biceps-concentration-curl": (3, 10, 0),
    "biceps-spider-curl": (3, 10, 0),
    "triceps-close-grip-bench": (3, 10, 0),
    "triceps-pushdown": (3, 12, 25),
    "triceps-overhead-extension": (3, 10, 0),
    "triceps-skullcrusher": (3, 10, 0),
    "triceps-dumbbell-french-press": (3, 10, 0),
    "triceps-rope-pushdown": (3, 10, 0),
    "shoulders-lateral-raise": (4, 15, 8),
    "shoulders-front-raise": (3, 10, 0),
    "shoulders-arnold-press": (3, 10, 0),
    "shoulders-rear-delt-fly": (3, 15, 6),
    "shoulders-overhead-press": (4, 8, 28),
    "shoulders-dumbbell-press": (3, 10, 0),
    "shoulders-upright-row": (3, 10, 0),
    "shoulders-barbell-shrug": (3, 10, 0),
    "shoulders-face-pull": (3, 10, 0),
    "legs-back-squat": (5, 5, 70),
    "legs-goblet-squat": (3, 10, 0),
    "legs-leg-extension": (3, 10, 0),
    "legs-romanian-deadlift": (4, 10, 55),
    "legs-box-step-up": (3, 10, 0),
    "legs-standing-calf-raise": (4, 20, 40),
    "legs-bulgarian-split-squat": (3, 10, 0),
    "legs-walking-lunge": (3, 10, 0),
    "legs-leg-press": (4, 12, 120),
    "legs-conventional-deadlift": (3, 10, 0),
    "legs-leg-curl": (3, 10, 0),
    "legs-sissy-squat": (3, 10, 0),
    "legs-sumo-deadlift": (3, 10, 0),
    "chest-bench-press": (4, 8, 45),
    "chest-incline-dumbbell-press": (3, 10, 0),
    "chest-cable-fly": (3, 12, 14),
    "chest-front-raise-45": (3, 10, 0),
    "chest-pec-deck": (3, 10, 0),
    "chest-machine-press": (3, 10, 0),
    "chest-push-up": (3, 10, 0),
}


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # Tipos enum, creados explícitamente (checkfirst) para poder referenciarlos con
    # `create_type=False` en las columnas y controlar su drop en el downgrade.
    # ------------------------------------------------------------------
    routine_assignment_status_enum = postgresql.ENUM(
        "active", "alternative", name="routineassignmentstatus"
    )
    routine_assignment_status_enum.create(bind, checkfirst=True)

    progression_strategy_enum = postgresql.ENUM(
        "constant", "pyramid", "inverted", "drop_set", "rest_pause", name="progressionstrategy"
    )
    progression_strategy_enum.create(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # Base de progresión en el catálogo de ejercicios (design D3)
    # ------------------------------------------------------------------
    op.add_column('exercises', sa.Column('base_sets', sa.Integer(), server_default='3', nullable=False))
    op.add_column('exercises', sa.Column('base_reps', sa.Integer(), server_default='10', nullable=False))
    op.add_column('exercises', sa.Column('base_weight_kg', sa.Float(), server_default='0', nullable=False))

    exercises_table = sa.table(
        "exercises",
        sa.column("id", sa.String()),
        sa.column("base_sets", sa.Integer()),
        sa.column("base_reps", sa.Integer()),
        sa.column("base_weight_kg", sa.Float()),
    )
    for exercise_id, (sets, reps, weight_kg) in _EXERCISE_BASE_BACKFILL.items():
        op.execute(
            exercises_table.update()
            .where(exercises_table.c.id == exercise_id)
            .values(base_sets=sets, base_reps=reps, base_weight_kg=weight_kg)
        )

    # ------------------------------------------------------------------
    # Plantillas (design D1)
    # ------------------------------------------------------------------
    op.create_table(
        'routine_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('name_normalized', sa.String(), nullable=False),
        sa.Column('tag', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by_user_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name_normalized', name='uq_routine_templates_name_normalized'),
    )

    # ------------------------------------------------------------------
    # Días de la plantilla (design D1)
    # ------------------------------------------------------------------
    op.create_table(
        'routine_template_days',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('template_id', sa.String(), nullable=False),
        sa.Column('day_id', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['day_id'], ['training_days.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['routine_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('template_id', 'day_id', name='uq_routine_template_days_template_day'),
    )
    op.create_index('ix_routine_template_days_day_id', 'routine_template_days', ['day_id'], unique=False)
    op.create_index('ix_routine_template_days_template_id', 'routine_template_days', ['template_id'], unique=False)

    # ------------------------------------------------------------------
    # Configuración (activo + estrategia) por (plantilla, día, ejercicio) — design D2.
    # Sin FK a `routine_template_days` ni a `training_day_exercises` a propósito
    # (invariantes I1/I9).
    # ------------------------------------------------------------------
    op.create_table(
        'routine_template_exercises',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('template_id', sa.String(), nullable=False),
        sa.Column('day_id', sa.String(), nullable=False),
        sa.Column('exercise_id', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column(
            'strategy',
            postgresql.ENUM(
                "constant", "pyramid", "inverted", "drop_set", "rest_pause",
                name="progressionstrategy", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by_user_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['day_id'], ['training_days.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['routine_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'template_id', 'day_id', 'exercise_id',
            name='uq_routine_template_exercises_template_day_exercise',
        ),
    )
    op.create_index(
        'ix_routine_template_exercises_day_id', 'routine_template_exercises', ['day_id'], unique=False
    )
    op.create_index(
        'ix_routine_template_exercises_exercise_id', 'routine_template_exercises', ['exercise_id'], unique=False
    )
    op.create_index(
        'ix_routine_template_exercises_template_id', 'routine_template_exercises', ['template_id'], unique=False
    )

    # ------------------------------------------------------------------
    # Asignaciones (design D6): a lo sumo una Activa por usuario, garantizado por el
    # índice único parcial (invariante I2), con los dos dialectos declarados (la
    # suite corre en SQLite, producción en Postgres — precedente
    # `ix_member_invitations_user_id_live`).
    # ------------------------------------------------------------------
    op.create_table(
        'routine_assignments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('template_id', sa.String(), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM(
                "active", "alternative", name="routineassignmentstatus", create_type=False
            ),
            nullable=False,
        ),
        sa.Column('starts_on', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by_user_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['template_id'], ['routine_templates.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'template_id', name='uq_routine_assignments_user_template'),
    )
    op.create_index('ix_routine_assignments_template_id', 'routine_assignments', ['template_id'], unique=False)
    op.create_index('ix_routine_assignments_user_id', 'routine_assignments', ['user_id'], unique=False)
    op.create_index(
        'ix_routine_assignments_user_active',
        'routine_assignments',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
        sqlite_where=sa.text("status = 'active'"),
    )

    # ------------------------------------------------------------------
    # Ajuste de base por cliente, con autoría por fila (design D7)
    # ------------------------------------------------------------------
    op.create_table(
        'routine_assignment_bases',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('assignment_id', sa.String(), nullable=False),
        sa.Column('exercise_id', sa.String(), nullable=False),
        sa.Column('sets', sa.Integer(), nullable=False),
        sa.Column('reps', sa.Integer(), nullable=False),
        sa.Column('weight_kg', sa.Float(), nullable=False),
        sa.Column('adjusted_by_user_id', sa.String(), nullable=True),
        sa.Column('adjusted_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['adjusted_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assignment_id'], ['routine_assignments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'assignment_id', 'exercise_id', name='uq_routine_assignment_bases_assignment_exercise'
        ),
    )
    op.create_index(
        'ix_routine_assignment_bases_assignment_id', 'routine_assignment_bases', ['assignment_id'], unique=False
    )
    op.create_index(
        'ix_routine_assignment_bases_exercise_id', 'routine_assignment_bases', ['exercise_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_routine_assignment_bases_exercise_id', table_name='routine_assignment_bases')
    op.drop_index('ix_routine_assignment_bases_assignment_id', table_name='routine_assignment_bases')
    op.drop_table('routine_assignment_bases')

    op.drop_index(
        'ix_routine_assignments_user_active',
        table_name='routine_assignments',
        postgresql_where=sa.text("status = 'active'"),
        sqlite_where=sa.text("status = 'active'"),
    )
    op.drop_index('ix_routine_assignments_user_id', table_name='routine_assignments')
    op.drop_index('ix_routine_assignments_template_id', table_name='routine_assignments')
    op.drop_table('routine_assignments')

    op.drop_index('ix_routine_template_exercises_template_id', table_name='routine_template_exercises')
    op.drop_index('ix_routine_template_exercises_exercise_id', table_name='routine_template_exercises')
    op.drop_index('ix_routine_template_exercises_day_id', table_name='routine_template_exercises')
    op.drop_table('routine_template_exercises')

    op.drop_index('ix_routine_template_days_template_id', table_name='routine_template_days')
    op.drop_index('ix_routine_template_days_day_id', table_name='routine_template_days')
    op.drop_table('routine_template_days')

    op.drop_table('routine_templates')

    op.drop_column('exercises', 'base_weight_kg')
    op.drop_column('exercises', 'base_reps')
    op.drop_column('exercises', 'base_sets')

    # Postgres no borra los tipos enum al borrar las tablas/columnas que los usaban
    # (design D14): hay que hacerlo a mano, después de que ya no quede ninguna
    # columna que los referencie.
    bind = op.get_bind()
    postgresql.ENUM(name="progressionstrategy").drop(bind, checkfirst=True)
    postgresql.ENUM(name="routineassignmentstatus").drop(bind, checkfirst=True)
