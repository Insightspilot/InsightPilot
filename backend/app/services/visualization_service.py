import uuid
from uuid import UUID

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Visualization,
    VisualizationShare,
    VisibilityType,
    OrgMember,
    User,
    Dashboard,
    DashboardShare,
)


async def create_visualization(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    *,
    ds_id: UUID,
    title: str,
    description: str | None,
    sql_query: str,
    chart_type: str,
    chart_config: dict,
    visibility: str,
) -> Visualization:
    viz = Visualization(
        org_id=org_id,
        ds_id=ds_id,
        created_by=user_id,
        title=title,
        description=description,
        sql_query=sql_query,
        chart_type=chart_type,
        chart_config=chart_config,
        visibility=visibility,
    )
    db.add(viz)
    await db.commit()
    await db.refresh(viz)
    return viz


async def list_visualizations(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
) -> list[Visualization]:
    """List visualizations the user can see: public in org + private owned + shared with user."""
    stmt = (
        select(Visualization)
        .where(
            Visualization.org_id == org_id,
            Visualization.is_active == True,
            or_(
                Visualization.visibility == VisibilityType.public,
                Visualization.created_by == user_id,
                Visualization.id.in_(
                    select(VisualizationShare.visualization_id).where(
                        VisualizationShare.user_id == user_id
                    )
                ),
            ),
        )
        .order_by(Visualization.updated_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_visualization(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    viz_id: UUID,
    dashboard_id: UUID | None = None,
) -> Visualization | None:
    """Get a visualization if user has access."""
    stmt = select(Visualization).where(
        Visualization.id == viz_id,
        Visualization.org_id == org_id,
        Visualization.is_active == True,
    )
    result = await db.execute(stmt)
    viz = result.scalar_one_or_none()
    if viz is None:
        return None
    # Check access: public, owner, or shared
    if viz.visibility == VisibilityType.public:
        return viz
    if viz.created_by == user_id:
        return viz
    shared = any(s.user_id == user_id for s in viz.shares)
    if shared:
        return viz
    # Check if user has access via a shared dashboard containing this viz
    if dashboard_id is not None:
        dash_stmt = select(Dashboard).where(
            Dashboard.id == dashboard_id,
            Dashboard.org_id == org_id,
            Dashboard.is_active == True,
        )
        dash_result = await db.execute(dash_stmt)
        dashboard = dash_result.scalar_one_or_none()
        if dashboard is not None:
            has_dash_access = (
                dashboard.visibility == VisibilityType.public
                or dashboard.created_by == user_id
                or any(s.user_id == user_id for s in dashboard.shares)
            )
            if has_dash_access:
                return viz
    return None


async def update_visualization(
    db: AsyncSession,
    viz: Visualization,
    *,
    title: str | None = None,
    description: str | None = None,
    sql_query: str | None = None,
    chart_type: str | None = None,
    chart_config: dict | None = None,
    visibility: str | None = None,
) -> Visualization:
    if title is not None:
        viz.title = title
    if description is not None:
        viz.description = description
    if sql_query is not None:
        viz.sql_query = sql_query
    if chart_type is not None:
        viz.chart_type = chart_type
    if chart_config is not None:
        viz.chart_config = chart_config
    if visibility is not None:
        viz.visibility = visibility
    await db.commit()
    await db.refresh(viz)
    return viz


async def delete_visualization(db: AsyncSession, viz: Visualization) -> None:
    viz.is_active = False
    await db.commit()


async def share_visualization(
    db: AsyncSession,
    org_id: UUID,
    viz: Visualization,
    user_ids: list[UUID],
    granted_by: UUID,
) -> list[VisualizationShare]:
    """Share a visualization with users. Only users in the same org can be shared with."""
    # Validate all user_ids belong to this org
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

    # Remove existing shares for these users to avoid duplicates
    existing_stmt = select(VisualizationShare).where(
        VisualizationShare.visualization_id == viz.id,
        VisualizationShare.user_id.in_(user_ids),
    )
    existing_result = await db.execute(existing_stmt)
    existing_user_ids = {s.user_id for s in existing_result.scalars().all()}

    new_shares = []
    for uid in valid_user_ids:
        if uid not in existing_user_ids and uid != viz.created_by:
            share = VisualizationShare(
                visualization_id=viz.id,
                user_id=uid,
                granted_by=granted_by,
            )
            db.add(share)
            new_shares.append(share)

    await db.commit()
    # Refresh to get relations
    await db.refresh(viz)
    return viz.shares


async def remove_share(
    db: AsyncSession,
    viz: Visualization,
    user_id: UUID,
) -> None:
    """Remove a share for a specific user."""
    stmt = select(VisualizationShare).where(
        VisualizationShare.visualization_id == viz.id,
        VisualizationShare.user_id == user_id,
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()
    if share:
        await db.delete(share)
        await db.commit()
