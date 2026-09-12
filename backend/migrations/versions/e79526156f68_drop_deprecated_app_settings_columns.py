"""drop deprecated app_settings columns

Revision ID: e79526156f68
Revises: c387dcc091c2
Create Date: 2026-09-12 12:22:33.647260

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e79526156f68'
down_revision: Union[str, Sequence[str], None] = 'd5f74a834ac0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("app_settings", "theme_preference")
    op.drop_column("app_settings", "default_fee")
    op.drop_column("app_settings", "payment_reminder_message")
    op.drop_column("app_settings", "payment_reminder_last_sent_at")
    op.drop_column("app_settings", "late_fee_grace_days")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "app_settings",
        sa.Column("late_fee_grace_days", sa.Integer(), nullable=True),
    )
    op.add_column(
        "app_settings",
        sa.Column(
            "payment_reminder_last_sent_at", sa.DateTime(), nullable=True
        ),
    )
    op.add_column(
        "app_settings",
        sa.Column("payment_reminder_message", sa.String(), nullable=True),
    )
    op.add_column(
        "app_settings",
        sa.Column("default_fee", sa.Integer(), nullable=True),
    )
    op.add_column(
        "app_settings",
        sa.Column("theme_preference", sa.String(), nullable=True),
    )
