"""Service that aggregates data for the Overview dashboard page."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, or_, desc, and_, case, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    ActivityLog,
    Dashboard,
    DashboardShare,
    DataSource,
    Organization,
    OrgMember,
    Visualization,
    VisualizationShare,
    VisibilityType,
)


async def get_overview(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    role: str,
) -> dict:
    """Return all data the overview page needs in a single call."""

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Org name
    org_row = (await db.execute(select(Organization.name).where(Organization.id == org_id))).scalar()
    org_name = org_row or ""

    # ── Counts ──

    # Dashboards the user can access
    accessible_dash_stmt = (
        select(func.count())
        .select_from(Dashboard)
        .where(
            Dashboard.org_id == org_id,
            Dashboard.is_active == True,  # noqa: E712
            _access_filter(Dashboard, DashboardShare, user_id, role),
        )
    )
    dash_count = (await db.execute(accessible_dash_stmt)).scalar() or 0

    # Visualizations the user can access
    accessible_viz_stmt = (
        select(func.count())
        .select_from(Visualization)
        .where(
            Visualization.org_id == org_id,
            Visualization.is_active == True,  # noqa: E712
            _access_filter(Visualization, VisualizationShare, user_id, role),
        )
    )
    viz_count = (await db.execute(accessible_viz_stmt)).scalar() or 0

    # Data sources count (all in org for owner/admin, else 0)
    ds_count = 0
    ds_by_type: list[dict] = []
    if role in ("owner", "admin"):
        ds_count_stmt = (
            select(func.count())
            .select_from(DataSource)
            .where(DataSource.org_id == org_id, DataSource.is_active == True)  # noqa: E712
        )
        ds_count = (await db.execute(ds_count_stmt)).scalar() or 0

        ds_type_stmt = (
            select(DataSource.ds_type, func.count().label("count"))
            .where(DataSource.org_id == org_id, DataSource.is_active == True)  # noqa: E712
            .group_by(DataSource.ds_type)
        )
        ds_by_type = [
            {"ds_type": row.ds_type.value, "count": row.count}
            for row in (await db.execute(ds_type_stmt)).all()
        ]

    # Team member count
    member_count_stmt = (
        select(func.count())
        .select_from(OrgMember)
        .where(OrgMember.org_id == org_id, OrgMember.is_active == True)  # noqa: E712
    )
    member_count = (await db.execute(member_count_stmt)).scalar() or 0

    # User's query count (last 30 days)
    queries_30d_stmt = (
        select(func.count())
        .select_from(ActivityLog)
        .where(
            ActivityLog.user_id == user_id,
            ActivityLog.org_id == org_id,
            ActivityLog.event_type == "query.executed",
            ActivityLog.created_at >= month_ago,
        )
    )
    queries_30d = (await db.execute(queries_30d_stmt)).scalar() or 0

    # ── Recent dashboards viewed (user-specific, access-filtered) ──

    recent_dash_stmt = (
        select(
            ActivityLog.resource_id,
            func.max(ActivityLog.created_at).label("last_viewed"),
        )
        .where(
            ActivityLog.user_id == user_id,
            ActivityLog.org_id == org_id,
            ActivityLog.event_type == "dashboard.viewed",
            ActivityLog.resource_id.isnot(None),
        )
        .group_by(ActivityLog.resource_id)
        .order_by(desc(func.max(ActivityLog.created_at)))
        .limit(10)
    )
    recent_dash_rows = (await db.execute(recent_dash_stmt)).all()
    recent_dash_ids = [row.resource_id for row in recent_dash_rows]
    recent_dash_times = {row.resource_id: row.last_viewed for row in recent_dash_rows}

    recent_dashboards: list[dict] = []
    if recent_dash_ids:
        dash_stmt = (
            select(Dashboard)
            .where(
                Dashboard.id.in_(recent_dash_ids),
                Dashboard.is_active == True,  # noqa: E712
                _access_filter(Dashboard, DashboardShare, user_id, role),
            )
        )
        dashes = {d.id: d for d in (await db.execute(dash_stmt)).scalars().all()}
        for did in recent_dash_ids:
            if did in dashes:
                d = dashes[did]
                recent_dashboards.append({
                    "id": str(d.id),
                    "title": d.title,
                    "visibility": d.visibility.value,
                    "creator_name": d.creator.full_name if d.creator else "",
                    "last_viewed": recent_dash_times[did].isoformat(),
                })
            if len(recent_dashboards) >= 5:
                break

    # ── Recent visualizations viewed ──

    recent_viz_stmt = (
        select(
            ActivityLog.resource_id,
            func.max(ActivityLog.created_at).label("last_viewed"),
        )
        .where(
            ActivityLog.user_id == user_id,
            ActivityLog.org_id == org_id,
            ActivityLog.event_type == "visualization.viewed",
            ActivityLog.resource_id.isnot(None),
        )
        .group_by(ActivityLog.resource_id)
        .order_by(desc(func.max(ActivityLog.created_at)))
        .limit(10)
    )
    recent_viz_rows = (await db.execute(recent_viz_stmt)).all()
    recent_viz_ids = [row.resource_id for row in recent_viz_rows]
    recent_viz_times = {row.resource_id: row.last_viewed for row in recent_viz_rows}

    recent_visualizations: list[dict] = []
    if recent_viz_ids:
        viz_stmt = (
            select(Visualization)
            .where(
                Visualization.id.in_(recent_viz_ids),
                Visualization.is_active == True,  # noqa: E712
                _access_filter(Visualization, VisualizationShare, user_id, role),
            )
        )
        vizs = {v.id: v for v in (await db.execute(viz_stmt)).scalars().all()}
        for vid in recent_viz_ids:
            if vid in vizs:
                v = vizs[vid]
                recent_visualizations.append({
                    "id": str(v.id),
                    "title": v.title,
                    "chart_type": v.chart_type.value,
                    "visibility": v.visibility.value,
                    "creator_name": v.creator.full_name if v.creator else "",
                    "last_viewed": recent_viz_times[vid].isoformat(),
                })
            if len(recent_visualizations) >= 5:
                break

    # ── Popular dashboards (org-wide, access-filtered) ──

    popular_dash_stmt = (
        select(
            ActivityLog.resource_id,
            func.count().label("view_count"),
            func.count(func.distinct(ActivityLog.user_id)).label("unique_users"),
        )
        .where(
            ActivityLog.org_id == org_id,
            ActivityLog.event_type == "dashboard.viewed",
            ActivityLog.resource_id.isnot(None),
            ActivityLog.created_at >= month_ago,
        )
        .group_by(ActivityLog.resource_id)
        .order_by(desc(func.count()))
        .limit(15)
    )
    popular_dash_rows = (await db.execute(popular_dash_stmt)).all()
    popular_dash_ids = [row.resource_id for row in popular_dash_rows]
    popular_dash_stats = {row.resource_id: (row.view_count, row.unique_users) for row in popular_dash_rows}

    popular_dashboards: list[dict] = []
    if popular_dash_ids:
        dash_stmt = (
            select(Dashboard)
            .where(
                Dashboard.id.in_(popular_dash_ids),
                Dashboard.is_active == True,  # noqa: E712
                _access_filter(Dashboard, DashboardShare, user_id, role),
            )
        )
        dashes = {d.id: d for d in (await db.execute(dash_stmt)).scalars().all()}
        for did in popular_dash_ids:
            if did in dashes:
                d = dashes[did]
                vc, uu = popular_dash_stats[did]
                popular_dashboards.append({
                    "id": str(d.id),
                    "title": d.title,
                    "visibility": d.visibility.value,
                    "creator_name": d.creator.full_name if d.creator else "",
                    "view_count": vc,
                    "unique_users": uu,
                })
            if len(popular_dashboards) >= 5:
                break

    # ── Trending this week (dashboards with biggest view spike this week vs last week) ──

    trending_this_week_stmt = (
        select(
            ActivityLog.resource_id,
            func.count().label("views_this_week"),
        )
        .where(
            ActivityLog.org_id == org_id,
            ActivityLog.event_type == "dashboard.viewed",
            ActivityLog.resource_id.isnot(None),
            ActivityLog.created_at >= week_ago,
        )
        .group_by(ActivityLog.resource_id)
        .order_by(desc(func.count()))
        .limit(10)
    )
    trending_rows = (await db.execute(trending_this_week_stmt)).all()
    trending_ids = [row.resource_id for row in trending_rows]
    trending_counts = {row.resource_id: row.views_this_week for row in trending_rows}

    trending_dashboards: list[dict] = []
    if trending_ids:
        dash_stmt = (
            select(Dashboard)
            .where(
                Dashboard.id.in_(trending_ids),
                Dashboard.is_active == True,  # noqa: E712
                _access_filter(Dashboard, DashboardShare, user_id, role),
            )
        )
        dashes = {d.id: d for d in (await db.execute(dash_stmt)).scalars().all()}
        for tid in trending_ids:
            if tid in dashes:
                d = dashes[tid]
                trending_dashboards.append({
                    "id": str(d.id),
                    "title": d.title,
                    "visibility": d.visibility.value,
                    "creator_name": d.creator.full_name if d.creator else "",
                    "views_this_week": trending_counts[tid],
                })
            if len(trending_dashboards) >= 5:
                break

    # ── Activity trend (last 7 days, per-day counts) — owner/admin only ──

    activity_trend: list[dict] = []
    most_active_users: list[dict] = []
    total_dashboards_org = 0
    total_viz_org = 0

    if role in ("owner", "admin"):
        # Unique users who logged in per day (last 7 days)
        trend_stmt = (
            select(
                func.date(ActivityLog.created_at).label("day"),
                func.count(func.distinct(ActivityLog.user_id)).label("event_count"),
            )
            .where(
                ActivityLog.org_id == org_id,
                ActivityLog.created_at >= week_ago,
            )
            .group_by(func.date(ActivityLog.created_at))
            .order_by(func.date(ActivityLog.created_at))
        )
        trend_rows = (await db.execute(trend_stmt)).all()
        activity_trend = [
            {"day": str(row.day), "event_count": row.event_count}
            for row in trend_rows
        ]

        # Most active users (owner only)
        if role == "owner":
            active_users_stmt = (
                select(
                    ActivityLog.user_id,
                    func.count().label("event_count"),
                )
                .where(
                    ActivityLog.org_id == org_id,
                    ActivityLog.created_at >= week_ago,
                )
                .group_by(ActivityLog.user_id)
                .order_by(desc(func.count()))
                .limit(5)
            )
            active_rows = (await db.execute(active_users_stmt)).all()
            # Resolve names
            from app.models.models import User
            if active_rows:
                user_ids = [r.user_id for r in active_rows]
                user_stmt = select(User).where(User.id.in_(user_ids))
                users = {u.id: u for u in (await db.execute(user_stmt)).scalars().all()}
                most_active_users = [
                    {
                        "user_id": str(r.user_id),
                        "full_name": users[r.user_id].full_name if r.user_id in users else "Unknown",
                        "event_count": r.event_count,
                    }
                    for r in active_rows
                ]

        # Total org-wide dashboards
        total_dash_stmt = (
            select(func.count()).select_from(Dashboard)
            .where(Dashboard.org_id == org_id, Dashboard.is_active == True)  # noqa: E712
        )
        total_dashboards_org = (await db.execute(total_dash_stmt)).scalar() or 0

        # Total org-wide visualizations
        total_viz_stmt = (
            select(func.count()).select_from(Visualization)
            .where(Visualization.org_id == org_id, Visualization.is_active == True)  # noqa: E712
        )
        total_viz_org = (await db.execute(total_viz_stmt)).scalar() or 0

    return {
        "org_name": org_name,
        # Counts
        "dashboard_count": dash_count,
        "visualization_count": viz_count,
        "datasource_count": ds_count,
        "member_count": member_count,
        "queries_30d": queries_30d,
        "ds_by_type": ds_by_type,
        # Recent
        "recent_dashboards": recent_dashboards,
        "recent_visualizations": recent_visualizations,
        # Popular & Trending
        "popular_dashboards": popular_dashboards,
        "trending_dashboards": trending_dashboards,
        # Owner/Admin analytics
        "activity_trend": activity_trend,
        "most_active_users": most_active_users,
        "total_dashboards_org": total_dashboards_org,
        "total_visualizations_org": total_viz_org,
    }


def _access_filter(model, share_model, user_id, role):
    """Return an OR filter for visibility-based access.

    Owner/Admin can see everything in the org.
    Members can see public + own + shared.
    """
    if role in ("owner", "admin"):
        return True  # No additional filter needed

    # Determine which FK column to use on the share table
    if share_model is DashboardShare:
        fk_col = DashboardShare.dashboard_id
    else:
        fk_col = VisualizationShare.visualization_id

    return or_(
        model.visibility == VisibilityType.public,
        model.created_by == user_id,
        model.id.in_(
            select(fk_col).where(share_model.user_id == user_id)
        ),
    )


def _share_fk(share_model):
    """Get the FK column name for the share model (dashboard_id or visualization_id)."""
    for col in share_model.__table__.columns:
        if col.name.endswith("_id") and col.name not in ("id", "user_id", "granted_by"):
            return col.name
    return "id"
