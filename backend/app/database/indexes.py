"""MongoDB collection names and index creation used during API startup."""
# Indexes are created by the API startup command: python -m uvicorn app.main:app --reload.

from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database


GRIEVANCES_COLLECTION = "grievances"

GRIEVANCE_INDEXES = (
    (
        [("reference_id", ASCENDING)],
        {"name": "uq_grievance_reference_id", "unique": True},
    ),
    ([("status", ASCENDING)], {"name": "ix_grievance_status"}),
    (
        [("recommended_department.code", ASCENDING)],
        {"name": "ix_grievance_recommended_department"},
    ),
    (
        [("officer_approved.department.code", ASCENDING)],
        {"name": "ix_grievance_approved_department"},
    ),
    (
        [("ai_suggestion.suggested_priority", ASCENDING)],
        {"name": "ix_grievance_suggested_priority"},
    ),
    (
        [("officer_approved.priority", ASCENDING)],
        {"name": "ix_grievance_approved_priority"},
    ),
    ([("created_at", DESCENDING)], {"name": "ix_grievance_created_at"}),
)

AUDIT_LOGS_COLLECTION = "audit_logs"

AUDIT_LOG_INDEXES = (
    (
        [("reference_id", ASCENDING), ("created_at", DESCENDING)],
        {"name": "ix_audit_reference_created"},
    ),
)

USERS_COLLECTION = "users"

USER_INDEXES = (
    (
        [("email", ASCENDING)],
        {"name": "uq_user_email", "unique": True},
    ),
)


def ensure_grievance_indexes(database: Database) -> list[str]:
    """Create each configured grievance index and return the resulting names.

    The unique reference index prevents duplicate public IDs; the remaining
    indexes support common status, department, priority, and date queries.
    """
    collection = database[GRIEVANCES_COLLECTION]
    return [
        collection.create_index(keys, **options)
        for keys, options in GRIEVANCE_INDEXES
    ]


def ensure_audit_indexes(database: Database) -> list[str]:
    """Index audit lookup by grievance reference and event time."""
    collection = database[AUDIT_LOGS_COLLECTION]
    return [
        collection.create_index(keys, **options)
        for keys, options in AUDIT_LOG_INDEXES
    ]


def ensure_user_indexes(database: Database) -> list[str]:
    """Create the unique normalized-email index used by login and account creation."""
    collection = database[USERS_COLLECTION]
    return [
        collection.create_index(keys, **options)
        for keys, options in USER_INDEXES
    ]
