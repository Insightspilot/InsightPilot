from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.models import OrgRole
from app.schemas.schemas import (
    CreateVisualizationRequest,
    UpdateVisualizationRequest,
    VisualizationResponse,
    VisualizationListItem,
    VisualizationShareRequest,
    VisualizationShareResponse,
    GenerateInsightsRequest,
    GenerateInsightsResponse,
)
from app.services import visualization_service, gemini_service

router = APIRouter(
    prefix="/orgs/{org_id}/visualizations",
    tags=["visualizations"],
)


def _build_response(viz) -> VisualizationResponse:
    shares = [
        VisualizationShareResponse(
            id=s.id,
            user_id=s.user_id,
            user_email=s.user.email,
            user_name=s.user.full_name,
            granted_by=s.granted_by,
            created_at=s.created_at,
        )
        for s in viz.shares
    ]
    return VisualizationResponse(
        id=viz.id,
        org_id=viz.org_id,
        ds_id=viz.ds_id,
        created_by=viz.created_by,
        creator_name=viz.creator.full_name,
        title=viz.title,
        description=viz.description,
        sql_query=viz.sql_query,
        chart_type=viz.chart_type,
        chart_config=viz.chart_config,
        visibility=viz.visibility,
        shared_with=shares,
        created_at=viz.created_at,
        updated_at=viz.updated_at,
    )


@router.post("", response_model=VisualizationResponse, status_code=status.HTTP_201_CREATED)
async def create_visualization(
    org_id: UUID,
    body: CreateVisualizationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new visualization from query results."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    viz = await visualization_service.create_visualization(
        db,
        org_id=org_id,
        user_id=current_user.user.id,
        ds_id=body.ds_id,
        title=body.title,
        description=body.description,
        sql_query=body.sql_query,
        chart_type=body.chart_type,
        chart_config=body.chart_config,
        visibility=body.visibility,
    )
    return _build_response(viz)


@router.get("", response_model=list[VisualizationListItem])
async def list_visualizations(
    org_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List visualizations accessible to the current user in this org."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    vizs = await visualization_service.list_visualizations(db, org_id, current_user.user.id)
    return [
        VisualizationListItem(
            id=v.id,
            title=v.title,
            description=v.description,
            chart_type=v.chart_type,
            visibility=v.visibility,
            created_by=v.created_by,
            creator_name=v.creator.full_name,
            created_at=v.created_at,
            updated_at=v.updated_at,
        )
        for v in vizs
    ]


@router.get("/{viz_id}", response_model=VisualizationResponse)
async def get_visualization(
    org_id: UUID,
    viz_id: UUID,
    dashboard_id: UUID | None = Query(None, description="Dashboard context — grants access if user can see the dashboard"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific visualization with its data."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    viz = await visualization_service.get_visualization(db, org_id, current_user.user.id, viz_id, dashboard_id=dashboard_id)
    if not viz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")
    return _build_response(viz)


@router.patch("/{viz_id}", response_model=VisualizationResponse)
async def update_visualization(
    org_id: UUID,
    viz_id: UUID,
    body: UpdateVisualizationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a visualization. Only the creator or admin/owner can update."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    viz = await visualization_service.get_visualization(db, org_id, current_user.user.id, viz_id)
    if not viz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")

    # Only creator or admin/owner can update
    if viz.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can update")

    viz = await visualization_service.update_visualization(
        db, viz,
        title=body.title,
        description=body.description,
        sql_query=body.sql_query,
        chart_type=body.chart_type,
        chart_config=body.chart_config,
        visibility=body.visibility,
    )
    return _build_response(viz)


@router.delete("/{viz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visualization(
    org_id: UUID,
    viz_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a visualization. Only the creator or admin/owner can delete."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    viz = await visualization_service.get_visualization(db, org_id, current_user.user.id, viz_id)
    if not viz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")

    if viz.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can delete")

    await visualization_service.delete_visualization(db, viz)


@router.post("/{viz_id}/insights", response_model=GenerateInsightsResponse)
async def generate_visualization_insights(
    org_id: UUID,
    viz_id: UUID,
    body: GenerateInsightsRequest,
    dashboard_id: UUID | None = Query(None, description="Dashboard context — grants access if user can see the dashboard"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI insights for a visualization given its query results."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    viz = await visualization_service.get_visualization(
        db, org_id, current_user.user.id, viz_id, dashboard_id=dashboard_id
    )
    if not viz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")

    result = await gemini_service.generate_insights(
        title=viz.title,
        description=viz.description,
        chart_type=viz.chart_type.value if hasattr(viz.chart_type, "value") else str(viz.chart_type),
        chart_config=viz.chart_config,
        columns=body.columns,
        rows=body.rows,
        truncated=body.truncated,
    )

    return GenerateInsightsResponse(**result)


@router.post("/{viz_id}/share", response_model=list[VisualizationShareResponse])
async def share_visualization(
    org_id: UUID,
    viz_id: UUID,
    body: VisualizationShareRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share a visualization with other users in the same org."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    viz = await visualization_service.get_visualization(db, org_id, current_user.user.id, viz_id)
    if not viz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")

    # Only creator or admin/owner can share
    if viz.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can share")

    try:
        shares = await visualization_service.share_visualization(
            db, org_id, viz, body.user_ids, current_user.user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return [
        VisualizationShareResponse(
            id=s.id,
            user_id=s.user_id,
            user_email=s.user.email,
            user_name=s.user.full_name,
            granted_by=s.granted_by,
            created_at=s.created_at,
        )
        for s in shares
    ]


@router.delete("/{viz_id}/share/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_share(
    org_id: UUID,
    viz_id: UUID,
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a user's access to a shared visualization."""
    if current_user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    viz = await visualization_service.get_visualization(db, org_id, current_user.user.id, viz_id)
    if not viz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")

    if viz.created_by != current_user.user.id and current_user.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator or admin can manage sharing")

    await visualization_service.remove_share(db, viz, user_id)
