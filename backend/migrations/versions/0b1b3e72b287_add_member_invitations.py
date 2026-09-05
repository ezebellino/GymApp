"""add member invitations

Tabla `member_invitations` para el flujo de invitación por link (`member-invitation`,
design.md decision 9). Va en una revisión separada de la fusión `clients`->`users`
(`e790291219f2`) para que esa migración riesgosa quede aislada y revisable por
separado, aunque ambas corren juntas en el mismo `alembic upgrade head`.

Revision ID: 0b1b3e72b287
Revises: e790291219f2
Create Date: 2026-09-05 00:43:33.980529

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b1b3e72b287'
down_revision: Union[str, Sequence[str], None] = 'e790291219f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "member_invitations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("email_token_hash", sa.String(), nullable=False, unique=True),
        sa.Column("phone_token_hash", sa.String(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(), nullable=True),
        sa.Column("phone_verified_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_by_user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_member_invitations_user_id", "member_invitations", ["user_id"])
    # A lo sumo una invitación viva por usuario: el reenvío revoca la anterior antes
    # de crear una nueva (garantizado por la base, no solo por la app).
    op.create_index(
        "ix_member_invitations_user_id_live",
        "member_invitations",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL AND completed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_member_invitations_user_id_live", table_name="member_invitations")
    op.drop_index("ix_member_invitations_user_id", table_name="member_invitations")
    op.drop_table("member_invitations")
