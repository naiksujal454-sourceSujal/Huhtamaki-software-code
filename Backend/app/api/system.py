from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import current_user, request_ip
from app.db.database import get_db
from app.models.event import AuditEvent
from app.models.user import User
from app.schemas.dashboard import AuditEventCreate, AuditEventRead
from app.services.audit_service import record_audit

router = APIRouter(prefix="/system", tags=["system"])


def admin_user(user: User = Depends(current_user)) -> User:
	if user.role != "admin":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
	return user


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
	from app.config import get_settings
	from app.services.auth_service import get_user_from_session
	settings = get_settings()
	return get_user_from_session(db, request.cookies.get(settings.cookie_name))


@router.get("/app-logs")
def app_logs(
	limit: int = Query(default=150, ge=1, le=500),
	level: str | None = Query(default=None),
	search: str | None = Query(default=None),
) -> list[dict[str, Any]]:
	from app.services.log_service import get_app_logs
	return get_app_logs(limit=limit, level=level, search=search)


@router.get("/config-logs")
def config_logs(
	limit: int = Query(default=150, ge=1, le=500),
	search: str | None = Query(default=None),
	db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
	from app.services.log_service import get_config_logs
	return get_config_logs(db, limit=limit, search=search)


@router.get("/audit-trail")
def audit_trail(
	limit: int = Query(default=150, ge=1, le=500),
	search: str | None = Query(default=None),
	db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
	"""Returns complete forensic audit trail with Kab, Kon/Kisne, Kaha, Kya details."""
	from app.services.log_service import get_audit_trail_logs
	return get_audit_trail_logs(db, limit=limit, search=search)


@router.get("/audit-logs", response_model=list[AuditEventRead])
def audit_logs(
	limit: int = Query(default=100, ge=1, le=500),
	action: str | None = Query(default=None),
	db: Session = Depends(get_db),
) -> list[AuditEventRead]:
	query = (
		select(AuditEvent, User.username, User.public_uuid)
		.outerjoin(User, User.id == AuditEvent.actor_user_id)
	)
	if action:
		query = query.where(AuditEvent.action == action)
	rows = db.execute(
		query.order_by(AuditEvent.created_at.desc()).limit(limit)
	).all()
	return [
		AuditEventRead(
			id=event.id,
			actor_user_id=public_uuid,
			actor_username=username or (event.details.get("username") or event.details.get("actor") if isinstance(event.details, dict) else None) or ("system" if event.actor_user_id is None else None),
			action=event.action,
			entity_type=event.entity_type,
			entity_id=event.entity_id,
			details=event.details,
			ip_address=event.ip_address,
			created_at=event.created_at,
		)
		for event, username, public_uuid in rows
	]


@router.post("/audit-events", response_model=AuditEventRead, status_code=status.HTTP_201_CREATED)
def create_audit_event(
	payload: AuditEventCreate,
	request: Request,
	user: User | None = Depends(optional_user),
	db: Session = Depends(get_db),
) -> AuditEventRead:
	actor_user_id = user.id if user else None
	if actor_user_id is None and isinstance(payload.details, dict):
		actor_name = payload.details.get("username") or payload.details.get("actor")
		if actor_name:
			matched_user = db.scalar(select(User).where(User.username == str(actor_name)))
			if matched_user:
				actor_user_id = matched_user.id
				user = matched_user

	event = record_audit(
		db,
		action=payload.action,
		actor_user_id=actor_user_id,
		entity_type=payload.entity_type,
		entity_id=payload.entity_id,
		details=payload.details,
		ip_address=request_ip(request),
	)
	db.commit()
	db.refresh(event)
	return AuditEventRead(
		id=event.id,
		actor_user_id=user.public_uuid if user else None,
		actor_username=user.username if user else (payload.details.get("username") if isinstance(payload.details, dict) else "system"),
		action=event.action,
		entity_type=event.entity_type,
		entity_id=event.entity_id,
		details=event.details,
		ip_address=event.ip_address,
		created_at=event.created_at,
	)


@router.post("/test-buzzer")
def test_buzzer_pulse(request: Request, db: Session = Depends(get_db)):
	"""Fires a 1-second pulse on the alarm buzzer."""
	from app.services.settings_service import trigger_test_buzzer
	res = trigger_test_buzzer(duration_seconds=1.0)
	record_audit(db, action="hardware.test_buzzer", details=res, ip_address=request_ip(request))
	db.commit()
	return res


class PlcTestRequest(BaseModel):
	host: str = "192.168.125.1"
	port: int = 502
	timeout: float = 2.0
	unit_id: int = 1


@router.post("/plc-test")
def test_plc_connection(payload: PlcTestRequest, request: Request, db: Session = Depends(get_db)):
	"""Performs genuine socket connectivity check to target PLC hardware."""
	import socket, time
	t0 = time.time()
	try:
		sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
		sock.settimeout(max(0.2, min(payload.timeout, 5.0)))
		err = sock.connect_ex((payload.host, int(payload.port)))
		latency_ms = round((time.time() - t0) * 1000, 1)
		sock.close()
		is_connected = (err == 0)
		record_audit(
			db,
			action="hardware.plc_test",
			details={"host": payload.host, "port": payload.port, "connected": is_connected, "latency_ms": latency_ms},
			ip_address=request_ip(request),
		)
		db.commit()
		if is_connected:
			return {
				"success": True,
				"connected": True,
				"latency_ms": latency_ms,
				"message": f"Successfully connected to PLC ({payload.host}:{payload.port}) in {latency_ms} ms! Status OK.",
			}
		else:
			return {
				"success": False,
				"connected": False,
				"latency_ms": latency_ms,
				"message": f"PLC connection failed ({payload.host}:{payload.port}). Error code {err}: Host or port unreachable on the network.",
			}
	except Exception as e:
		latency_ms = round((time.time() - t0) * 1000, 1)
		return {
			"success": False,
			"connected": False,
			"latency_ms": latency_ms,
			"message": f"PLC connection error ({payload.host}:{payload.port}): {str(e)}",
		}


@router.post("/restart")
def restart_software(request: Request, db: Session = Depends(get_db)):
	"""Triggers genuine software restart sequence."""
	record_audit(db, action="system.restart", details={"source": "General Settings Action"}, ip_address=request_ip(request))
	db.commit()
	import threading, time, os, sys, subprocess
	def _do_restart():
		time.sleep(1.2)
		try:
			if sys.executable and os.path.exists(sys.argv[0]):
				subprocess.Popen([sys.executable] + sys.argv, cwd=os.getcwd(), close_fds=True)
		except Exception:
			pass
		os._exit(0)
	threading.Thread(target=_do_restart, daemon=True).start()
	return {"success": True, "message": "Software restart sequence successfully initiated."}


@router.post("/shutdown")
def shutdown_software(request: Request, db: Session = Depends(get_db)):
	"""Triggers genuine software shutdown sequence."""
	record_audit(db, action="system.shutdown", details={"source": "General Settings Action"}, ip_address=request_ip(request))
	db.commit()
	import threading, time, os
	def _do_shutdown():
		time.sleep(1.2)
		os._exit(0)
	threading.Thread(target=_do_shutdown, daemon=True).start()
	return {"success": True, "message": "Software shutdown sequence successfully initiated."}



