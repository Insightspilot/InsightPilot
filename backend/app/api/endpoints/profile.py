from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.schemas.schemas import UpdateProfileRequest, UserProfile

router = APIRouter(prefix="/me", tags=["profile"])


@router.get("", response_model=UserProfile)
async def get_profile(current_user: CurrentUser = Depends(get_current_user)):
    return UserProfile.model_validate(current_user.user)


@router.patch("", response_model=UserProfile)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = current_user.user
    if body.full_name is not None:
        user.full_name = body.full_name
    return UserProfile.model_validate(user)
