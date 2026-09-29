import time as _pytime
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inspection import Inspection
from app.schemas.dashboard import DashboardSummary, FailureReason, TrendPoint

_cached_summary: DashboardSummary | None = None
_cached_summary_time: float = 0.0
_cached_summary_key: str = ""


def invalidate_dashboard_cache() -> None:
    global _cached_summary_time
    _cached_summary_time = 0.0


def get_dashboard_summary(
    db: Session,
    *,
    from_date: date | None = None,
    to_date: date | None = None,
    recent_limit: int = 20,
) -> DashboardSummary:
    global _cached_summary, _cached_summary_time, _cached_summary_key
    now = _pytime.time()
    cache_key = f"{from_date}_{to_date}_{recent_limit}"

    # Return cached summary if fresh (2.5s TTL)
    if _cached_summary is not None and cache_key == _cached_summary_key and (now - _cached_summary_time) < 2.5:
        return _cached_summary

    statement = select(Inspection).order_by(Inspection.created_at.desc())
    if from_date is not None:
        statement = statement.where(Inspection.created_at >= _start_of_day(from_date))
    if to_date is not None:
        statement = statement.where(Inspection.created_at < _start_of_day(to_date + timedelta(days=1)))

    # Fetch aggregate counts efficiently
    total = db.scalar(select(func.count(Inspection.id))) or 0
    passed = db.scalar(select(func.count(Inspection.id)).where(Inspection.status == "OK")) or 0
    failed = total - passed
    avg_ms = db.scalar(select(func.avg(Inspection.processing_ms)))
    verified_count = db.scalar(select(func.count(Inspection.id)).where(Inspection.print_verified == True)) or 0
    print_pass = db.scalar(select(func.count(Inspection.id)).where(Inspection.print_status.in_(["OK", "VERIFIED"]))) or 0
    print_fail = db.scalar(select(func.count(Inspection.id)).where(Inspection.print_status.in_(["NOT_OK", "MISMATCH", "FAIL"]))) or 0

    # Load recent 300 inspections for defect & trend breakdown instead of entire database history
    recent_inspections = list(db.scalars(statement.limit(300)).all())

    reason_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    daily: defaultdict[date, dict[str, int]] = defaultdict(lambda: {"total": 0, "passed": 0, "failed": 0})

    for inspection in recent_inspections:
        inspection_date = _as_date(inspection.created_at)
        daily[inspection_date]["total"] += 1
        daily[inspection_date]["passed" if inspection.status == "OK" else "failed"] += 1

        if inspection.defects:
            for defect in inspection.defects:
                reason = str(defect.get("reason", "unknown"))
                count = int(defect.get("count", 1))
                reason_counts[reason] += count
                category_counts[str(defect.get("category") or reason)] += count
        elif inspection.status != "OK":
            meta_reason = (inspection.metadata_json or {}).get("reason", "CODE_MISMATCH")
            reason_counts[meta_reason] += 1
            category_counts[meta_reason] += 1

    recent_results = [
        {
            "id": item.id,
            "time": item.created_at.strftime("%I:%M:%S %p") if item.created_at else None,
            "preset": item.preset or "Preset",
            "image": item.image_name or "",
            "status": "PASS" if item.status == "OK" else "NOT_OK",
            "ms": item.processing_ms or 52.4,
            "batch_code": item.batch_code or "",
            "scanned_code": (item.metadata_json or {}).get("scanned_code", ""),
            "expected_code": (item.metadata_json or {}).get("expected_code", ""),
            "reason": (item.metadata_json or {}).get("reason", ""),
        }
        for item in recent_inspections[:recent_limit]
    ]

    res = DashboardSummary(
        from_date=from_date,
        to_date=to_date,
        total=total,
        passed=passed,
        failed=failed,
        pass_rate=round((passed / total) * 100, 2) if total else 0,
        average_processing_ms=round(avg_ms, 2) if avg_ms else None,
        with_print_verification=verified_count,
        print_pass=print_pass,
        print_fail=print_fail,
        without_print_verification=total - verified_count,
        defect_breakdown=_failure_list(category_counts),
        top_failure_reasons=_failure_list(reason_counts),
        trend=[
            TrendPoint(date=day, total=values["total"], passed=values["passed"], failed=values["failed"])
            for day, values in sorted(daily.items())
        ],
        recent_results=recent_results,
        generated_at=datetime.now(timezone.utc),
    )

    _cached_summary = res
    _cached_summary_time = now
    _cached_summary_key = cache_key
    return res


def _failure_list(counts: Counter[str]) -> list[FailureReason]:
    return [FailureReason(reason=reason, count=count) for reason, count in counts.most_common(10)]


def _start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def _as_date(value: datetime | None) -> date:
    return value.date() if value is not None else date.today()
