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


class ProductionBatchInfo(BaseModel):
    batch_code: str | None = None
    status: str = "OPEN"
    opened_at: datetime | None = None
    total: int = 0
    passed: int = 0
    failed: int = 0


class PipelineHealthInfo(BaseModel):
    queue_depth: int = 0
    queue_age_seconds: float = 0.0
    ws_clients: int = 0
    audit_db_write_ok_total: int = 0


class OpenBatchRequest(BaseModel):
    batch_code: str


class BatchHistoryItem(BaseModel):
    code: str
    status: str
    pass_count: int
    fail_count: int
    total_count: int
    opened_at: datetime | None = None
    opened_formatted: str | None = None


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
    production_batch: ProductionBatchInfo | None = None
    pipeline_health: PipelineHealthInfo | None = None
    batch_history: list[BatchHistoryItem] = []
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

