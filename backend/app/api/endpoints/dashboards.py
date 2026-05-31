from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.models import OrgRole
from app.schemas.schemas import (
    CreateDashboardRequest,
    UpdateDashboardRequest,
    DashboardResponse,
    DashboardListItem,
    DashboardShareRequest,
    DashboardShareResponse,
    DashboardVizAccessRequest,
    DashboardVizAccessItem,
)
from app.services import dashboard_service, visualization_service

router = APIRouter(
    prefix="/orgs/{org_id}/dashboards",
    tags=["dashboards"],
)


def _build_response(d) -> DashboardResponse:
    shares = [
        DashboardShareResponse(
            id=s.id,
            user_id=s.user_id,
            user_email=s.user.email,
            user_name=s.user.full_name,
            granted_by=s.granted_by,
            created_at=s.created_at,
        )
        for s in d.shares
    ]
    return DashboardResponse(
        id=d.id,
        org_id=d.org_id,
        created_by=d.created_by,
        creator_name=d.creator.full_name,
        title=d.title,
        description=d.description,
        layout=d.layout,
        visibility=d.visibility,
        shared_with=shares,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


@router.post("", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    org_id: UUID,
    body: CreateDashboardRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    d = await dashboard_service.create_dashboard(
        db,
        org_id=org_id,
        user_id=current_user.user.id,
        title=body.title,
        description=body.description,
        layout=body.layout,
        visibility=body.visibility,
    )
    return _build_response(d)


@router.get("", response_model=list[DashboardListItem])
async def list_dashboards(
    org_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    dashboards = await dashboard_service.list_dashboards(db, org_id, current_user.user.id)
    return [
        DashboardListItem(
            id=d.id,
            title=d.title,
            description=d.description,
            visibility=d.visibility,
            created_by=d.created_by,
            creator_name=d.creator.full_name,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in dashboards
    ]


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    org_id: UUID,
    dashboard_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    d = await dashboard_service.get_dashboard(db, org_id, current_user.user.id, dashboard_id)
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    return _build_response(d)


@router.patch("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    org_id: UUID,
    dashboard_id: UUID,
    body: UpdateDashboardRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    d = await dashboard_service.get_dashboard(db, org_id, current_user.user.id, dashboard_id)
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    if d.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can update")

    d = await dashboard_service.update_dashboard(
        db, d,
        title=body.title,
        description=body.description,
        layout=body.layout,
        visibility=body.visibility,
    )
    return _build_response(d)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    org_id: UUID,
    dashboard_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    d = await dashboard_service.get_dashboard(db, org_id, current_user.user.id, dashboard_id)
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    if d.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can delete")

    await dashboard_service.delete_dashboard(db, d)


@router.post("/{dashboard_id}/share", response_model=list[DashboardShareResponse])
async def share_dashboard(
    org_id: UUID,
    dashboard_id: UUID,
    body: DashboardShareRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    d = await dashboard_service.get_dashboard(db, org_id, current_user.user.id, dashboard_id)
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    if d.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can share")

    try:
        shares = await dashboard_service.share_dashboard(
            db, org_id, d, body.user_ids, current_user.user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return [
        DashboardShareResponse(
            id=s.id,
            user_id=s.user_id,
            user_email=s.user.email,
            user_name=s.user.full_name,
            granted_by=s.granted_by,
            created_at=s.created_at,
        )
        for s in shares
    ]


@router.post("/{dashboard_id}/check-viz-access", response_model=list[DashboardVizAccessItem])
async def check_viz_access(
    org_id: UUID,
    dashboard_id: UUID,
    body: DashboardVizAccessRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check which dashboard visualizations each user cannot access directly."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    d = await dashboard_service.get_dashboard(db, org_id, current_user.user.id, dashboard_id)
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    # Extract viz IDs from dashboard layout
    viz_ids: list[UUID] = []
    layout = d.layout or {}
    for tab in layout.get("tabs", []):
        for widget in tab.get("widgets", []):
            vid = widget.get("vizId")
            if vid and widget.get("type") == "viz":
                try:
                    viz_ids.append(UUID(vid))
                except ValueError:
                    pass

    if not viz_ids:
        return []

    # For each user, check which vizs they can't access
    from app.models.models import User as UserModel
    from sqlalchemy import select as sa_select

    # Get user names
    user_stmt = sa_select(UserModel).where(UserModel.id.in_(body.user_ids))
    user_result = await db.execute(user_stmt)
    user_map = {u.id: u.full_name for u in user_result.scalars().all()}

    results = []
    for uid in body.user_ids:
        inaccessible = []
        for vid in viz_ids:
            viz = await visualization_service.get_visualization(db, org_id, uid, vid)
            if viz is None:
                # Get viz title for the warning
                viz_raw = await visualization_service.get_visualization(
                    db, org_id, current_user.user.id, vid
                )
                inaccessible.append({
                    "viz_id": str(vid),
                    "title": viz_raw.title if viz_raw else "Unknown",
                })
        if inaccessible:
            results.append(DashboardVizAccessItem(
                user_id=uid,
                user_name=user_map.get(uid, "Unknown"),
                inaccessible_vizs=inaccessible,
            ))
    return results


@router.delete("/{dashboard_id}/share/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_share(
    org_id: UUID,
    dashboard_id: UUID,
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    d = await dashboard_service.get_dashboard(db, org_id, current_user.user.id, dashboard_id)
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    if d.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can manage sharing")

    await dashboard_service.remove_share(db, d, user_id)
