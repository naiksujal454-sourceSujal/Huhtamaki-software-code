from collections.abc import Generator

from sqlalchemy import create_engine, text
from uuid import uuid4
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database() -> None:
    from app.models import (  # noqa: F401
        AlertConfiguration,
        AuditEvent,
        AuthSession,
        Inspection,
        RolePrivilege,
        ServiceDetail,
        SystemSetting,
        User,
    )

    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS public_uuid UUID"))
        missing_ids = connection.execute(
            text("SELECT id FROM users WHERE public_uuid IS NULL")
        ).scalars().all()
        for user_id in missing_ids:
            connection.execute(
                text("UPDATE users SET public_uuid = :public_uuid WHERE id = :user_id"),
                {"public_uuid": uuid4(), "user_id": user_id},
            )
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_public_uuid ON users (public_uuid)"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN public_uuid SET NOT NULL"))

        # Time-series optimization: Composite time-descending indexes for millisecond query response
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_inspections_created_status ON inspections (created_at DESC, status)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_events_created ON audit_events (created_at DESC, action)"))

        # Database storage engine initialization
        try:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"))
            connection.execute(text("SELECT create_hypertable('inspections', 'created_at', if_not_exists => TRUE)"))
            connection.execute(text("SELECT create_hypertable('audit_events', 'created_at', if_not_exists => TRUE)"))
        except Exception:
            pass
