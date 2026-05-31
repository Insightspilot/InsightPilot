import asyncio
from sqlalchemy import text
from app.db.session import engine as async_engine


async def main():
    async with async_engine.connect() as conn:
        # Create dashboards table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS insightpilot.dashboards (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id UUID NOT NULL REFERENCES insightpilot.organizations(id),
                created_by UUID NOT NULL REFERENCES insightpilot.users(id),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                layout JSONB NOT NULL DEFAULT '{}',
                visibility insightpilot.visibility_type NOT NULL DEFAULT 'private',
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        # Create index on org_id
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_dashboards_org_id ON insightpilot.dashboards(org_id)
        """))
        # Create dashboard_shares table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS insightpilot.dashboard_shares (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                dashboard_id UUID NOT NULL REFERENCES insightpilot.dashboards(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES insightpilot.users(id),
                granted_by UUID NOT NULL REFERENCES insightpilot.users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        # Create index on dashboard_id
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_dashboard_shares_dashboard_id ON insightpilot.dashboard_shares(dashboard_id)
        """))
        await conn.commit()
        print("Tables created successfully!")

    # Also stamp alembic to mark migration as done
    async with async_engine.connect() as conn:
        await conn.execute(text("""
            UPDATE alembic_version SET version_num = 'c4d9e2f18a67'
        """))
        await conn.commit()
        print("Alembic version stamped to c4d9e2f18a67")


asyncio.run(main())
