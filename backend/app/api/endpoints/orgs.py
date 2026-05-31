from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models.models import OrgRole
from app.schemas.schemas import MessageResponse, OrgBrief, OrgDetail, OrgUpdateRequest
from app.services import org_service

router = APIRouter(prefix="/orgs", tags=["organizations"])


@router.get("", response_model=list[OrgBrief])
async def list_orgs(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    orgs = await org_service.get_user_orgs(db, current_user.user.id)
    return orgs


@router.get("/{org_id}", response_model=OrgDetail)
async def get_org(
    org_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = await org_service.get_org_detail(db, org_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrgDetail)
async def update_org(
    body: OrgUpdateRequest,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner, OrgRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    try:
        org = await org_service.update_org(db, current_user.org_id, body.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return org


@router.delete("/{org_id}", response_model=MessageResponse)
async def delete_org(
    current_user: CurrentUser = Depends(require_role(OrgRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    try:
        message = await org_service.deactivate_org(db, current_user.org_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return MessageResponse(message=message)
