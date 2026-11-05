"""Backend settings loaded from backend/.env; GROQ_API_KEY is kept secret."""
# Run from backend: python -m uvicorn app.main:app --reload

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Validated backend environment configuration, including secret fields."""

    mongodb_uri: SecretStr = SecretStr("")
    mongodb_db_name: str = ""
    mongodb_server_selection_timeout_ms: int = Field(default=5000, ge=100, le=30000)
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = Field(
        default="openai/gpt-oss-20b",
        min_length=1,
        max_length=100,
    )
    groq_confidence_threshold: float = Field(default=0.65, ge=0, le=1)
    groq_timeout_ms: int = Field(default=15000, ge=1000, le=120000)
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: SecretStr = SecretStr("")
    cloudinary_api_secret: SecretStr = SecretStr("")
    jwt_secret_key: SecretStr = SecretStr("")
    jwt_access_token_minutes: int = Field(default=30, ge=1, le=1440)

    model_config = SettingsConfigDict(
        env_file=BACKEND_ENV_FILE,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def has_mongodb_configuration(self) -> bool:
        """Check that the URI and database name are both present before connect."""
        return bool(
            self.mongodb_uri.get_secret_value().strip()
            and self.mongodb_db_name.strip()
        )

    @property
    def has_cloudinary_configuration(self) -> bool:
        """Check all Cloudinary fields together before an upload is attempted."""
        return bool(
            self.cloudinary_cloud_name.strip()
            and self.cloudinary_api_key.get_secret_value().strip()
            and self.cloudinary_api_secret.get_secret_value().strip()
        )

    @property
    def has_jwt_configuration(self) -> bool:
        """Require a minimum-length signing secret before issuing or checking JWTs."""
        return len(self.jwt_secret_key.get_secret_value().strip()) >= 32


@lru_cache
def get_settings() -> Settings:
    """Load settings once and reuse them for the lifetime of the process.

    ``Settings`` reads the backend's explicit ``.env`` path and applies its
    declared defaults and validation to environment values.
    """
    return Settings()
