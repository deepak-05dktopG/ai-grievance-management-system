from datetime import datetime, timezone
from typing import Annotated, Any

from bson import ObjectId
from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    WithJsonSchema,
    field_validator,
)


def _validate_object_id(value: Any) -> ObjectId:
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and ObjectId.is_valid(value):
        return ObjectId(value)
    raise ValueError("Value must be a valid MongoDB ObjectId")


MongoObjectId = Annotated[
    ObjectId,
    BeforeValidator(_validate_object_id),
    PlainSerializer(str, return_type=str, when_used="json"),
    WithJsonSchema({"type": "string", "pattern": "^[a-fA-F0-9]{24}$"}),
]

ComplaintDescription = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=10, max_length=10000),
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class MongoModel(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        extra="forbid",
        populate_by_name=True,
    )


class TimestampedModel(MongoModel):
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_validator("created_at", "updated_at")
    @classmethod
    def timestamps_are_utc(cls, value: datetime) -> datetime:
        return _as_utc(value)


class CreatedModel(MongoModel):
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("created_at")
    @classmethod
    def created_at_is_utc(cls, value: datetime) -> datetime:
        return _as_utc(value)
