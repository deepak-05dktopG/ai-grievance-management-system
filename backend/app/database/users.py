from typing import Any

from pymongo.database import Database

from app.database.indexes import USERS_COLLECTION


def get_user_by_email(database: Database, email: str) -> dict[str, Any] | None:
    return database[USERS_COLLECTION].find_one({"email": email})


def get_user_by_id(database: Database, user_id: Any) -> dict[str, Any] | None:
    return database[USERS_COLLECTION].find_one({"_id": user_id})


def insert_user(database: Database, document: dict[str, Any]) -> None:
    database[USERS_COLLECTION].insert_one(document)


def has_admin_user(database: Database) -> bool:
    return database[USERS_COLLECTION].count_documents({"role": "ADMIN"}) > 0
