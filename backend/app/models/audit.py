from typing import Any, Literal

from bson import ObjectId
from pydantic import Field

from app.models.common import CreatedModel, MongoModel, MongoObjectId


class AuditActor(MongoModel):
    actor_type: Literal["citizen", "officer", "admin"]
    actor_id: MongoObjectId | None = None


class AuditLogDocument(CreatedModel):
    id: MongoObjectId = Field(default_factory=ObjectId, alias="_id")
    grievance_id: MongoObjectId
    reference_id: str = Field(min_length=25, max_length=25)
    action: Literal[
        "grievance.submitted",
        "grievance.reviewed",
        "grievance.status_changed",
        "grievance.document_uploaded",
    ]
    actor: AuditActor
    previous_values: dict[str, Any] | None = None
    new_values: dict[str, Any]
