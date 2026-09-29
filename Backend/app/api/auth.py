from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, UserRead, UserUpdateRequest
from app.services.auth_service import (
    AuthError,
    authenticate_user,
    create_session,
    get_user_from_session,
    password_hasher,
    revoke_session,
)
from app.services.audit_service import record_audit

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def extract_token_from_request(request: Request) -> str | None:
    # 1. Check Authorization Bearer header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            return token
    # 2. Check X-Session-Token header
    session_header = request.headers.get("X-Session-Token")
    if session_header and session_header.strip():
        return session_header.strip()
    # 3. Check Cookie
    return request.cookies.get(settings.cookie_name)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = extract_token_from_request(request)
    user = get_user_from_session(db, token) if token else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
    return user


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = extract_token_from_request(request)
    if not token:
        return None
    return get_user_from_session(db, token)


def request_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    try:
        user = authenticate_user(db, payload.username, payload.password)
    except AuthError as error:
        record_audit(
            db,
            action="auth.login_failed",
            details={
                "username": payload.username,
                "reason": error.reason,
                "description": "invalid credentials",
            },
            ip_address=request_ip(request),
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials") from error
    except Exception as error:
        record_audit(
            db,
            action="auth.login_failed",
            details={
                "username": payload.username,
                "reason": str(error),
                "description": "invalid credentials",
            },
            ip_address=request_ip(request),
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials") from error

    raw_token, expires_at = create_session(db, user, settings.session_ttl_minutes)
    record_audit(
        db,
        action="auth.login",
        actor_user_id=user.id,
        entity_type="user",
        entity_id=str(user.public_uuid),
        details={
            "username": user.username,
            "role": user.role,
            "description": f"User '{user.username}' logged in successfully",
        },
        ip_address=request_ip(request),
    )
    db.commit()
    response.set_cookie(
        key=settings.cookie_name,
        value=raw_token,
        max_age=settings.session_ttl_minutes * 60,
        expires=settings.session_ttl_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    return LoginResponse(user=UserRead.model_validate(user), token=raw_token, expires_at=expires_at.isoformat())


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    token = extract_token_from_request(request)
    user = get_user_from_session(db, token) if token else None
    if token:
        revoke_session(db, token)
    record_audit(
        db,
        action="auth.logout",
        actor_user_id=user.id if user else None,
        entity_type="user" if user else None,
        entity_id=str(user.public_uuid) if user else None,
        details={
            "username": user.username if user else "anonymous",
            "role": user.role if user else "none",
            "description": f"User '{user.username}' logged out" if user else "Session ended",
        },
        ip_address=request_ip(request),
    )
    db.commit()
    response.delete_cookie(key=settings.cookie_name, path="/")


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(current_user)) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: UserUpdateRequest,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    if not password_hasher.verify(payload.current_password, user.password_hash):
        record_audit(
            db,
            action="security.password_change_failed",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=str(user.public_uuid),
            details={
                "target_username": user.username,
                "reason": "Current password incorrect",
                "description": f"Failed password update for '{user.username}': incorrect current password",
            },
            ip_address=request_ip(request),
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="current password is incorrect")

    if payload.username is not None and payload.username != user.username:
        duplicate = db.scalar(select(User).where(User.username == payload.username))
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="username is already in use")
        old_username = user.username
        user.username = payload.username
        record_audit(
            db,
            action="security.username_changed",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=str(user.public_uuid),
            details={
                "old_username": old_username,
                "new_username": user.username,
                "description": f"User changed username from '{old_username}' to '{user.username}'",
            },
            ip_address=request_ip(request),
        )

    if payload.password is not None:
        user.password_hash = password_hasher.hash(payload.password)
        record_audit(
            db,
            action="security.password_changed",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=str(user.public_uuid),
            details={
                "target_username": user.username,
                "description": f"Password updated for user '{user.username}'",
            },
            ip_address=request_ip(request),
        )

    db.flush()
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)
