"""add membership plans

Revision ID: 6c1a341f03a2
Revises: 69362a3ad95d
Create Date: 2026-09-11 18:21:45.412028

Migración SOLO de esquema (`membership-plans`, design D3): crea `membership_plans`
y `membership_plan_prices`, y agrega a `users` las tres columnas de plan vigente,
todas nullable. Sin backfill, sin plan "General" automático, sin leer
`app_settings.default_fee`: el proyecto está en beta y los datos existentes son de
prueba, así que los miembros que ya existen quedan sin plan (invariante I6). El
downgrade es DESTRUCTIVO para los planes ya cargados: dropea las columnas de
`users` y las dos tablas nuevas, sin forma de conservar esos datos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6c1a341f03a2'
down_revision: Union[str, Sequence[str], None] = '69362a3ad95d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "membership_plans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("name_normalized", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name_normalized"),
    )

    op.create_table(
        "membership_plan_prices",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("plan_id", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["membership_plans.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "plan_id", "effective_from", name="uq_membership_plan_prices_plan_effective_from"
        ),
    )
    op.create_index(
        "ix_membership_plan_prices_plan_id", "membership_plan_prices", ["plan_id"], unique=False
    )
    op.create_index(
        "ix_membership_plan_prices_plan_effective_from",
        "membership_plan_prices",
        ["plan_id", "effective_from"],
        unique=False,
    )

    op.add_column("users", sa.Column("membership_plan_id", sa.String(), nullable=True))
    op.add_column("users", sa.Column("plan_since", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("plan_changed_by_user_id", sa.String(), nullable=True))
    op.create_index("ix_users_membership_plan_id", "users", ["membership_plan_id"], unique=False)
    op.create_foreign_key(
        "fk_users_membership_plan_id_membership_plans",
        "users",
        "membership_plans",
        ["membership_plan_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_users_plan_changed_by_user_id_users",
        "users",
        "users",
        ["plan_changed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_plan_changed_by_user_id_users", "users", type_="foreignkey")
    op.drop_constraint("fk_users_membership_plan_id_membership_plans", "users", type_="foreignkey")
    op.drop_index("ix_users_membership_plan_id", table_name="users")
    op.drop_column("users", "plan_changed_by_user_id")
    op.drop_column("users", "plan_since")
    op.drop_column("users", "membership_plan_id")

    op.drop_index("ix_membership_plan_prices_plan_effective_from", table_name="membership_plan_prices")
    op.drop_index("ix_membership_plan_prices_plan_id", table_name="membership_plan_prices")
    op.drop_table("membership_plan_prices")
    op.drop_table("membership_plans")
