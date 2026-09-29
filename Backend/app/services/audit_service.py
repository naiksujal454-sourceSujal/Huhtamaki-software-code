import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import AuditEvent

logger = logging.getLogger("huhtamaki.audit")
_SENSITIVE_KEYS = {"password", "current_password", "token", "session_token", "secret"}
_VISIBLE_AUDIT_ACTIONS = {"auth.login", "auth.login_failed", "auth.logout", "inspection.created"}


def record_audit(
    db: Session,
    *,
    action: str,
    actor_user_id: int | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
    )
    db.add(event)
    db.flush()
    actor_uuid = _actor_uuid(db, actor_user_id)
    public_entity_id = actor_uuid if entity_type == "user" and action.startswith("auth.") else entity_id
    logger.info(
        "AUDIT %s",
        json.dumps(
            {
                "timestamp": (event.created_at or datetime.now(timezone.utc)).isoformat(),
                "actor_uuid": actor_uuid,
                "action": action,
                "entity_type": entity_type,
                "entity_id": public_entity_id,
                "details": _redact(details or {}),
                "ip_address": ip_address,
            },
            default=str,
            separators=(",", ":"),
        ),
    )
    return event


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if key.lower() in _SENSITIVE_KEYS else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def log_recent_audits(db: Session, limit: int = 100) -> None:
    events = db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)).all()
    for event in reversed(events):
        actor_uuid = _actor_uuid(db, event.actor_user_id)
        logger.info(
            "AUDIT_HISTORY %s",
            json.dumps(
                {
                    "timestamp": event.created_at.isoformat() if event.created_at else None,
                    "actor_uuid": actor_uuid,
                    "action": event.action,
                    "entity_type": event.entity_type,
                    "entity_id": actor_uuid if event.entity_type == "user" and event.action.startswith("auth.") else event.entity_id,
                    "details": _redact(event.details or {}),
                    "ip_address": event.ip_address,
                },
                default=str,
                separators=(",", ":"),
            ),
        )


def _actor_uuid(db: Session, actor_user_id: int | None) -> str | None:
    if actor_user_id is None:
        return None
    from app.models.user import User

    user = db.get(User, actor_user_id)
    return str(user.public_uuid) if user is not None else None
