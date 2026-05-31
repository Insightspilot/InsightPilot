from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Dashboard,
    DashboardShare,
    VisibilityType,
    OrgMember,
)


async def create_dashboard(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    *,
    title: str,
    description: str | None,
    layout: dict,
    visibility: str,
) -> Dashboard:
    dashboard = Dashboard(
        org_id=org_id,
        created_by=user_id,
        title=title,
        description=description,
        layout=layout,
        visibility=visibility,
    )
    db.add(dashboard)
    await db.commit()
    # Re-fetch with relationships loaded (selectin)
    stmt = select(Dashboard).where(Dashboard.id == dashboard.id)
    result = await db.execute(stmt)
    return result.scalar_one()


async def list_dashboards(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
) -> list[Dashboard]:
    """List dashboards the user can see: public in org + private owned + shared with user."""
    stmt = (
        select(Dashboard)
        .where(
            Dashboard.org_id == org_id,
            Dashboard.is_active == True,
            or_(
                Dashboard.visibility == VisibilityType.public,
                Dashboard.created_by == user_id,
                Dashboard.id.in_(
                    select(DashboardShare.dashboard_id).where(
                        DashboardShare.user_id == user_id
                    )
                ),
            ),
        )
        .order_by(Dashboard.updated_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_dashboard(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    dashboard_id: UUID,
) -> Dashboard | None:
    """Get a dashboard if user has access."""
    stmt = select(Dashboard).where(
        Dashboard.id == dashboard_id,
        Dashboard.org_id == org_id,
        Dashboard.is_active == True,
    )
    result = await db.execute(stmt)
    dashboard = result.scalar_one_or_none()
    if dashboard is None:
        return None
    if dashboard.visibility == VisibilityType.public:
        return dashboard
    if dashboard.created_by == user_id:
        return dashboard
    shared = any(s.user_id == user_id for s in dashboard.shares)
    if shared:
        return dashboard
    return None


async def update_dashboard(
    db: AsyncSession,
    dashboard: Dashboard,
    *,
    title: str | None = None,
    description: str | None = None,
    layout: dict | None = None,
    visibility: str | None = None,
) -> Dashboard:
    if title is not None:
        dashboard.title = title
    if description is not None:
        dashboard.description = description
    if layout is not None:
        dashboard.layout = layout
    if visibility is not None:
        dashboard.visibility = visibility
    await db.commit()
    await db.refresh(dashboard)
    return dashboard


async def delete_dashboard(db: AsyncSession, dashboard: Dashboard) -> None:
    dashboard.is_active = False
    await db.commit()


async def share_dashboard(
    db: AsyncSession,
    org_id: UUID,
    dashboard: Dashboard,
    user_ids: list[UUID],
    granted_by: UUID,
) -> list[DashboardShare]:
    """Share a dashboard with users. Only users in the same org can be shared with."""
    stmt = select(OrgMember.user_id).where(
        OrgMember.org_id == org_id,
        OrgMember.user_id.in_(user_ids),
        OrgMember.is_active == True,
    )
    result = await db.execute(stmt)
    valid_user_ids = set(result.scalars().all())

    invalid = set(user_ids) - valid_user_ids
    if invalid:
        raise ValueError(f"Users not in this organization: {[str(uid) for uid in invalid]}")

    existing_stmt = select(DashboardShare).where(
        DashboardShare.dashboard_id == dashboard.id,
        DashboardShare.user_id.in_(user_ids),
    )
    existing_result = await db.execute(existing_stmt)
    existing_user_ids = {s.user_id for s in existing_result.scalars().all()}

    for uid in valid_user_ids:
        if uid not in existing_user_ids and uid != dashboard.created_by:
            share = DashboardShare(
                dashboard_id=dashboard.id,
                user_id=uid,
                granted_by=granted_by,
            )
            db.add(share)

    await db.commit()
    await db.refresh(dashboard)
    return dashboard.shares


async def remove_share(
    db: AsyncSession,
    dashboard: Dashboard,
    user_id: UUID,
) -> None:
    stmt = select(DashboardShare).where(
        DashboardShare.dashboard_id == dashboard.id,
        DashboardShare.user_id == user_id,
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()
    if share:
        await db.delete(share)
        await db.commit()
