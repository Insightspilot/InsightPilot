import asyncio
from sqlalchemy import text
from app.db.session import engine

async def test():
    async with engine.connect() as conn:
        r = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='insightpilot' AND table_name LIKE 'dashboard%'"))
        tables = list(r)
        print("Dashboard tables:", tables)
        
        # Check dashboards table columns
        r2 = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='insightpilot' AND table_name='dashboards' ORDER BY ordinal_position"))
        cols = list(r2)
        print("Columns:", cols)

asyncio.run(test())
