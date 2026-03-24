"""add theme preference to app settings

Revision ID: e4d5f6a7b8c9
Revises: c91d2b7a4e10
Create Date: 2026-03-24 19:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4d5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c91d2b7a4e10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("app_settings", sa.Column("theme_preference", sa.String(length=30), nullable=True))
    op.execute(
        """
        UPDATE app_settings
        SET theme_preference = 'dark-gold'
        WHERE theme_preference IS NULL OR trim(theme_preference) = ''
        """
    )


def downgrade() -> None:
    op.drop_column("app_settings", "theme_preference")
