from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth import optional_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import get_dashboard_summary

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
