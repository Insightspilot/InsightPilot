"""add_mongodb_to_ds_type_enum

Revision ID: e6a3b7d24f91
Revises: c4d9e2f18a67
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e6a3b7d24f91'
down_revision: Union[str, None] = 'c4d9e2f18a67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE insightpilot.ds_type ADD VALUE IF NOT EXISTS 'mongodb'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum type.
    # A full recreation would be needed, but that risks data loss.
    pass
