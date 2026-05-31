from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, CurrentUser
from app.db.session import get_db
from app.schemas.schemas import (
    LogActivityRequest,
    LogActivityBatchRequest,
    ActivityLogResponse,
    UserActivitySummary,
    ActivitySummaryItem,
)
from app.services import activity_service
from app.services import overview_service

router = APIRouter(prefix="/orgs/{org_id}/activity", tags=["activity"])


@router.post("", status_code=201)
async def log_event(
    org_id: UUID,
    body: LogActivityRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityLogResponse:
    entry = await activity_service.log_activity(
        db,
        user_id=current_user.user.id,
        org_id=org_id,
        event_type=body.event_type,
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        metadata=body.metadata,
        session_id=body.session_id,
    )
    return ActivityLogResponse(
        id=entry.id,
        user_id=entry.user_id,
        org_id=entry.org_id,
        event_type=entry.event_type,
        resource_type=entry.resource_type,
        resource_id=entry.resource_id,
        metadata=entry.metadata_,
        session_id=entry.session_id,
        created_at=entry.created_at,
    )


@router.post("/batch", status_code=201)
async def log_events_batch(
    org_id: UUID,
    body: LogActivityBatchRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    events = [ev.model_dump() for ev in body.events]
    count = await activity_service.log_activity_batch(
        db,
        user_id=current_user.user.id,
        org_id=org_id,
        events=events,
    )
    return {"logged": count}


@router.get("")
async def get_my_activity(
    org_id: UUID,
    event_type: str | None = Query(None),
    resource_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityLogResponse]:
    logs = await activity_service.get_user_activity(
        db,
        user_id=current_user.user.id,
        org_id=org_id,
        event_type=event_type,
        resource_type=resource_type,
        limit=limit,
        offset=offset,
    )
    return [
        ActivityLogResponse(
            id=entry.id,
            user_id=entry.user_id,
            org_id=entry.org_id,
            event_type=entry.event_type,
            resource_type=entry.resource_type,
            resource_id=entry.resource_id,
            metadata=entry.metadata_,
            session_id=entry.session_id,
            created_at=entry.created_at,
        )
        for entry in logs
    ]


@router.get("/summary")
async def get_my_activity_summary(
    org_id: UUID,
    days: int = Query(30, ge=1, le=365),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserActivitySummary:
    summary = await activity_service.get_user_activity_summary(
        db,
        user_id=current_user.user.id,
        org_id=org_id,
        days=days,
    )
    return UserActivitySummary(
        total_events=summary["total_events"],
        events_by_type=[
            ActivitySummaryItem(**item) for item in summary["events_by_type"]
        ],
        recent_resources=[
            ActivityLogResponse(
                id=entry.id,
                user_id=entry.user_id,
                org_id=entry.org_id,
                event_type=entry.event_type,
                resource_type=entry.resource_type,
                resource_id=entry.resource_id,
                metadata=entry.metadata_,
                session_id=entry.session_id,
                created_at=entry.created_at,
            )
            for entry in summary["recent_resources"]
        ],
    )


@router.get("/popular")
async def get_popular_resources(
    org_id: UUID,
    resource_type: str | None = Query(None),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await activity_service.get_org_popular_resources(
        db,
        org_id=org_id,
        resource_type=resource_type,
        days=days,
        limit=limit,
    )


@router.get("/overview")
async def get_overview_data(
    org_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Single endpoint returning all data the overview page needs."""
    return await overview_service.get_overview(
        db,
        user_id=current_user.user.id,
        org_id=org_id,
        role=current_user.role.value if current_user.role else "member",
    )
