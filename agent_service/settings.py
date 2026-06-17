from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-2.0-flash"
    LOG_LEVEL: str = "INFO"
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    class Config:
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
