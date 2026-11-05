from typing import Any

from pymongo.database import Database
from pymongo.results import UpdateResult

from app.database.indexes import AUDIT_LOGS_COLLECTION, GRIEVANCES_COLLECTION
from app.models.enums import GrievanceStatus


def insert_grievance(database: Database, document: dict[str, Any], session: Any) -> None:
    database[GRIEVANCES_COLLECTION].insert_one(document, session=session)


def get_grievance(
    database: Database,
    reference_id: str,
    session: Any = None,
) -> dict[str, Any] | None:
    return database[GRIEVANCES_COLLECTION].find_one(
        {"reference_id": reference_id},
        session=session,
    )


def list_grievances(
    database: Database,
    query: dict[str, Any],
    *,
    skip: int,
    limit: int,
) -> tuple[list[dict[str, Any]], int]:
    collection = database[GRIEVANCES_COLLECTION]
    total = collection.count_documents(query)
    documents = list(
        collection.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return documents, total


def update_grievance(
    database: Database,
    reference_id: str,
    values: dict[str, Any],
    *,
    session: Any,
    expected_status: GrievanceStatus | None = None,
) -> UpdateResult:
    query: dict[str, Any] = {"reference_id": reference_id}
    if expected_status is not None:
        query["status"] = expected_status.value
    return database[GRIEVANCES_COLLECTION].update_one(
        query,
        {"$set": values},
        session=session,
    )


def insert_audit_log(
    database: Database,
    document: dict[str, Any],
    session: Any,
) -> None:
    database[AUDIT_LOGS_COLLECTION].insert_one(document, session=session)
