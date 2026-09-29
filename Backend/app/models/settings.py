from datetime import datetime
from typing import Any
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"
    __table_args__ = (
        UniqueConstraint("section", "key", name="uq_section_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    section: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    key: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AlertConfiguration(Base):
    __tablename__ = "alert_configurations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    is_displayed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_suppressed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="Medium", nullable=False)
    threshold_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ServiceDetail(Base):
    __tablename__ = "service_details"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider_name: Mapped[str] = mapped_column(String(128), nullable=False, default="Pixtron Systems Pvt. Ltd.")
    contact_info: Mapped[str] = mapped_column(String(128), nullable=False, default="+91 98765 43210")
    last_service_date: Mapped[str | None] = mapped_column(String(32), nullable=True, default="2026-08-15")
    next_service_date: Mapped[str | None] = mapped_column(String(32), nullable=True, default="2026-11-15")
    service_hours: Mapped[int] = mapped_column(Integer, default=1420, nullable=False)
    system_running_hours: Mapped[int] = mapped_column(Integer, default=3280, nullable=False)
    maintenance_notes: Mapped[str | None] = mapped_column(Text, nullable=True, default="Annual calibration completed.")
    warranty_status: Mapped[str | None] = mapped_column(String(128), nullable=True, default="Active until August 2027")
    support_email: Mapped[str | None] = mapped_column(String(128), nullable=True, default="support@pixtronsystems.com")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class RolePrivilege(Base):
    __tablename__ = "role_privileges"
    __table_args__ = (
        UniqueConstraint("role", "privilege_name", name="uq_role_privilege"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(32), index=True, nullable=False)  # operator | supervisor
    privilege_name: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    is_granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)  # Core Access | Settings Controls | Log Channels | Connections
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
