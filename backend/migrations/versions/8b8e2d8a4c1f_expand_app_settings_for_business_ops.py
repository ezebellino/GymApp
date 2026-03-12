"""expand app settings for business ops

Revision ID: 8b8e2d8a4c1f
Revises: 16359bf4e818
Create Date: 2026-03-11 23:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8b8e2d8a4c1f"
down_revision: Union[str, Sequence[str], None] = "16359bf4e818"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SETTINGS_TABLE = "app_settings"


def _has_table(bind) -> bool:
    inspector = sa.inspect(bind)
    return SETTINGS_TABLE in inspector.get_table_names()


def _existing_columns(bind) -> set[str]:
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(SETTINGS_TABLE)}


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind):
        op.create_table(
            SETTINGS_TABLE,
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("gym_name", sa.String(), nullable=False),
            sa.Column("currency", sa.String(), nullable=False),
            sa.Column("default_fee", sa.Integer(), nullable=False),
            sa.Column("address", sa.String(), nullable=True),
            sa.Column("contact_email", sa.String(), nullable=True),
            sa.Column("contact_phone", sa.String(), nullable=True),
            sa.Column("whatsapp_phone", sa.String(), nullable=True),
            sa.Column("business_hours", sa.String(), nullable=True),
            sa.Column("payment_alias", sa.String(), nullable=True),
            sa.Column("payment_notes", sa.String(), nullable=True),
            sa.Column("late_fee_grace_days", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("allow_cash", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("allow_transfer", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("onboarding_message", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        return

    existing = _existing_columns(bind)

    if "contact_email" not in existing:
        op.add_column(SETTINGS_TABLE, sa.Column("contact_email", sa.String(), nullable=True))
    if "contact_phone" not in existing:
        op.add_column(SETTINGS_TABLE, sa.Column("contact_phone", sa.String(), nullable=True))
    if "whatsapp_phone" not in existing:
        op.add_column(SETTINGS_TABLE, sa.Column("whatsapp_phone", sa.String(), nullable=True))
    if "business_hours" not in existing:
        op.add_column(SETTINGS_TABLE, sa.Column("business_hours", sa.String(), nullable=True))
    if "payment_alias" not in existing:
        op.add_column(SETTINGS_TABLE, sa.Column("payment_alias", sa.String(), nullable=True))
    if "payment_notes" not in existing:
        op.add_column(SETTINGS_TABLE, sa.Column("payment_notes", sa.String(), nullable=True))
    if "late_fee_grace_days" not in existing:
        op.add_column(
            SETTINGS_TABLE,
            sa.Column("late_fee_grace_days", sa.Integer(), nullable=False, server_default="5"),
        )
    if "allow_cash" not in existing:
        op.add_column(
            SETTINGS_TABLE,
            sa.Column("allow_cash", sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    if "allow_transfer" not in existing:
        op.add_column(
            SETTINGS_TABLE,
            sa.Column("allow_transfer", sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    if "onboarding_message" not in existing:
        op.add_column(SETTINGS_TABLE, sa.Column("onboarding_message", sa.String(), nullable=True))

    op.execute(
        """
        UPDATE app_settings
        SET late_fee_grace_days = COALESCE(late_fee_grace_days, 5),
            allow_cash = COALESCE(allow_cash, TRUE),
            allow_transfer = COALESCE(allow_transfer, TRUE)
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind):
        return

    existing = _existing_columns(bind)
    for column_name in [
        "onboarding_message",
        "allow_transfer",
        "allow_cash",
        "late_fee_grace_days",
        "payment_notes",
        "payment_alias",
        "business_hours",
        "whatsapp_phone",
        "contact_phone",
        "contact_email",
    ]:
        if column_name in existing:
            op.drop_column(SETTINGS_TABLE, column_name)
