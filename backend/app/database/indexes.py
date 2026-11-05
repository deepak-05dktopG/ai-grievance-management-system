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
    ([("created_at", DESCENDING)], {"name": "ix_grievance_created_at"}),
)


def ensure_grievance_indexes(database: Database) -> list[str]:
    collection = database[GRIEVANCES_COLLECTION]
    return [
        collection.create_index(keys, **options)
        for keys, options in GRIEVANCE_INDEXES
    ]
