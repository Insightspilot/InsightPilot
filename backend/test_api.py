import asyncio
import httpx
import jwt
from app.core.config import settings
from app.db.session import engine
from sqlalchemy import text


async def test():
    # Get a real user + org to build a token
    async with engine.connect() as conn:
        r = await conn.execute(text("""
            SELECT u.id as user_id, u.email, m.org_id
            FROM insightpilot.users u
            JOIN insightpilot.org_members m ON m.user_id = u.id
            LIMIT 1
        """))
        row = r.first()
        if not row:
            print("No users found!")
            return
        user_id, email, org_id = str(row[0]), row[1], str(row[2])
        print(f"User: {email}, org: {org_id}")

    # Create a JWT
    token = jwt.encode(
        {"sub": user_id, "org_id": org_id, "role": "admin", "type": "access"},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    print(f"Token: {token[:50]}...")

    # Call the create dashboard endpoint
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"http://localhost:8000/api/v1/orgs/{org_id}/dashboards",
            json={
                "title": "Test Dashboard",
                "description": None,
                "layout": {"tabs": [{"id": "tab1", "name": "Tab 1", "widgets": []}]},
                "visibility": "private",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        print(f"Status: {resp.status_code}")
        print(f"Content-Type: {resp.headers.get('content-type')}")
        print(f"Body: {resp.text[:500]}")


asyncio.run(test())
