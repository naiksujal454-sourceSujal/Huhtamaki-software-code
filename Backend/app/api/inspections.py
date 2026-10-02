import csv
import io
from datetime import date, datetime, time
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.inspection import Inspection
from app.schemas.inspection import InspectionCreate, InspectionRead
from app.services.audit_service import record_audit
from app.services.inspection_service import create_inspection
from app.services.processing_manager import processing_manager
from app.services.recipe_service import get_recipe_by_id

router = APIRouter(tags=["inspections"])


class StartInspectionPayload(BaseModel):
    recipeId: Optional[str] = "recipe1"
    recipe: Optional[Dict[str, Any]] = None
    mode: Optional[str] = "simulation"  # "simulation" or "hardware"
    resetCounters: Optional[bool] = False
    simulateDefects: Optional[bool] = True
    stopOnDefect: Optional[bool] = True


class DefectConfigPayload(BaseModel):
    simulateDefects: bool
    stopOnDefect: Optional[bool] = None


@router.post("/inspections", response_model=InspectionRead, status_code=status.HTTP_201_CREATED)
def ingest_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
) -> Inspection:
    try:
        inspection = create_inspection(db, payload)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="inspection_key already exists") from error
    record_audit(
        db,
        action="inspection.created",
        entity_type="inspection",
        entity_id=str(inspection.id),
        details={"status": inspection.status, "batch_code": inspection.batch_code},
    )
    db.commit()
    return inspection


@router.get("/inspections/export-csv")
def export_inspections_csv(
    target_date: Optional[str] = Query(default=None, description="Date in YYYY-MM-DD format (defaults to today)"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Exports genuine inspection event records from PostgreSQL to a standard CSV file.
    Filters by the specified calendar day (defaults to today's date).
    """
    if target_date:
        try:
            parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            parsed_date = date.today()
    else:
        parsed_date = date.today()

    start_dt = datetime.combine(parsed_date, time.min)
    end_dt = datetime.combine(parsed_date, time.max)

    # Query genuine inspections for that day
    statement = (
        select(Inspection)
        .where(Inspection.created_at >= start_dt, Inspection.created_at <= end_dt)
        .order_by(Inspection.created_at.asc())
    )
    inspections = list(db.scalars(statement).all())

    # If no records exist for the exact day, fall back to recent 100 inspections
    if not inspections:
        statement = select(Inspection).order_by(Inspection.created_at.desc()).limit(100)
        inspections = list(reversed(list(db.scalars(statement).all())))

    # Generate CSV stream in-memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Inspection ID",
        "Timestamp",
        "Preset / Recipe",
        "Status",
        "Scanned 1D Barcode",
        "Expected Reference Code",
        "Print Verified",
        "Print Status",
        "Latency (ms)",
        "Defect Reason",
        "Batch Code",
    ])

    for row in inspections:
        ts = row.created_at.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] if row.created_at else ""
        meta = row.metadata_json or {}
        scanned_code = meta.get("scanned_code") or ""
        expected_code = meta.get("expected_code") or ""
        reason = meta.get("reason") or ("DEFECT" if row.status != "OK" else "None")
        if row.defects:
            reason = ", ".join(str(d.get("reason", "")) for d in row.defects if d.get("reason")) or reason

        writer.writerow([
            row.id,
            ts,
            row.preset or "Preset",
            row.status,
            f"'{scanned_code}" if scanned_code else "-",
            f"'{expected_code}" if expected_code else "-",
            "YES" if row.print_verified else "NO",
            row.print_status or "N/A",
            f"{row.processing_ms:.1f}" if row.processing_ms is not None else "0.0",
            reason,
            row.batch_code or "-",
        ])

    csv_data = output.getvalue()
    filename = f"huhtamaki_inspections_{parsed_date.isoformat()}.csv"

    client_ip = request.client.host if request and request.client else None
    record_audit(
        db,
        action="inspections.exported_csv",
        entity_type="inspection",
        entity_id=parsed_date.isoformat(),
        details={"record_count": len(inspections), "filename": filename},
        ip_address=client_ip,
    )
    db.commit()

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Record-Count": str(len(inspections)),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Record-Count",
        },
    )


@router.get("/inspections", response_model=list[InspectionRead])
def list_inspections(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Inspection]:
    return list(db.scalars(select(Inspection).order_by(Inspection.created_at.desc()).offset(offset).limit(limit)).all())


# ==========================================
# Runtime Control & Processing Manager APIs
# ==========================================

@router.post("/inspection/start")
async def start_inspection(payload: StartInspectionPayload, request: Request, db: Session = Depends(get_db)):
    """Start inspection run with selected recipe and mode."""
    target_recipe = payload.recipe
    if not target_recipe and payload.recipeId:
        target_recipe = get_recipe_by_id(db, payload.recipeId)

    if not target_recipe:
        # Fallback default recipe
        target_recipe = {
            "id": "recipe1",
            "name": "recipe1",
            "type": "Preset",
            "targetCode": "8901030866784",
            "image": "/api/recipes/image/recipe1.png",
        }

    status_data = await processing_manager.start(
        recipe=target_recipe,
        mode=payload.mode or "simulation",
        reset_counters=payload.resetCounters or False,
        simulate_defects=True if payload.simulateDefects is None else payload.simulateDefects,
        stop_on_defect=True if payload.stopOnDefect is None else payload.stopOnDefect,
    )

    client_ip = request.client.host if request.client else None
    record_audit(
        db,
        action="inspection.started",
        details={"recipe": target_recipe.get("name"), "mode": payload.mode, "simulateDefects": payload.simulateDefects},
        ip_address=client_ip,
    )
    db.commit()

    return {"success": True, "message": "Inspection started", "status": status_data}


@router.post("/inspection/inject-defect")
async def inject_defect(request: Request, db: Session = Depends(get_db)):
    """Manually force the very next container on conveyor to trigger defect/mismatch for FAT testing."""
    result = processing_manager.inject_defect()
    client_ip = request.client.host if request.client else None
    record_audit(db, action="inspection.defect_injected", details={"source": "manual_trigger"}, ip_address=client_ip)
    db.commit()
    return result


@router.post("/inspection/defect-config")
async def set_defect_config(payload: DefectConfigPayload, request: Request, db: Session = Depends(get_db)):
    """Update defect simulation and stop-on-defect configuration dynamically at runtime."""
    result = processing_manager.set_defect_simulation(
        enabled=payload.simulateDefects,
        stop_on_defect=payload.stopOnDefect,
    )
    client_ip = request.client.host if request.client else None
    record_audit(db, action="inspection.config_updated", details=payload.model_dump(), ip_address=client_ip)
    db.commit()
    return result


@router.post("/inspection/pause")
async def pause_inspection(request: Request, db: Session = Depends(get_db)):
    """Pause the current inspection."""
    status_data = await processing_manager.pause()
    client_ip = request.client.host if request.client else None
    record_audit(db, action="inspection.paused", ip_address=client_ip)
    db.commit()
    return {"success": True, "message": "Inspection paused", "status": status_data}


@router.post("/inspection/resume")
async def resume_inspection(request: Request, db: Session = Depends(get_db)):
    """Resume paused inspection (continues previous counts seamlessly)."""
    status_data = await processing_manager.resume()
    client_ip = request.client.host if request.client else None
    record_audit(db, action="inspection.resumed", ip_address=client_ip)
    db.commit()
    return {"success": True, "message": "Inspection resumed", "status": status_data}


@router.post("/inspection/stop")
async def stop_inspection(request: Request, db: Session = Depends(get_db)):
    """Stop the current inspection run and finalize batch."""
    status_data = await processing_manager.stop()
    client_ip = request.client.host if request.client else None
    record_audit(db, action="inspection.stopped", details=status_data.get("counters"), ip_address=client_ip)
    db.commit()
    return {"success": True, "message": "Inspection stopped", "status": status_data}


@router.post("/inspection/acknowledge-alarm")
async def acknowledge_alarm(request: Request, db: Session = Depends(get_db)):
    """Acknowledge NOK defect alarm, silences PLC buzzer, leaves system ready to resume."""
    status_data = await processing_manager.acknowledge_alarm()
    client_ip = request.client.host if request.client else None
    record_audit(db, action="alarm.acknowledged", ip_address=client_ip)
    db.commit()
    return {"success": True, "message": "Alarm acknowledged. Buzzer silenced.", "status": status_data}


@router.get("/inspection/status")
def get_inspection_status():
    """Get live runtime status and counters."""
    return processing_manager.get_status()


@router.get("/inspection/recent-results")
def get_recent_results():
    """Get the most recent inspection results."""
    return list(processing_manager.recent_events)
