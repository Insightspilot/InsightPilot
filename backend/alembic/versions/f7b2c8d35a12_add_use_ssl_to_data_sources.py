"""add_use_ssl_to_data_sources

Revision ID: f7b2c8d35a12
Revises: e6a3b7d24f91
Create Date: 2026-05-17 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7b2c8d35a12'
down_revision: Union[str, None] = 'e6a3b7d24f91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'data_sources',
        sa.Column('use_ssl', sa.Boolean(), nullable=False, server_default='false'),
        schema='insightpilot',
    )


def downgrade() -> None:
    op.drop_column('data_sources', 'use_ssl', schema='insightpilot')
