"""add payment reminder settings

Revision ID: c91d2b7a4e10
Revises: b8c1d9e6f4a2
Create Date: 2026-03-24 16:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c91d2b7a4e10"
down_revision: Union[str, Sequence[str], None] = "b8c1d9e6f4a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("app_settings", sa.Column("payment_reminder_message", sa.String(length=500), nullable=True))
    op.add_column("app_settings", sa.Column("payment_reminder_last_sent_at", sa.DateTime(), nullable=True))
    op.execute(
        """
        UPDATE app_settings
        SET payment_reminder_message = 'Hola {client_name}, te recordamos con cariño la cuota mensual de {gym_name}. El valor actual es {amount} y contamos con {grace_days} días de tolerancia para abonarla. Podés transferir al alias {payment_alias}. Si ya pagaste, podés ignorar este mensaje. ¡Gracias!'
        WHERE payment_reminder_message IS NULL OR trim(payment_reminder_message) = ''
        """
    )


def downgrade() -> None:
    op.drop_column("app_settings", "payment_reminder_last_sent_at")
    op.drop_column("app_settings", "payment_reminder_message")
