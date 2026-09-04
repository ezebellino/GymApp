"""add theme preference to users

Revision ID: 9812b6c09a1a
Revises: 9f8a7c6b5d4e
Create Date: 2026-09-04 17:25:54.222503

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9812b6c09a1a'
down_revision: Union[str, Sequence[str], None] = '9f8a7c6b5d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("theme_preference", sa.String(length=30), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "theme_preference")
