from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth import optional_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary, OpenBatchRequest, ProductionBatchInfo
from app.services.dashboard_service import get_dashboard_summary, invalidate_dashboard_cache
from app.services.processing_manager import processing_manager
from app.services.audit_service import record_audit

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
	from_date: date | None = Query(default=None),
	to_date: date | None = Query(default=None),
	recent_limit: int = Query(default=20, ge=1, le=100),
	_: User | None = Depends(optional_user),
	db: Session = Depends(get_db),
) -> DashboardSummary:
	return get_dashboard_summary(db, from_date=from_date, to_date=to_date, recent_limit=recent_limit)


@router.post("/batch/open", response_model=ProductionBatchInfo)
def open_production_batch(
	payload: OpenBatchRequest,
	current_u: User | None = Depends(optional_user),
	db: Session = Depends(get_db),
) -> ProductionBatchInfo:
	info = processing_manager.open_batch(payload.batch_code)
	invalidate_dashboard_cache()
	record_audit(
		db,
		action="batch.opened",
		actor_user_id=current_u.id if current_u else None,
		entity_type="batch",
		entity_id=payload.batch_code,
		details={"batch_code": payload.batch_code},
	)
	return ProductionBatchInfo(
		batch_code=info["batch_code"],
		status=info["status"],
		opened_at=info["opened_at"],
		total=0,
		passed=0,
		failed=0,
	)


@router.post("/batch/close", response_model=ProductionBatchInfo)
def close_production_batch(
	current_u: User | None = Depends(optional_user),
	db: Session = Depends(get_db),
) -> ProductionBatchInfo:
	info = processing_manager.close_batch()
	invalidate_dashboard_cache()
	record_audit(
		db,
		action="batch.closed",
		actor_user_id=current_u.id if current_u else None,
		entity_type="batch",
		entity_id=info["batch_code"],
		details={"batch_code": info["batch_code"]},
	)
	return ProductionBatchInfo(
		batch_code=info["batch_code"],
		status="CLOSED",
		opened_at=info["opened_at"],
		total=0,
		passed=0,
		failed=0,
	)
