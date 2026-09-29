from sqlalchemy.orm import Session

from app.models.inspection import Inspection
from app.schemas.inspection import InspectionCreate


def create_inspection(db: Session, payload: InspectionCreate) -> Inspection:
    inspection = Inspection(
        inspection_key=payload.inspection_key,
        status=payload.status,
        preset=payload.preset,
        image_name=payload.image_name,
        batch_code=payload.batch_code,
        processing_ms=payload.processing_ms,
        print_verified=payload.print_verified,
        print_status=payload.print_status,
        defects=[defect.model_dump() for defect in payload.defects],
        metadata_json=payload.metadata,
    )
    db.add(inspection)
    db.flush()
    return inspection
