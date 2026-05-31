import hashlib
import random
import re
import string
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.models import EmailOTP, OTPPurpose, Organization, OrgMember, OrgRole, User


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _generate_temp_password() -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    return "".join(random.choices(chars, k=12))


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


async def signup(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    org_name: str,
) -> tuple[str, str]:
    """Create org + owner user. Returns (message, otp_plain)."""

    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already registered")

    # Check if org slug already exists
    slug = _slugify(org_name)
    existing_org = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing_org.scalar_one_or_none():
        raise ValueError("Organization name already taken")

    # Create user
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        is_email_verified=False,
        force_password_change=False,
    )
    db.add(user)
    await db.flush()

    # Create org
    org = Organization(name=org_name, slug=slug)
    db.add(org)
    await db.flush()

    # Create membership as owner
    membership = OrgMember(user_id=user.id, org_id=org.id, role=OrgRole.owner)
    db.add(membership)

    # Create OTP
    otp_plain = _generate_otp()
    otp = EmailOTP(
        email=email,
        otp_hash=_hash_otp(otp_plain),
        purpose=OTPPurpose.signup,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp)

    return "OTP sent to email", otp_plain


async def verify_email(db: AsyncSession, email: str, otp_plain: str) -> str:
    """Verify email using OTP. Returns success message."""
    result = await db.execute(
        select(EmailOTP).where(
            and_(
                EmailOTP.email == email,
                EmailOTP.purpose == OTPPurpose.signup,
                EmailOTP.is_used == False,
                EmailOTP.expires_at > datetime.now(timezone.utc),
            )
        ).order_by(EmailOTP.created_at.desc())
    )
    otp_record = result.scalar_one_or_none()

    if otp_record is None or otp_record.otp_hash != _hash_otp(otp_plain):
        raise ValueError("Invalid or expired OTP")

    otp_record.is_used = True

    # Mark user as verified
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    user.is_email_verified = True

    return "Email verified successfully"


async def login(
    db: AsyncSession, email: str, password: str
) -> dict:
    """Authenticate user. Returns token data or org list for multi-org users."""
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid email or password")

    if not user.is_email_verified:
        raise ValueError("Email not verified. Please verify your email first.")

    # Get user's org memberships
    members_result = await db.execute(
        select(OrgMember).where(OrgMember.user_id == user.id, OrgMember.is_active == True)
    )
    memberships = members_result.scalars().all()

    if len(memberships) == 0:
        raise ValueError("User is not a member of any organization")

    if len(memberships) == 1:
        m = memberships[0]
        access_token = create_access_token(
            subject=str(user.id), org_id=str(m.org_id), role=m.role.value,
            token_version=user.token_version,
        )
        refresh_token = create_refresh_token(subject=str(user.id))
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "force_password_change": user.force_password_change,
            "orgs": None,
        }

    # Multiple orgs — return list for user to pick
    orgs = []
    for m in memberships:
        org = m.organization
        orgs.append({
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "role": m.role,
        })

    # Return a temporary token (no org context) for select-org call
    temp_token = create_access_token(subject=str(user.id), token_version=user.token_version)
    return {
        "access_token": temp_token,
        "refresh_token": None,
        "force_password_change": user.force_password_change,
        "orgs": orgs,
    }


async def select_org(db: AsyncSession, user_id: UUID, org_id: UUID) -> dict:
    """Select an org after login. Returns full tokens."""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.user_id == user_id,
            OrgMember.org_id == org_id,
            OrgMember.is_active == True,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise ValueError("You are not a member of this organization")

    access_token = create_access_token(
        subject=str(user_id), org_id=str(org_id), role=membership.role.value,
        token_version=user.token_version,
    )
    refresh_token = create_refresh_token(subject=str(user_id))

    # Check force_password_change
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "force_password_change": user.force_password_change,
    }


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> dict:
    """Issue new access token from refresh token."""
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")
        user_id = payload.get("sub")
    except Exception:
        raise ValueError("Invalid refresh token")

    result = await db.execute(select(User).where(User.id == UUID(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")

    # Get first active membership to include org context
    member_result = await db.execute(
        select(OrgMember).where(OrgMember.user_id == user.id, OrgMember.is_active == True)
    )
    membership = member_result.scalar_one_or_none()

    org_id = str(membership.org_id) if membership else None
    role = membership.role.value if membership else None

    access_token = create_access_token(
        subject=str(user.id), org_id=org_id, role=role,
        token_version=user.token_version,
    )
    new_refresh = create_refresh_token(subject=str(user.id))

    return {"access_token": access_token, "refresh_token": new_refresh}


async def change_password(
    db: AsyncSession, user_id: UUID, current_password: str, new_password: str
) -> str:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")

    if not verify_password(current_password, user.hashed_password):
        raise ValueError("Current password is incorrect")

    user.hashed_password = get_password_hash(new_password)
    user.force_password_change = False
    return "Password changed successfully"


async def forgot_password(db: AsyncSession, email: str) -> tuple[str, str]:
    """Generate password reset OTP. Returns (message, otp_plain)."""
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        # Don't reveal if email exists
        return "If the email exists, an OTP has been sent", ""

    otp_plain = _generate_otp()
    otp = EmailOTP(
        email=email,
        otp_hash=_hash_otp(otp_plain),
        purpose=OTPPurpose.reset_password,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp)
    return "If the email exists, an OTP has been sent", otp_plain


async def reset_password(
    db: AsyncSession, email: str, otp_plain: str, new_password: str
) -> str:
    result = await db.execute(
        select(EmailOTP).where(
            and_(
                EmailOTP.email == email,
                EmailOTP.purpose == OTPPurpose.reset_password,
                EmailOTP.is_used == False,
                EmailOTP.expires_at > datetime.now(timezone.utc),
            )
        ).order_by(EmailOTP.created_at.desc())
    )
    otp_record = result.scalar_one_or_none()

    if otp_record is None or otp_record.otp_hash != _hash_otp(otp_plain):
        raise ValueError("Invalid or expired OTP")

    otp_record.is_used = True

    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")

    user.hashed_password = get_password_hash(new_password)
    return "Password reset successfully"
