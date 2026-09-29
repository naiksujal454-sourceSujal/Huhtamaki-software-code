from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_uuid")
    username: str
    role: Literal["admin", "operator", "user"]
    is_active: bool


class LoginResponse(BaseModel):
    user: UserRead
    token: str | None = None
    expires_at: str


class UserUpdateRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    username: str | None = Field(default=None, min_length=1, max_length=64)
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @model_validator(mode="after")
    def has_change(self) -> "UserUpdateRequest":
        if self.username is None and self.password is None:
            raise ValueError("username or password must be provided")
        return self
