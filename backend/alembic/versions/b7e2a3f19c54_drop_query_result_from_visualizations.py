"""drop query_result columns from visualizations

Revision ID: b7e2a3f19c54
Revises: a3c8f1e2d456
Create Date: 2026-05-16 12:00:00.000000

"""
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7e2a3f19c54'
down_revision: Union[str, None] = 'a3c8f1e2d456'
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.drop_column('visualizations', 'query_result_columns', schema='insightpilot')
    op.drop_column('visualizations', 'query_result_data', schema='insightpilot')


def downgrade() -> None:
    op.execute("ALTER TABLE insightpilot.visualizations ADD COLUMN query_result_columns JSON NOT NULL DEFAULT '[]'")
    op.execute("ALTER TABLE insightpilot.visualizations ADD COLUMN query_result_data JSON NOT NULL DEFAULT '[]'")
