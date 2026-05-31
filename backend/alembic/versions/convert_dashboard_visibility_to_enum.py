"""convert dashboard visibility to enum

Revision ID: xxxx
Revises: c4d9e2f18a67
"""

from alembic import op


revision = "1234"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE insightpilot.dashboards
        ALTER COLUMN visibility DROP DEFAULT;
    """)

    op.execute("""
        ALTER TABLE insightpilot.dashboards
        ALTER COLUMN visibility
        TYPE insightpilot.visibility_type
        USING visibility::insightpilot.visibility_type;
    """)

    op.execute("""
        ALTER TABLE insightpilot.dashboards
        ALTER COLUMN visibility
        SET DEFAULT 'private'::insightpilot.visibility_type;
    """)

def downgrade():
    op.execute("""
        ALTER TABLE insightpilot.dashboards
        ALTER COLUMN visibility DROP DEFAULT;
    """)

    op.execute("""
        ALTER TABLE insightpilot.dashboards
        ALTER COLUMN visibility
        TYPE VARCHAR(20)
        USING visibility::text;
    """)

    op.execute("""
        ALTER TABLE insightpilot.dashboards
        ALTER COLUMN visibility
        SET DEFAULT 'private';
    """)