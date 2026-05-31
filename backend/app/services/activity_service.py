import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ActivityLog


async def log_activity(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    event_type: str,
    resource_type: str | None = None,
    resource_id: uuid.UUID | None = None,
    metadata: dict | None = None,
    session_id: str | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        user_id=user_id,
        org_id=org_id,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_=metadata,
        session_id=session_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def log_activity_batch(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    events: list[dict],
) -> int:
    entries = []
    for ev in events:
        entries.append(ActivityLog(
            user_id=user_id,
            org_id=org_id,
            event_type=ev["event_type"],
            resource_type=ev.get("resource_type"),
            resource_id=ev.get("resource_id"),
            metadata_=ev.get("metadata"),
            session_id=ev.get("session_id"),
        ))
    db.add_all(entries)
    await db.commit()
    return len(entries)


async def get_user_activity(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    event_type: str | None = None,
    resource_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[ActivityLog]:
    stmt = (
        select(ActivityLog)
        .where(ActivityLog.user_id == user_id, ActivityLog.org_id == org_id)
        .order_by(desc(ActivityLog.created_at))
    )
    if event_type:
        stmt = stmt.where(ActivityLog.event_type == event_type)
    if resource_type:
        stmt = stmt.where(ActivityLog.resource_type == resource_type)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_user_activity_summary(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    days: int = 30,
) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Count by event_type
    type_stmt = (
        select(
            ActivityLog.event_type,
            func.count().label("count"),
            func.max(ActivityLog.created_at).label("last_at"),
        )
        .where(
            ActivityLog.user_id == user_id,
            ActivityLog.org_id == org_id,
            ActivityLog.created_at >= since,
        )
        .group_by(ActivityLog.event_type)
        .order_by(desc(func.count()))
    )
    type_result = await db.execute(type_stmt)
    events_by_type = [
        {"event_type": row.event_type, "count": row.count, "last_at": row.last_at}
        for row in type_result.all()
    ]

    total_events = sum(e["count"] for e in events_by_type)

    # Recent resource views (unique resources)
    recent_stmt = (
        select(ActivityLog)
        .where(
            ActivityLog.user_id == user_id,
            ActivityLog.org_id == org_id,
            ActivityLog.resource_id.isnot(None),
            ActivityLog.created_at >= since,
        )
        .order_by(desc(ActivityLog.created_at))
        .limit(20)
    )
    recent_result = await db.execute(recent_stmt)
    recent_resources = list(recent_result.scalars().all())

    return {
        "total_events": total_events,
        "events_by_type": events_by_type,
        "recent_resources": recent_resources,
    }


async def get_org_popular_resources(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    resource_type: str | None = None,
    days: int = 30,
    limit: int = 10,
) -> list[dict]:
    """Get most viewed/interacted resources in an org for recommendations."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    stmt = (
        select(
            ActivityLog.resource_type,
            ActivityLog.resource_id,
            func.count().label("view_count"),
            func.count(func.distinct(ActivityLog.user_id)).label("unique_users"),
        )
        .where(
            ActivityLog.org_id == org_id,
            ActivityLog.resource_id.isnot(None),
            ActivityLog.created_at >= since,
        )
    )
    if resource_type:
        stmt = stmt.where(ActivityLog.resource_type == resource_type)

    stmt = (
        stmt
        .group_by(ActivityLog.resource_type, ActivityLog.resource_id)
        .order_by(desc(func.count()))
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        {
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "view_count": row.view_count,
            "unique_users": row.unique_users,
        }
        for row in result.all()
    ]
