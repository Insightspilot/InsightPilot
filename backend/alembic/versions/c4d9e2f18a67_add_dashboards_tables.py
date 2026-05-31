"""add dashboards tables

Revision ID: c4d9e2f18a67
Revises: b7e2a3f19c54
Create Date: 2026-05-16 20:00:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c4d9e2f18a67"
down_revision: Union[str, None] = "b7e2a3f19c54"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_table(
        "dashboards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insightpilot.organizations.id"), nullable=False, index=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("insightpilot.users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("layout", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("visibility", sa.Enum("private", "public", name="visibility_type", schema="insightpilot", create_type=False), nullable=False, server_default="private"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="insightpilot",
    )

    op.create_table(
        "dashboard_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dashboard_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insightpilot.dashboards.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insightpilot.users.id"), nullable=False),
        sa.Column("granted_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("insightpilot.users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="insightpilot",
    )


def downgrade() -> None:
    op.drop_table("dashboard_shares", schema="insightpilot")
    op.drop_table("dashboards", schema="insightpilot")
