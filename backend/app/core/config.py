from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    mongodb_uri: SecretStr = SecretStr("")
    mongodb_db_name: str = ""
    mongodb_server_selection_timeout_ms: int = Field(default=5000, ge=100, le=30000)
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = Field(default="gemini-2.5-flash", min_length=1, max_length=100)
    gemini_confidence_threshold: float = Field(default=0.65, ge=0, le=1)
    gemini_timeout_ms: int = Field(default=15000, ge=1000, le=120000)

    model_config = SettingsConfigDict(
        env_file=BACKEND_ENV_FILE,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def has_mongodb_configuration(self) -> bool:
        return bool(
            self.mongodb_uri.get_secret_value().strip()
            and self.mongodb_db_name.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
