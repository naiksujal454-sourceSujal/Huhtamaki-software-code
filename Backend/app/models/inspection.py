from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inspection_key: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    preset: Mapped[str | None] = mapped_column(String(120), index=True, nullable=True)
    image_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    batch_code: Mapped[str | None] = mapped_column(String(120), index=True, nullable=True)
    processing_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    print_verified: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    print_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    defects: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True, nullable=False)
