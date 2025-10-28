"""add method_channel to payments

Revision ID: a0f346917752
Revises: 622834b995a6
Create Date: 2025-10-27 10:25:26.697067

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a0f346917752'
down_revision: Union[str, Sequence[str], None] = '622834b995a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
