"""add rir and rest_seconds to routine day exercises

Revision ID: b8280a619a0a
Revises: 423f909a614f
Create Date: 2026-09-16 19:46:47.777304

`routine-exercise-intensity`: RIR (repeticiones en reserva) y pausa entre
series por ejercicio de un día, en las dos tablas espejo — la de la plantilla y
la de la copia de un Miembro.

Solo esquema, sin backfill: las dos columnas nacen `NULL` ("sin prescribir"),
que es exactamente lo que corresponde a todo lo ya cargado. No hay heurística
posible para inventar un RIR retroactivo ni tendría sentido.

Nota: el autogenerate también propuso recrear `ix_users_full_name`. Se
descartó a mano — la única diferencia es cómo Postgres imprime la expresión
del índice (`first_name::text || ...` vs. `first_name || ...`), no el índice
en sí, así que dropearlo y recrearlo sería trabajo puro sin cambio de esquema.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8280a619a0a'
down_revision: Union[str, Sequence[str], None] = '423f909a614f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('routine_assignment_day_exercises', sa.Column('rir', sa.Float(), nullable=True))
    op.add_column('routine_assignment_day_exercises', sa.Column('rest_seconds', sa.Integer(), nullable=True))
    op.add_column('routine_template_day_exercises', sa.Column('rir', sa.Float(), nullable=True))
    op.add_column('routine_template_day_exercises', sa.Column('rest_seconds', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('routine_template_day_exercises', 'rest_seconds')
    op.drop_column('routine_template_day_exercises', 'rir')
    op.drop_column('routine_assignment_day_exercises', 'rest_seconds')
    op.drop_column('routine_assignment_day_exercises', 'rir')
