"""add user role and client link

Revision ID: 9f8a7c6b5d4e
Revises: e4d5f6a7b8c9
Create Date: 2026-04-21 11:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f8a7c6b5d4e"
down_revision: Union[str, Sequence[str], None] = "e4d5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'user'")

    op.add_column("users", sa.Column("client_id", sa.String(), nullable=True))
    op.create_index("ix_users_client_id", "users", ["client_id"], unique=True)
    op.create_foreign_key(
        "fk_users_client_id_clients",
        "users",
        "clients",
        ["client_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_client_id_clients", "users", type_="foreignkey")
    op.drop_index("ix_users_client_id", table_name="users")
    op.drop_column("users", "client_id")
