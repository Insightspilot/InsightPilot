from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Organization, OrgMember, OrgRole


async def get_user_orgs(db: AsyncSession, user_id: UUID) -> list[dict]:
    result = await db.execute(
        select(OrgMember).where(OrgMember.user_id == user_id, OrgMember.is_active == True)
    )
    memberships = result.scalars().all()

    orgs = []
    for m in memberships:
        org = m.organization
        orgs.append({
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "role": m.role,
        })
    return orgs


async def get_org_detail(db: AsyncSession, org_id: UUID) -> Organization | None:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.is_active == True)
    )
    return result.scalar_one_or_none()


async def update_org(db: AsyncSession, org_id: UUID, name: str | None) -> Organization:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.is_active == True)
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise ValueError("Organization not found")

    if name is not None:
        org.name = name

    return org


async def deactivate_org(db: AsyncSession, org_id: UUID) -> str:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.is_active == True)
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise ValueError("Organization not found")

    org.is_active = False

    # Deactivate all memberships
    members_result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id)
    )
    for member in members_result.scalars().all():
        member.is_active = False

    return "Organization deactivated"
