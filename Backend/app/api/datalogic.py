"""
Datalogic Matrix 220 Controller Endpoints
=========================================
REST API endpoints to configure, test, query status, and manage preset-specific
optical profiles for the Datalogic Matrix 220 industrial reader over TCP/IP.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.audit_service import record_audit
from app.services import datalogic_service

router = APIRouter(prefix="/datalogic", tags=["datalogic"])


class ConfigureMatrix220Payload(BaseModel):
    exposure_us: Optional[int] = Field(None, description="Exposure time in microseconds (e.g. 80-250 for 220 MPM)")
    gain: Optional[int] = Field(None, description="Analog/digital sensor gain (1x to 16x)")
    focus_distance_mm: Optional[int] = Field(None, description="Electronic liquid lens focus distance in mm (80-400mm)")
    internal_illuminator: Optional[str] = Field(None, description="Internal LED strobe mode")
    trigger_mode: Optional[str] = Field(None, description="Trigger source (e.g. GAP_SENSOR_DI0)")
    job_id: Optional[int] = Field(None, description="Active DL.CODE configuration slot (1-16)")
    rated_speed_mpm: Optional[int] = Field(220, description="Rated conveyor speed in Meters Per Minute")
    ip: Optional[str] = None
    port: Optional[int] = None


class SelectJobPayload(BaseModel):
    job_id: int = Field(..., ge=1, le=16, description="Job slot ID (1-16)")
    ip: Optional[str] = None
    port: Optional[int] = None


class SavePresetPayload(BaseModel):
    job_id: Optional[int] = None
    exposure_us: Optional[int] = None
    gain: Optional[int] = None
    focus_distance_mm: Optional[int] = None
    internal_illuminator: Optional[str] = None
    trigger_mode: Optional[str] = None
    rated_speed_mpm: Optional[int] = 220
    description: Optional[str] = None


@router.get("/status")
def get_datalogic_status(ip: Optional[str] = None, port: Optional[int] = None):
    """
    Returns complete live status of the Datalogic Matrix 220:
    connection reachability, active optical settings, liquid lens focus,
    and 220 MPM label inspection configuration.
    """
    target_ip = ip or datalogic_service.DEFAULT_MATRIX220_IP
    target_port = port or datalogic_service.DEFAULT_MATRIX220_PORT
    return datalogic_service.get_active_datalogic_status(target_ip, target_port)


@router.get("/ping")
def ping_datalogic(ip: Optional[str] = None, port: Optional[int] = None):
    """Quick latency ping to Datalogic Matrix 220 TCP socket."""
    target_ip = ip or datalogic_service.DEFAULT_MATRIX220_IP
    target_port = port or datalogic_service.DEFAULT_MATRIX220_PORT
    return datalogic_service.test_datalogic_connection(target_ip, target_port)


@router.post("/configure")
def configure_datalogic(payload: ConfigureMatrix220Payload, request: Request, db: Session = Depends(get_db)):
    """
    Configures Datalogic Matrix 220 parameters via Host Mode Programming (HMP) over TCP.
    Optimized for 220 MPM continuous label sheet inspection.
    """
    target_ip = payload.ip or datalogic_service.DEFAULT_MATRIX220_IP
    target_port = payload.port or datalogic_service.DEFAULT_MATRIX220_PORT

    settings_dict = {k: v for k, v in payload.model_dump().items() if v is not None and k not in ["ip", "port"]}
    result = datalogic_service.configure_matrix220(settings_dict, ip=target_ip, port=target_port)

    client_ip = request.client.host if request.client else None
    record_audit(db, action="datalogic.configured", details=settings_dict, ip_address=client_ip)
    db.commit()

    return result


@router.post("/select-job")
def select_job_endpoint(payload: SelectJobPayload, request: Request, db: Session = Depends(get_db)):
    """
    Switches the active onboard DL.CODE job slot (Job 1 to Job 16) in under 15ms.
    """
    target_ip = payload.ip or datalogic_service.DEFAULT_MATRIX220_IP
    target_port = payload.port or datalogic_service.DEFAULT_MATRIX220_PORT

    result = datalogic_service.select_matrix220_job(payload.job_id, ip=target_ip, port=target_port)

    client_ip = request.client.host if request.client else None
    record_audit(db, action="datalogic.job_selected", details={"job_id": payload.job_id}, ip_address=client_ip)
    db.commit()

    return result


@router.post("/trigger-test")
def trigger_test_endpoint(request: Request, ip: Optional[str] = None, port: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Fires a software test trigger (<ESC>T) to acquire and decode a label sheet barcode.
    """
    target_ip = ip or datalogic_service.DEFAULT_MATRIX220_IP
    target_port = port or datalogic_service.DEFAULT_MATRIX220_PORT

    result = datalogic_service.trigger_matrix220_software(target_ip, target_port)

    client_ip = request.client.host if request.client else None
    record_audit(db, action="datalogic.software_triggered", details={"scanned_code": result.get("scanned_code")}, ip_address=client_ip)
    db.commit()

    return result


@router.get("/preset/{recipe_id}")
def get_preset_config_endpoint(recipe_id: str):
    """
    Retrieves the saved Matrix 220 optical configuration for a specific recipe/preset.
    """
    return datalogic_service.get_preset_config(recipe_id)


@router.post("/preset/{recipe_id}")
def save_preset_config_endpoint(recipe_id: str, payload: SavePresetPayload, request: Request, db: Session = Depends(get_db)):
    """
    Saves or updates Matrix 220 optical parameters specifically for a recipe/preset.
    """
    config_dict = {k: v for k, v in payload.model_dump().items() if v is not None}
    result = datalogic_service.save_preset_config(recipe_id, config_dict)

    client_ip = request.client.host if request.client else None
    record_audit(db, action="datalogic.preset_saved", details={"recipe_id": recipe_id, "config": config_dict}, ip_address=client_ip)
    db.commit()

    return result


@router.post("/preset/{recipe_id}/load")
def load_and_arm_preset_endpoint(recipe_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Loads saved Matrix 220 configs for a recipe and arms the reader over TCP socket immediately.
    """
    result = datalogic_service.load_and_arm_preset(recipe_id)

    client_ip = request.client.host if request.client else None
    record_audit(db, action="datalogic.preset_armed", details={"recipe_id": recipe_id, "result": result.get("message")}, ip_address=client_ip)
    db.commit()

    return result
