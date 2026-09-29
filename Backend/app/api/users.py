from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import current_user, request_ip
from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import password_hasher
from app.services.audit_service import record_audit

router = APIRouter(prefix="/users", tags=["users"])


class UserItem(BaseModel):
    id: int
    public_uuid: str
    username: str
    role: str
    is_active: bool
    created_at: datetime


class ChangePasswordPayload(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)
    username: str | None = None


class ToggleActivePayload(BaseModel):
    is_active: bool | None = None


class CreateUserPayload(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    role: str = Field(default="operator")


@router.get("", response_model=list[UserItem])
def list_users(db: Session = Depends(get_db)) -> list[UserItem]:
    users = db.scalars(select(User).order_by(User.id.asc())).all()
    return [
        UserItem(
            id=u.id,
            public_uuid=str(u.public_uuid),
            username=u.username,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.post("/{user_id}/change-password")
def change_password(
    user_id: int,
    payload: ChangePasswordPayload,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Verify original default / current password
    if not password_hasher.verify(payload.current_password, user.password_hash):
        record_audit(
            db,
            action="security.password_change_failed",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=str(user.public_uuid),
            details={
                "target_username": user.username,
                "reason": "Original default password incorrect",
                "description": f"Failed password change attempt for '{user.username}': incorrect current password",
            },
            ip_address=request_ip(request),
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original / current password is incorrect",
        )

    # Hash and save new password
    user.password_hash = password_hasher.hash(payload.new_password)
    db.commit()
    db.refresh(user)

    # Record audit log
    record_audit(
        db,
        action="security.password_changed",
        actor_user_id=user.id,
        entity_type="user",
        entity_id=str(user.public_uuid),
        details={
            "target_username": user.username,
            "description": f"Password changed successfully for user '{user.username}'",
        },
        ip_address=request_ip(request),
    )
    db.commit()

    return {
        "status": "success",
        "message": f"Password changed successfully for user '{user.username}'",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
        },
    }


@router.post("/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    payload: ToggleActivePayload | None = None,
    request: Request = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload and payload.is_active is not None:
        user.is_active = payload.is_active
    else:
        user.is_active = not user.is_active

    db.commit()
    db.refresh(user)

    action = "security.user_activated" if user.is_active else "security.user_deactivated"
    record_audit(
        db,
        action=action,
        actor_user_id=user.id,
        entity_type="user",
        entity_id=str(user.public_uuid),
        details={
            "target_username": user.username,
            "is_active": user.is_active,
            "description": f"User '{user.username}' {'activated' if user.is_active else 'deactivated'}",
        },
        ip_address=request_ip(request) if request else None,
    )
    db.commit()

    return {
        "status": "success",
        "is_active": user.is_active,
        "message": f"User '{user.username}' is now {'active' if user.is_active else 'deactivated'}",
    }


@router.post("", response_model=UserItem, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserPayload,
    request: Request,
    db: Session = Depends(get_db),
) -> UserItem:
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    new_user = User(
        username=payload.username,
        role=payload.role,
        password_hash=password_hasher.hash(payload.password),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    record_audit(
        db,
        action="security.user_created",
        actor_user_id=new_user.id,
        entity_type="user",
        entity_id=str(new_user.public_uuid),
        details={
            "username": new_user.username,
            "role": new_user.role,
            "description": f"New user '{new_user.username}' created with role '{new_user.role}'",
        },
        ip_address=request_ip(request),
    )
    db.commit()

    return UserItem(
        id=new_user.id,
        public_uuid=str(new_user.public_uuid),
        username=new_user.username,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
    )


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Safety check: keep at least one active admin
    if user.role == "admin":
        other_admins = db.scalar(
            select(User).where(User.role == "admin", User.id != user_id, User.is_active.is_(True))
        )
        if not other_admins:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the sole active admin account. Assign another admin first.",
            )

    username = user.username
    role = user.role
    uuid_str = str(user.public_uuid)

    db.delete(user)
    db.commit()

    record_audit(
        db,
        action="security.user_deleted",
        actor_user_id=None,
        entity_type="user",
        entity_id=uuid_str,
        details={
            "username": username,
            "role": role,
            "description": f"User account '{username}' ({role}) was permanently deleted",
        },
        ip_address=request_ip(request),
    )
    db.commit()

    return {"status": "success", "message": f"User '{username}' was deleted successfully"}

