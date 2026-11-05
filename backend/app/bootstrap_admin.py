from getpass import getpass
from typing import NoReturn

from pymongo.errors import PyMongoError

from app.core.config import get_settings
from app.database.indexes import ensure_user_indexes
from app.database.mongo import create_mongo_client, ping_mongo
from app.services.authentication import (
    AdminAlreadyBootstrappedError,
    UserAlreadyExistsError,
    create_first_admin,
)


def _fail(message: str) -> NoReturn:
    raise SystemExit(message)


def main() -> None:
    settings = get_settings()
    if not settings.has_mongodb_configuration:
        _fail("Configure MongoDB before creating the first admin.")

    name = input("Admin name: ").strip()
    email = input("Admin email: ").strip()
    password = getpass("Admin password (minimum 12 characters): ")
    confirmation = getpass("Confirm admin password: ")
    if password != confirmation:
        _fail("Passwords do not match.")

    client = create_mongo_client(settings)
    try:
        ping_mongo(client)
        database = client[settings.mongodb_db_name]
        ensure_user_indexes(database)
        try:
            user = create_first_admin(database, name, email, password)
        except AdminAlreadyBootstrappedError:
            _fail("An admin account already exists; bootstrap is disabled.")
        except UserAlreadyExistsError:
            _fail("That email address is already registered.")
    except PyMongoError:
        _fail("MongoDB operation failed; check the configured database.")
    finally:
        client.close()

    print(f"Created initial admin account for {user.email}.")


if __name__ == "__main__":
    main()
