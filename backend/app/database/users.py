"""MongoDB user lookups and writes used by authentication services."""
# Exercise through the API: python -m uvicorn app.main:app --reload (from backend).

from typing import Any

from pymongo.database import Database

from app.database.indexes import USERS_COLLECTION


def get_user_by_email(database: Database, email: str) -> dict[str, Any] | None:
    """Find a user by the canonical email supplied by the calling service."""
    return database[USERS_COLLECTION].find_one({"email": email})


def get_user_by_id(database: Database, user_id: Any) -> dict[str, Any] | None:
    """Load the account referenced by a decoded JWT subject."""
    return database[USERS_COLLECTION].find_one({"_id": user_id})


def insert_user(database: Database, document: dict[str, Any]) -> None:
    """Insert a validated user and let duplicate-index errors reach the service."""
    database[USERS_COLLECTION].insert_one(document)


def has_admin_user(database: Database) -> bool:
    """Check whether initial administrator bootstrap should be refused."""
    return database[USERS_COLLECTION].count_documents({"role": "ADMIN"}) > 0
