"""add activity_logs table

Revision ID: a1b2c3d4e5f6
Revises: f7b2c8d35a12
Create Date: 2026-05-17 10:00:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f7b2c8d35a12"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insightpilot.users.id"), nullable=False, index=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insightpilot.organizations.id"), nullable=False, index=True),
        sa.Column("event_type", sa.String(100), nullable=False, index=True),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSON, nullable=True),
        sa.Column("session_id", sa.String(100), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True),
        schema="insightpilot",
    )

    # Composite index for common queries: user activity over time
    op.create_index(
        "ix_activity_logs_user_event",
        "activity_logs",
        ["user_id", "event_type", "created_at"],
        schema="insightpilot",
    )

    # Index for org-wide activity feed
    op.create_index(
        "ix_activity_logs_org_created",
        "activity_logs",
        ["org_id", "created_at"],
        schema="insightpilot",
    )


def downgrade() -> None:
    op.drop_index("ix_activity_logs_org_created", table_name="activity_logs", schema="insightpilot")
    op.drop_index("ix_activity_logs_user_event", table_name="activity_logs", schema="insightpilot")
    op.drop_table("activity_logs", schema="insightpilot")
