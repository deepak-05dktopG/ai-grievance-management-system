"""Shared Pydantic/Mongo types and UTC timestamp helpers for backend models."""
# Validate through the API: python -m uvicorn app.main:app --reload (from backend).

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
    """Accept an ObjectId or valid 24-character hex string for model input."""
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
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """Treat naive timestamps as UTC and convert aware timestamps to UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class MongoModel(BaseModel):
    """Base validation rules shared by Mongo-backed and API data models."""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        extra="forbid",
        populate_by_name=True,
    )


class TimestampedModel(MongoModel):
    """Add UTC creation and update timestamps to mutable database documents."""

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_validator("created_at", "updated_at")
    @classmethod
    def timestamps_are_utc(cls, value: datetime) -> datetime:
        """Normalize both lifecycle timestamps before model values are stored."""
        return _as_utc(value)


class CreatedModel(MongoModel):
    """Add a UTC creation timestamp to append-only records such as audit events."""

    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("created_at")
    @classmethod
    def created_at_is_utc(cls, value: datetime) -> datetime:
        """Normalize the creation timestamp to a timezone-aware UTC value."""
        return _as_utc(value)
