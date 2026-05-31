from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.models import OrgMember, OrgRole, User
from app.services.auth_service import _generate_temp_password


async def create_user_in_org(
    db: AsyncSession,
    email: str,
    full_name: str,
    role: OrgRole,
    org_id: UUID,
    invited_by: UUID,
) -> dict:
    """Owner creates a new user or adds existing user to org. Returns user info + temp password."""

    if role == OrgRole.owner:
        raise ValueError("Cannot create another owner")

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    temp_password = _generate_temp_password()

    if user is None:
        # New user
        user = User(
            email=email,
            hashed_password=get_password_hash(temp_password),
            full_name=full_name,
            is_email_verified=True,  # owner-created users skip email verification
            force_password_change=True,
        )
        db.add(user)
        await db.flush()
    else:
        # Existing user — check if already in this org
        existing_member = await db.execute(
            select(OrgMember).where(
                OrgMember.user_id == user.id, OrgMember.org_id == org_id
            )
        )
        if existing_member.scalar_one_or_none():
            raise ValueError("User is already a member of this organization")
        temp_password = "(existing user — uses their current password)"

    # Add to org
    membership = OrgMember(
        user_id=user.id,
        org_id=org_id,
        role=role,
        invited_by=invited_by,
    )
    db.add(membership)

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "temp_password": temp_password,
        "role": role,
    }


async def list_org_members(db: AsyncSession, org_id: UUID) -> list[dict]:
    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.is_active == True)
    )
    memberships = result.scalars().all()

    members = []
    for m in memberships:
        user = m.user
        members.append({
            "id": m.id,
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": m.role,
            "is_active": m.is_active,
            "joined_at": m.joined_at,
        })
    return members


async def get_org_member(db: AsyncSession, org_id: UUID, user_id: UUID) -> dict | None:
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == user_id,
            OrgMember.is_active == True,
        )
    )
    m = result.scalar_one_or_none()
    if m is None:
        return None

    user = m.user
    return {
        "id": m.id,
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": m.role,
        "is_active": m.is_active,
        "joined_at": m.joined_at,
    }


async def update_member_role(
    db: AsyncSession, org_id: UUID, user_id: UUID, new_role: OrgRole
) -> str:
    if new_role == OrgRole.owner:
        raise ValueError("Cannot assign owner role. Use transfer ownership instead.")

    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == user_id,
            OrgMember.is_active == True,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise ValueError("Member not found")
    if membership.role == OrgRole.owner:
        raise ValueError("Cannot change the owner's role")

    membership.role = new_role

    # Bump token_version to invalidate the user's existing JWT
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if user:
        user.token_version += 1

    return f"Role updated to {new_role.value}"


async def deactivate_member(db: AsyncSession, org_id: UUID, user_id: UUID) -> str:
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == user_id,
            OrgMember.is_active == True,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise ValueError("Member not found")
    if membership.role == OrgRole.owner:
        raise ValueError("Cannot remove the owner")

    membership.is_active = False
    return "Member removed from organization"
