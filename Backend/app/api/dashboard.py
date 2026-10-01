from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.auth import optional_user
from app.db.database import get_db
from app.models.user import User
from app.models.batch import ProductionBatch
from app.models.inspection import Inspection
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
	if not payload.batch_code or not payload.batch_code.strip():
		raise HTTPException(status_code=400, detail="Batch code cannot be empty")
	clean_code = payload.batch_code.strip()
	now_utc = datetime.now(timezone.utc)

	# 1. Close any currently open batch
	db.execute(
		update(ProductionBatch)
		.where(ProductionBatch.status == "open")
		.values(status="closed", closed_at=now_utc)
	)

	# 2. Check if batch_code already exists
	existing = db.scalar(select(ProductionBatch).where(ProductionBatch.batch_code == clean_code))
	if existing:
		existing.status = "open"
		existing.opened_at = now_utc
		existing.closed_at = None
	else:
		new_batch = ProductionBatch(
			batch_code=clean_code,
			status="open",
			opened_at=now_utc,
		)
		db.add(new_batch)
	db.commit()

	# 3. Synchronize processing_manager session_id
	info = processing_manager.open_batch(clean_code)
	invalidate_dashboard_cache()

	# 4. Record audit event
	record_audit(
		db,
		action="batch.opened",
		actor_user_id=current_u.id if current_u else None,
		entity_type="batch",
		entity_id=clean_code,
		details={"batch_code": clean_code},
	)

	p_cnt = db.scalar(select(func.count(Inspection.id)).where(Inspection.batch_code == clean_code, Inspection.status == "OK")) or 0
	f_cnt = db.scalar(select(func.count(Inspection.id)).where(Inspection.batch_code == clean_code, Inspection.status != "OK")) or 0

	return ProductionBatchInfo(
		batch_code=clean_code,
		status="OPEN",
		opened_at=now_utc,
		total=p_cnt + f_cnt,
		passed=p_cnt,
		failed=f_cnt,
	)


@router.post("/batch/close", response_model=ProductionBatchInfo)
def close_production_batch(
	current_u: User | None = Depends(optional_user),
	db: Session = Depends(get_db),
) -> ProductionBatchInfo:
	now_utc = datetime.now(timezone.utc)
	curr_code = processing_manager.session_id or ""

	if curr_code:
		db.execute(
			update(ProductionBatch)
			.where(ProductionBatch.batch_code == curr_code)
			.values(status="closed", closed_at=now_utc)
		)
	db.execute(
		update(ProductionBatch)
		.where(ProductionBatch.status == "open")
		.values(status="closed", closed_at=now_utc)
	)
	db.commit()

	info = processing_manager.close_batch()
	invalidate_dashboard_cache()

	record_audit(
		db,
		action="batch.closed",
		actor_user_id=current_u.id if current_u else None,
		entity_type="batch",
		entity_id=curr_code,
		details={"batch_code": curr_code},
	)

	p_cnt = db.scalar(select(func.count(Inspection.id)).where(Inspection.batch_code == curr_code, Inspection.status == "OK")) or 0
	f_cnt = db.scalar(select(func.count(Inspection.id)).where(Inspection.batch_code == curr_code, Inspection.status != "OK")) or 0

	return ProductionBatchInfo(
		batch_code=curr_code,
		status="CLOSED",
		opened_at=info["opened_at"],
		total=p_cnt + f_cnt,
		passed=p_cnt,
		failed=f_cnt,
	)
