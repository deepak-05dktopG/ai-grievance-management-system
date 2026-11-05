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


def ensure_grievance_indexes(database: Database) -> list[str]:
    collection = database[GRIEVANCES_COLLECTION]
    return [
        collection.create_index(keys, **options)
        for keys, options in GRIEVANCE_INDEXES
    ]


def ensure_audit_indexes(database: Database) -> list[str]:
    collection = database[AUDIT_LOGS_COLLECTION]
    return [
        collection.create_index(keys, **options)
        for keys, options in AUDIT_LOG_INDEXES
    ]
