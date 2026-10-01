"""
PLC Modbus TCP Controller Endpoints
Provides direct API endpoints for status, live TCP socket pinging, channel I/O diagnostics,
and hardware configuration for industrial PLC units.
"""

from typing import Any, Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.auth import request_ip
from app.db.database import get_db
from app.services import plc_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/plc", tags=["plc"])


class ConfigurePlcPayload(BaseModel):
    ip: Optional[str] = Field(None, description="PLC IP Address (e.g. 192.168.125.1)")
    port: Optional[int] = Field(None, description="Modbus TCP Port (default: 502)")
    unit_id: Optional[int] = Field(None, description="Modbus Unit/Slave ID (default: 1)")
    timeout_ms: Optional[int] = Field(None, description="Socket Timeout in ms")
    digital_inputs: Optional[dict[str, Any]] = None
    digital_outputs: Optional[dict[str, Any]] = None


class WriteCoilPayload(BaseModel):
    coil_address: int = Field(..., description="Modbus Coil Address (0=Interlock, 1=Buzzer, 2=Ejector)")
    state: bool = Field(..., description="Coil State (True=ON/0xFF00, False=OFF/0x0000)")
    ip: Optional[str] = None
    port: Optional[int] = None
    unit_id: Optional[int] = None


@router.get("/status")
def get_plc_status(ip: Optional[str] = None, port: Optional[int] = None):
    """
    Returns complete live diagnostic status and active configuration of the industrial PLC:
    - Connection health & measured socket ping latency (ms)
    - Active Modbus TCP parameters (IP, Port, Slave Unit ID)
    - Digital I/O channel mappings (Gap Sensor, Rotary Encoder, Buzzer, Ejector)
    """
    return plc_service.get_active_plc_status(ip, port)


@router.get("/ping")
@router.post("/ping")
def ping_plc(ip: Optional[str] = None, port: Optional[int] = None):
    """
    Quick latency ping to PLC Modbus TCP socket (default 192.168.125.1:502).
    """
    target_ip = ip or plc_service.DEFAULT_PLC_IP
    target_port = port or plc_service.DEFAULT_PLC_PORT
    return plc_service.test_plc_connection(target_ip, target_port)


@router.post("/configure")
def configure_plc(payload: ConfigurePlcPayload, request: Request, db: Session = Depends(get_db)):
    """
    Configures industrial PLC parameters (IP, Port, Modbus Unit ID, Channels) and arms the hardware.
    """
    settings_dict = {k: v for k, v in payload.model_dump().items() if v is not None}
    result = plc_service.configure_plc(settings_dict)

    client_ip = request_ip(request)
    record_audit(db, action="plc.configured", details=settings_dict, ip_address=client_ip)
    db.commit()

    return result


@router.post("/write-coil")
def write_coil(payload: WriteCoilPayload, request: Request, db: Session = Depends(get_db)):
    """
    Dispatches standard Modbus Function 05 Write Single Coil to PLC:
    - Coil 0: Conveyor Line Interlock (Line Stop)
    - Coil 1: Defect Alarm Buzzer & Tower Light
    - Coil 2: High-Speed Ejector Pneumatic Solenoid
    """
    result = plc_service.write_plc_coil(
        payload.coil_address,
        payload.state,
        ip=payload.ip,
        port=payload.port,
        unit_id=payload.unit_id
    )

    client_ip = request_ip(request)
    record_audit(db, action="plc.coil_written", details=payload.model_dump(), ip_address=client_ip)
    db.commit()

    return result
