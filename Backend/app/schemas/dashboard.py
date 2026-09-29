from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class TrendPoint(BaseModel):
    date: date
    total: int
    passed: int
    failed: int


class FailureReason(BaseModel):
    reason: str
    count: int


class DashboardSummary(BaseModel):
    from_date: date | None
    to_date: date | None
    total: int
    passed: int
    failed: int
    pass_rate: float
    average_processing_ms: float | None
    with_print_verification: int
    print_pass: int
    print_fail: int
    without_print_verification: int
    defect_breakdown: list[FailureReason]
    top_failure_reasons: list[FailureReason]
    trend: list[TrendPoint]
    recent_results: list[dict[str, Any]]
    generated_at: datetime


class AuditEventCreate(BaseModel):
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    details: dict[str, Any] = {}


class AuditEventRead(BaseModel):
    id: int
    actor_user_id: UUID | None
    actor_username: str | None
    action: str
    entity_type: str | None
    entity_id: str | None
    details: dict[str, Any]
    ip_address: str | None
    created_at: datetime

