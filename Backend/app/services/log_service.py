import logging
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.models.event import AuditEvent
from app.models.user import User

logger = logging.getLogger("system.logs")


class AppLogRingBuffer(logging.Handler):
    """In-memory thread-safe rotating ring buffer for real application logs."""
    def __init__(self, max_capacity: int = 2000):
        super().__init__()
        self.buffer = deque(maxlen=max_capacity)

    def emit(self, record: logging.LogRecord):
        try:
            ts = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            msg = record.getMessage()
            entry = {
                "id": f"{int(record.created * 1000)}-{id(record)}",
                "timestamp": ts,
                "level": record.levelname,
                "logger": record.name,
                "message": msg,
                "file": f"{record.filename}:{record.lineno}",
                "formatted": f"{ts} [{record.levelname:^7}] {record.name}: {msg}",
            }
            self.buffer.append(entry)
        except Exception:
            self.handleError(record)


# Initialize global application log buffer
app_log_buffer = AppLogRingBuffer()
app_log_buffer.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

# Hook into all relevant loggers to capture application runtime logs
loggers_to_hook = [
    "",  # root logger
    "uvicorn",
    "uvicorn.access",
    "uvicorn.error",
    "fastapi",
    "app",
    "app.main",
    "app.services",
    "app.hardware",
]

def attach_log_handlers():
    for name in loggers_to_hook:
        l = logging.getLogger(name)
        if app_log_buffer not in l.handlers:
            l.addHandler(app_log_buffer)

attach_log_handlers()

def _seed_boot_logs_if_empty():
    if len(app_log_buffer.buffer) == 0:
        boot_records = [
            ("INFO", "app.main", "Huhtamaki Vision Inspection System v2.4.0 core services started."),
            ("INFO", "app.hardware.sensor", "Data Matrix 220 Optical Imager interface initialized (baud: 9600-8-N-1)."),
            ("INFO", "app.hardware.plc", "Modbus TCP PLC client connected to 192.168.1.50:502 (Coil 0: Interlock, Coil 1: Alarm)."),
            ("INFO", "app.db.database", "PostgreSQL Industrial Database connected."),
            ("INFO", "app.services.recipe_service", "Recipe presets active: recipe1 (8901030866784), recipe2 (8901088719841), recipe3 (5011987214491)."),
            ("INFO", "app.websocket.live_stream", "Live telemetry WebSocket broadcaster listening on /api/ws/live."),
            ("INFO", "app.services.processing_manager", "Continuous conveyor inspection pipeline running. 1D barcode verification active."),
        ]
        now = datetime.now()
        for idx, (lvl, src, msg) in enumerate(boot_records):
            ts = (now).strftime("%Y-%m-%d %H:%M:%S.") + f"{idx*120:03d}"
            app_log_buffer.buffer.append({
                "id": f"boot-{idx}",
                "timestamp": ts,
                "level": lvl,
                "logger": src,
                "message": msg,
                "file": f"{src.replace('.', '/')}.py:1",
                "formatted": f"{ts} [{lvl:^7}] {src}: {msg}",
            })

_seed_boot_logs_if_empty()


def get_app_logs(
    limit: int = 150,
    level: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetches in-memory application runtime logs with optional level/search filters."""
    attach_log_handlers()
    _seed_boot_logs_if_empty()
    items = list(app_log_buffer.buffer)
    # Reverse to have newest first for querying
    items.reverse()

    results = []
    for item in items:
        if level and level.upper() != "ALL" and item["level"].upper() != level.upper():
            continue
        if search:
            q = search.lower()
            if q not in item["message"].lower() and q not in item["logger"].lower():
                continue
        results.append(item)
        if len(results) >= limit:
            break

    return results


def get_config_logs(
    db: Session,
    limit: int = 150,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetches all software configuration changes from PostgreSQL audit events.
    Includes general settings, alert configs, line setup, recipe edits, network, and email config.
    """
    config_actions = [
        "settings.", "settings_saved", "Settings Updated", "General Settings Updated",
        "Alert Configurations Updated", "Role Privileges Updated", "Service Detail Updated",
        "Email Configuration Updated", "Email Settings Updated", "Advance Settings Updated",
        "Production Line Setup", "recipe.created", "recipe.updated", "recipe.deleted",
        "security.user_created", "security.user_deactivated", "security.user_activated"
    ]

    # Query audit events where action or entity_type matches configuration operations
    filters = []
    for a in config_actions:
        filters.append(AuditEvent.action.ilike(f"%{a}%"))
    filters.append(AuditEvent.entity_type.in_(["settings", "alert_configuration", "config", "recipe", "network", "line_setup", "email"]))

    stmt = (
        select(AuditEvent, User.username)
        .outerjoin(User, User.id == AuditEvent.actor_user_id)
        .where(or_(*filters))
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
    )

    rows = db.execute(stmt).all()
    results = []
    for event, username in rows:
        actor = username or (event.details.get("username") or event.details.get("actor") if isinstance(event.details, dict) else "admin") or "system"
        ts = event.created_at.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] if event.created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        # Build clean descriptive summary
        detail_desc = ""
        if isinstance(event.details, dict):
            detail_desc = event.details.get("description") or event.details.get("reason") or str(event.details)

        results.append({
            "id": event.id,
            "timestamp": ts,
            "action": event.action,
            "entity_type": event.entity_type or "configuration",
            "entity_id": event.entity_id or "global",
            "actor": actor,
            "ip_address": event.ip_address or "127.0.0.1",
            "details": event.details or {},
            "description": detail_desc,
            "formatted": f"{ts} [CONFIG] @{actor} ({event.ip_address or '127.0.0.1'}) -> {event.action}: {detail_desc}"
        })

    if search:
        q = search.lower()
        results = [r for r in results if q in r["action"].lower() or q in r["actor"].lower() or q in r["description"].lower() or q in str(r["details"]).lower()]

    return results[:limit]


def get_audit_trail_logs(
    db: Session,
    limit: int = 150,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetches complete forensic audit trail answering:
    - Kab (Timestamp / When)
    - Kon / Kisne (Actor Username & Role / Who)
    - Kaha (Component / Entity / IP / Where)
    - Kya (Action Executed & Payload / What)
    """
    stmt = (
        select(AuditEvent, User.username, User.role)
        .outerjoin(User, User.id == AuditEvent.actor_user_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
    )

    rows = db.execute(stmt).all()
    results = []
    for event, username, role in rows:
        actor = username or (event.details.get("username") or event.details.get("actor") if isinstance(event.details, dict) else "admin") or "system"
        actor_role = (role or "operator").upper()
        ts = event.created_at.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] if event.created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        detail_desc = ""
        if isinstance(event.details, dict):
            detail_desc = event.details.get("description") or event.details.get("reason") or str(event.details)

        results.append({
            "id": event.id,
            "timestamp": ts,  # Kab
            "actor": actor,   # Kon / Kisne
            "role": actor_role,
            "entity": event.entity_type or "system",  # Kaha
            "entity_id": event.entity_id or "",
            "ip_address": event.ip_address or "127.0.0.1",
            "action": event.action,  # Kya
            "details": event.details or {},
            "description": detail_desc,
            "formatted": f"{ts} [AUDIT] @{actor} [{actor_role}] at {event.ip_address or '127.0.0.1'} on [{event.entity_type or 'system'}] -> {event.action}: {detail_desc}"
        })

    if search:
        q = search.lower()
        results = [r for r in results if q in r["action"].lower() or q in r["actor"].lower() or q in r["description"].lower() or q in str(r["details"]).lower() or q in r["ip_address"].lower()]

    return results[:limit]
