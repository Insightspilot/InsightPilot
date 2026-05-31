"""add_visualizations_tables

Revision ID: a3c8f1e2d456
Revises: fa57497ead90
Create Date: 2026-05-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c8f1e2d456'
down_revision: Union[str, None] = 'd5b4549f7c88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TYPE IF EXISTS insightpilot.chart_type")
    op.execute("DROP TYPE IF EXISTS insightpilot.visibility_type")
    op.execute("CREATE TYPE insightpilot.chart_type AS ENUM ('table','bar','line','pie','area','scatter')")
    op.execute("CREATE TYPE insightpilot.visibility_type AS ENUM ('private','public')")

    op.execute("""
        CREATE TABLE insightpilot.visualizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES insightpilot.organizations(id),
            ds_id UUID NOT NULL REFERENCES insightpilot.data_sources(id),
            created_by UUID NOT NULL REFERENCES insightpilot.users(id),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            sql_query TEXT NOT NULL,
            chart_type insightpilot.chart_type NOT NULL,
            chart_config JSONB NOT NULL DEFAULT '{}'::jsonb,
            query_result_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
            query_result_data JSONB NOT NULL DEFAULT '[]'::jsonb,
            visibility insightpilot.visibility_type NOT NULL DEFAULT 'private',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_visualizations_org_id ON insightpilot.visualizations(org_id)")

    op.execute("""
        CREATE TABLE insightpilot.visualization_shares (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            visualization_id UUID NOT NULL REFERENCES insightpilot.visualizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES insightpilot.users(id),
            granted_by UUID NOT NULL REFERENCES insightpilot.users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_visualization_shares_viz_id ON insightpilot.visualization_shares(visualization_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS insightpilot.visualization_shares")
    op.execute("DROP TABLE IF EXISTS insightpilot.visualizations")
    op.execute("DROP TYPE IF EXISTS insightpilot.visibility_type")
    op.execute("DROP TYPE IF EXISTS insightpilot.chart_type")
