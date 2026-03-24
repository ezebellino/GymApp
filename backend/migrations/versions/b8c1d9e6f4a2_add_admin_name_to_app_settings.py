"""add admin name to app settings

Revision ID: b8c1d9e6f4a2
Revises: f21d4f7e9c9b
Create Date: 2026-03-24 11:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c1d9e6f4a2"
down_revision: Union[str, Sequence[str], None] = "f21d4f7e9c9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("app_settings", sa.Column("admin_name", sa.String(length=120), nullable=True))
    op.execute(
        """
        UPDATE app_settings
        SET admin_name = 'Fabian Aguirre (Manga)'
        WHERE admin_name IS NULL OR trim(admin_name) = ''
        """
    )


def downgrade() -> None:
    op.drop_column("app_settings", "admin_name")
