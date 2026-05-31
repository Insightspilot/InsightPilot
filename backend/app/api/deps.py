from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.session import get_db
from app.models.models import User, OrgMember, OrgRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


class CurrentUser:
    def __init__(self, user: User, org_id: UUID | None, role: OrgRole | None):
        self.user = user
        self.org_id = org_id
        self.role = role


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == UUID(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    # Validate token version — rejects tokens issued before a role change
    token_version = payload.get("tv")
    if token_version is not None and token_version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalidated. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    org_id = payload.get("org_id")
    role = payload.get("role")

    return CurrentUser(
        user=user,
        org_id=UUID(org_id) if org_id else None,
        role=OrgRole(role) if role else None,
    )


def require_role(*allowed_roles: OrgRole):
    async def dependency(
        org_id: UUID,
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current_user.org_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No organization context. Please select an org.",
            )
        if current_user.org_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: org mismatch",
            )
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: requires role {[r.value for r in allowed_roles]}",
            )
        return current_user

    return dependency
