"""add plan reference to payments

Revision ID: d5f74a834ac0
Revises: 6c1a341f03a2
Create Date: 2026-09-11 23:50:43.979105

Migración SOLO de esquema (`rebuild-payments-with-plan-pricing`, design D1/D4): agrega
a `payments` las tres columnas de la foto de plan (`membership_plan_id`,
`plan_name_at_payment`, `plan_amount_at_payment`), todas nullable. **Sin backfill**: el
proyecto está en beta y no hay datos reales que migrar, y reconstruir la foto de un pago
ya registrado sería inventar un precio/plan de un momento que ya pasó. Los pagos
existentes quedan con la foto en `NULL` y se siguen mostrando ("Sin plan"); de acá en
adelante todo pago creado por la API la trae completa (invariante I5). El `downgrade()`
es DESTRUCTIVO para las fotos ya registradas: dropea las tres columnas sin forma de
conservar esos datos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f74a834ac0'
down_revision: Union[str, Sequence[str], None] = '6c1a341f03a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('payments', sa.Column('membership_plan_id', sa.String(), nullable=True))
    op.add_column('payments', sa.Column('plan_name_at_payment', sa.String(), nullable=True))
    op.add_column('payments', sa.Column('plan_amount_at_payment', sa.Integer(), nullable=True))
    op.create_index(
        'ix_payments_membership_plan_id', 'payments', ['membership_plan_id'], unique=False
    )
    op.create_foreign_key(
        'fk_payments_membership_plan_id_membership_plans',
        'payments',
        'membership_plans',
        ['membership_plan_id'],
        ['id'],
        ondelete='RESTRICT',
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_payments_membership_plan_id_membership_plans', 'payments', type_='foreignkey'
    )
    op.drop_index('ix_payments_membership_plan_id', table_name='payments')
    op.drop_column('payments', 'plan_amount_at_payment')
    op.drop_column('payments', 'plan_name_at_payment')
    op.drop_column('payments', 'membership_plan_id')
