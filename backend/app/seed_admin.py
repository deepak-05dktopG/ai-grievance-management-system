"""Create a configured demo administrator; run from backend with: python -m app.seed_admin."""

from typing import NoReturn

from pydantic import SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo.errors import PyMongoError

from app.core.config import BACKEND_ENV_FILE, get_settings
from app.database.indexes import ensure_user_indexes
from app.database.mongo import create_mongo_client, ping_mongo
from app.database.users import get_user_by_email
from app.models.enums import UserRole
from app.models.user import UserCreate
from app.services.authentication import UserAlreadyExistsError, create_user


class SeedAdminSettings(BaseSettings):
    """Read optional bootstrap account values from the backend environment file."""

    seed_admin_name: str = ""
    seed_admin_email: str = ""
    seed_admin_password: SecretStr = SecretStr("")

    model_config = SettingsConfigDict(
        env_file=BACKEND_ENV_FILE,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        case_sensitive=False,
        extra="ignore",
    )


def _fail(message: str) -> NoReturn:
    """Exit with a sanitized configuration or persistence message."""
    raise SystemExit(message)


def main() -> None:
    """Validate seed settings and create an admin without resetting existing accounts."""
    seed = SeedAdminSettings()
    if not seed.seed_admin_name.strip() or not seed.seed_admin_email.strip():
        _fail(
            "Set SEED_ADMIN_NAME and SEED_ADMIN_EMAIL in the environment or backend/.env."
        )
    if not seed.seed_admin_password.get_secret_value():
        _fail("Set SEED_ADMIN_PASSWORD in the environment or backend/.env.")

    try:
        request = UserCreate(
            name=seed.seed_admin_name,
            email=seed.seed_admin_email,
            password=seed.seed_admin_password,
            role=UserRole.ADMIN,
        )
    except ValidationError:
        _fail(
            "Seed admin details are invalid; check the required name, email, and password."
        )

    settings = get_settings()
    if not settings.has_mongodb_configuration:
        _fail("Configure MongoDB before seeding an admin.")

    client = create_mongo_client(settings)
    try:
        ping_mongo(client)
        database = client[settings.mongodb_db_name]
        ensure_user_indexes(database)
        existing = get_user_by_email(database, request.email)
        if existing is not None:
            if existing.get("role") != UserRole.ADMIN.value:
                _fail(
                    "The configured seed email belongs to a non-admin account; "
                    "no changes were made."
                )
            print(f"Admin {request.email} already exists; no changes were made.")
            return
        try:
            user = create_user(database, request)
        except UserAlreadyExistsError:
            _fail("An account with the configured seed email already exists; no changes were made.")
    except PyMongoError:
        _fail("MongoDB operation failed; check the configured database.")
    finally:
        client.close()

    print(f"Created seed admin {user.email}. The password was not displayed.")


if __name__ == "__main__":
    main()
