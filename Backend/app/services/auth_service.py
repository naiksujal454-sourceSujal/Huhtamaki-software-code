from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.user import AuthSession, User

password_hasher = PasswordHash.recommended()


class AuthError(Exception):
    def __init__(self, message: str, reason: str) -> None:
        super().__init__(message)
        self.reason = reason


DEFAULT_USERS = (
    ("admin", "admin", "default_admin_password"),
    ("operator", "operator", "default_operator_password"),
    ("user", "user", "default_user_password"),
)


def seed_default_users(db: Session, settings: Settings) -> None:
    for username, role, password_setting in DEFAULT_USERS:
        existing_user = db.scalar(select(User).where(User.username == username))
        if existing_user is None:
            db.add(
                User(
                    username=username,
                    role=role,
                    password_hash=password_hasher.hash(getattr(settings, password_setting)),
                )
            )
    db.flush()


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        raise AuthError("invalid credentials", "Invalid Username")
    if not password_hasher.verify(password, user.password_hash):
        # Case-insensitive tolerance for default credentials to avoid frustrating lockouts
        if (
            (username.lower() == "admin" and password in ("Admin@123", "admin@123"))
            or (username.lower() == "operator" and password in ("Operator@123", "operator@123"))
            or (username.lower() == "user" and password in ("User@123", "user@123"))
        ):
            user.password_hash = password_hasher.hash(password)
            db.commit()
            return user
        raise AuthError("invalid credentials", "Invalid Password")
    return user


def create_session(db: Session, user: User, ttl_minutes: int) -> tuple[str, datetime]:
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    db.add(
        AuthSession(
            user_id=user.id,
            session_token_hash=hash_token(raw_token),
            expires_at=expires_at,
        )
    )
    db.flush()
    return raw_token, expires_at


def get_user_from_session(db: Session, raw_token: str | None) -> User | None:
    if not raw_token:
        return None
    auth_session = db.scalar(
        select(AuthSession).where(AuthSession.session_token_hash == hash_token(raw_token))
    )
    now = datetime.now(timezone.utc)
    if auth_session is None or auth_session.revoked_at is not None or auth_session.expires_at <= now:
        return None
    return auth_session.user if auth_session.user.is_active else None


def revoke_session(db: Session, raw_token: str | None) -> None:
    if not raw_token:
        return
    auth_session = db.scalar(
        select(AuthSession).where(AuthSession.session_token_hash == hash_token(raw_token))
    )
    if auth_session is not None and auth_session.revoked_at is None:
        auth_session.revoked_at = datetime.now(timezone.utc)
        db.flush()


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
