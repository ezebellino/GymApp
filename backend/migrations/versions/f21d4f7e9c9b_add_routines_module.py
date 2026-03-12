"""add routines module

Revision ID: f21d4f7e9c9b
Revises: 8b8e2d8a4c1f
Create Date: 2026-03-12 15:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f21d4f7e9c9b"
down_revision: Union[str, Sequence[str], None] = "8b8e2d8a4c1f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "training_days",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("muscle_groups", sa.String(), nullable=False),
        sa.Column("day_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("day_order"),
    )

    op.create_table(
        "exercises",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("muscle_group", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exercises_muscle_group", "exercises", ["muscle_group"], unique=False)

    op.create_table(
        "training_day_exercises",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("day_id", sa.String(), nullable=False),
        sa.Column("exercise_id", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("assigned_by_user_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["day_id"], ["training_days.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("day_id", "exercise_id", name="uq_training_day_exercise"),
    )
    op.create_index("ix_training_day_exercises_day_id", "training_day_exercises", ["day_id"], unique=False)
    op.create_index(
        "ix_training_day_exercises_exercise_id",
        "training_day_exercises",
        ["exercise_id"],
        unique=False,
    )

    op.create_table(
        "workout_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("client_id", sa.String(), nullable=False),
        sa.Column("day_id", sa.String(), nullable=False),
        sa.Column("exercise_id", sa.String(), nullable=False),
        sa.Column("sets_count", sa.Integer(), nullable=True),
        sa.Column("reps", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("performed_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["day_id"], ["training_days.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workout_logs_client_id", "workout_logs", ["client_id"], unique=False)
    op.create_index("ix_workout_logs_day_id", "workout_logs", ["day_id"], unique=False)
    op.create_index("ix_workout_logs_exercise_id", "workout_logs", ["exercise_id"], unique=False)
    op.create_index("ix_workout_logs_performed_at", "workout_logs", ["performed_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_workout_logs_performed_at", table_name="workout_logs")
    op.drop_index("ix_workout_logs_exercise_id", table_name="workout_logs")
    op.drop_index("ix_workout_logs_day_id", table_name="workout_logs")
    op.drop_index("ix_workout_logs_client_id", table_name="workout_logs")
    op.drop_table("workout_logs")

    op.drop_index("ix_training_day_exercises_exercise_id", table_name="training_day_exercises")
    op.drop_index("ix_training_day_exercises_day_id", table_name="training_day_exercises")
    op.drop_table("training_day_exercises")

    op.drop_index("ix_exercises_muscle_group", table_name="exercises")
    op.drop_table("exercises")
    op.drop_table("training_days")
