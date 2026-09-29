from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DefectInput(BaseModel):
    reason: str = Field(min_length=1, max_length=120)
    category: str | None = Field(default=None, max_length=80)
    count: int = Field(default=1, ge=1)


class InspectionCreate(BaseModel):
    inspection_key: str | None = Field(default=None, max_length=100)
    status: Literal["OK", "NOT_OK"]
    preset: str | None = Field(default=None, max_length=120)
    image_name: str | None = Field(default=None, max_length=255)
    batch_code: str | None = Field(default=None, max_length=120)
    processing_ms: float | None = Field(default=None, ge=0)
    print_verified: bool | None = None
    print_status: Literal["OK", "NOT_OK"] | None = None
    defects: list[DefectInput] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_print_result(self) -> "InspectionCreate":
        if self.print_verified is True and self.print_status is None:
            raise ValueError("print_status is required when print_verified is true")
        if self.print_verified is False and self.print_status is not None:
            raise ValueError("print_status must be empty when print_verified is false")
        return self


class InspectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inspection_key: str | None
    status: str
    preset: str | None
    image_name: str | None
    batch_code: str | None
    processing_ms: float | None
    print_verified: bool | None
    print_status: str | None
    defects: list[dict[str, Any]]
    metadata: dict[str, Any] = Field(validation_alias="metadata_json")
    created_at: datetime
