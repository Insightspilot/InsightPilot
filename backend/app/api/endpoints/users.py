from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, require_role
from app.db.session import get_db
from app.models.models import OrgRole
from app.schemas.schemas import (
    CreateUserRequest,
    CreateUserResponse,
    MessageResponse,
    OrgMemberResponse,
    UpdateRoleRequest,
)
from app.services import user_service

router = APIRouter(prefix="/orgs/{org_id}/users", tags=["user management"])


@router.post("", response_model=CreateUserResponse)
async def create_user(
    body: CreateUserRequest,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await user_service.create_user_in_org(
            db,
            email=body.email,
            full_name=body.full_name,
            role=body.role,
            org_id=current_user.org_id,
            invited_by=current_user.user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return CreateUserResponse(**result)


@router.get("", response_model=list[OrgMemberResponse])
async def list_users(
    current_user: CurrentUser = Depends(require_role(OrgRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    members = await user_service.list_org_members(db, current_user.org_id)
    return members


@router.get("/{user_id}", response_model=OrgMemberResponse)
async def get_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    member = await user_service.get_org_member(db, current_user.org_id, user_id)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return member


@router.patch("/{user_id}/role", response_model=MessageResponse)
async def update_role(
    user_id: UUID,
    body: UpdateRoleRequest,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    try:
        message = await user_service.update_member_role(
            db, current_user.org_id, user_id, body.role
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return MessageResponse(message=message)


@router.delete("/{user_id}", response_model=MessageResponse)
async def remove_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    try:
        message = await user_service.deactivate_member(db, current_user.org_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return MessageResponse(message=message)
