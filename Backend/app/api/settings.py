from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import current_user, optional_user, request_ip
from app.db.database import get_db
from app.models.user import User
from app.services.audit_service import record_audit
from app.services.settings_service import (
    get_alert_configurations,
    get_real_network_interfaces,
    get_real_system_info,
    get_role_privileges_grouped,
    get_service_detail,
    get_settings_by_section,
    get_user_effective_privileges,
    run_component_diagnostic,
    run_real_ping,
    scan_real_wifi_networks,
    update_alert_configurations_batch,
    update_role_privileges_batch,
    update_service_detail,
    update_settings_section,
)

router = APIRouter(prefix="/settings", tags=["settings"])


# ---------------------------------------------
# SECTION SETTINGS (General, UI, Network, Session)
# ---------------------------------------------

class SectionUpdateRequest(BaseModel):
    settings: dict[str, Any]


@router.get("/section/{section_name}")
def get_section(section_name: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    return get_settings_by_section(db, section_name)


@router.put("/section/{section_name}")
def save_section(
    section_name: str,
    payload: SectionUpdateRequest,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    updated = update_settings_section(db, section_name, payload.settings)
    actor_id = user.id if user else None
    actor_name = user.username if user else "system"
    record_audit(
        db,
        action=f"{section_name.title()} Settings Updated",
        actor_user_id=actor_id,
        entity_type="settings",
        entity_id=section_name,
        details={"section": section_name, "updated_keys": list(payload.settings.keys()), "actor": actor_name},
        ip_address=request_ip(request),
    )
    db.commit()
    return updated


# ---------------------------------------------
# ALERT CONFIGURATION
# ---------------------------------------------

class AlertUpdateBatchRequest(BaseModel):
    alerts: list[dict[str, Any]]


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return get_alert_configurations(db)


@router.put("/alerts")
def update_alerts(
    payload: AlertUpdateBatchRequest,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    updated = update_alert_configurations_batch(db, payload.alerts)
    actor_id = user.id if user else None
    actor_name = user.username if user else "system"
    record_audit(
        db,
        action="Alert Configuration Updated",
        actor_user_id=actor_id,
        entity_type="alert_configuration",
        entity_id="alerts",
        details={"alert_count": len(payload.alerts), "actor": actor_name},
        ip_address=request_ip(request),
    )
    db.commit()
    return updated


# ---------------------------------------------
# SERVICE DETAILS
# ---------------------------------------------

class ServiceDetailUpdateRequest(BaseModel):
    provider_name: str | None = None
    contact_info: str | None = None
    last_service_date: str | None = None
    next_service_date: str | None = None
    service_hours: int | None = None
    system_running_hours: int | None = None
    maintenance_notes: str | None = None
    warranty_status: str | None = None
    support_email: str | None = None


@router.get("/service-detail")
def get_service(db: Session = Depends(get_db)) -> dict[str, Any]:
    return get_service_detail(db)


@router.put("/service-detail")
def save_service(
    payload: ServiceDetailUpdateRequest,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    data = payload.model_dump(exclude_unset=True)
    updated = update_service_detail(db, data)
    actor_id = user.id if user else None
    actor_name = user.username if user else "system"
    record_audit(
        db,
        action="Service Details Updated",
        actor_user_id=actor_id,
        entity_type="service_detail",
        entity_id="1",
        details={"updated_fields": list(data.keys()), "actor": actor_name},
        ip_address=request_ip(request),
    )
    db.commit()
    return updated


# ---------------------------------------------
# ROLE PRIVILEGES & ENFORCEMENT
# ---------------------------------------------

class RolePrivilegeBatchRequest(BaseModel):
    role: str
    privileges: list[dict[str, Any]]


@router.get("/privileges")
def get_privileges(role: str = Query(default="operator"), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return get_role_privileges_grouped(db, role)


@router.put("/privileges")
def update_privileges(
    payload: RolePrivilegeBatchRequest,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    updated = update_role_privileges_batch(db, payload.role, payload.privileges)
    actor_id = user.id if user else None
    actor_name = user.username if user else "system"
    record_audit(
        db,
        action="Role Privileges Updated",
        actor_user_id=actor_id,
        entity_type="role_privileges",
        entity_id=payload.role,
        details={"role": payload.role, "privilege_count": len(payload.privileges), "actor": actor_name},
        ip_address=request_ip(request),
    )
    db.commit()
    return updated


@router.get("/privileges/my-privileges")
def get_my_privileges(
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    # If not logged in, default to operator privileges
    if not user:
        from app.models.settings import RolePrivilege
        rows = db.scalars(
            __import__("sqlalchemy").select(RolePrivilege).where(RolePrivilege.role == "operator")
        ).all()
        return {r.privilege_name: r.is_granted for r in rows}
    return get_user_effective_privileges(db, user)


# ---------------------------------------------
# REAL SYSTEM INFO DETECTION
# ---------------------------------------------

@router.get("/system-info")
def get_system_information() -> dict[str, Any]:
    """Returns genuine host hardware & OS detection from Python platform and psutil."""
    return get_real_system_info()


# ---------------------------------------------
# REAL NETWORK & WI-FI DIAGNOSTICS
# ---------------------------------------------

class PingRequest(BaseModel):
    target: str = "8.8.8.8"


@router.get("/network/interfaces")
def get_network_info() -> dict[str, Any]:
    return get_real_network_interfaces()


@router.post("/network/ping")
def run_ping(payload: PingRequest) -> dict[str, Any]:
    return run_real_ping(payload.target)


@router.get("/network/wifi-scan")
def get_wifi_scan() -> list[dict[str, Any]]:
    return scan_real_wifi_networks()


# ---------------------------------------------
# REAL HARDWARE / COMPONENT TEST (Test Tab)
# ---------------------------------------------

class TestRunRequest(BaseModel):
    component: str = "all"


@router.post("/test/run")
def run_tests(
    payload: TestRunRequest,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = run_component_diagnostic(payload.component)
    actor_id = user.id if user else None
    actor_name = user.username if user else "system"
    record_audit(
        db,
        action="Diagnostic Test Executed",
        actor_user_id=actor_id,
        entity_type="diagnostics",
        entity_id=payload.component,
        details={"component": payload.component, "actor": actor_name},
        ip_address=request_ip(request),
    )
    db.commit()
    return result


# ---------------------------------------------
# EMAIL ALERT CONFIGURATION & TEST DISPATCH
# ---------------------------------------------

class EmailSettingsUpdateRequest(BaseModel):
    enabled: bool = True
    recipient_email: str
    sender_email: str = "alerts@pixtronsystems.com"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    use_tls: bool = True


class EmailTestRequest(BaseModel):
    recipient_email: str


@router.get("/email")
def get_email_alert_settings(db: Session = Depends(get_db)) -> dict[str, Any]:
    from app.services.email_service import get_email_settings
    return get_email_settings(db)


@router.put("/email")
def update_email_alert_settings(
    payload: EmailSettingsUpdateRequest,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    from app.services.email_service import save_email_settings
    updated = save_email_settings(payload.model_dump(), db)
    actor_id = user.id if user else None
    actor_name = user.username if user else "system"
    record_audit(
        db,
        action="Email Alert Settings Updated",
        actor_user_id=actor_id,
        entity_type="email_settings",
        entity_id="alert_config",
        details={"recipient_email": payload.recipient_email, "actor": actor_name},
        ip_address=request_ip(request),
    )
    db.commit()
    return updated


@router.post("/email/send-test")
def trigger_test_email(
    payload: EmailTestRequest,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    from app.services.email_service import send_test_email
    res = send_test_email(payload.recipient_email, db)
    actor_id = user.id if user else None
    actor_name = user.username if user else "system"
    record_audit(
        db,
        action="Email Test Dispatched",
        actor_user_id=actor_id,
        entity_type="email_test",
        entity_id=payload.recipient_email,
        details={"recipient": payload.recipient_email, "success": res.get("success"), "actor": actor_name},
        ip_address=request_ip(request),
    )
    db.commit()
    return res

