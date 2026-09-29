from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    database_url: str
    frontend_origins: str = (
        "http://localhost:3000,http://localhost:5173,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173,"
        "http://tauri.localhost,tauri://localhost,http://localhost:1420"
    )
    session_ttl_minutes: int = 480
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_name: str = "huhtamaki_session"
    default_admin_password: str = "Admin@123"
    default_operator_password: str = "Operator@123"
    default_user_password: str = "User@123"

    model_config = SettingsConfigDict(env_file=(str(ENV_PATH), ".env"), env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
