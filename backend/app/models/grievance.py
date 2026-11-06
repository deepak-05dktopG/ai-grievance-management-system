"""Pydantic models for citizen details, AI suggestions, reviews, and grievances."""
# Exercise through the API: python -m uvicorn app.main:app --reload (from backend).

import re
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlsplit

from bson import ObjectId
from pydantic import Field, field_validator, model_validator

from app.models.common import (
    ComplaintDescription,
    MongoObjectId,
    MongoModel,
    TimestampedModel,
    utc_now,
)
from app.models.department import DepartmentReference
from app.models.enums import AIProcessingStatus, GrievanceStatus, Priority
from app.services.reference_id import generate_grievance_reference_id


class CitizenDetails(MongoModel):
    """Validated contact details supplied with a citizen's grievance."""

    full_name: str = Field(min_length=1, max_length=120)
    phone_number: str = Field(min_length=7, max_length=20)
    email: str | None = Field(default=None, max_length=254)

    @field_validator("full_name", "phone_number")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Trim required citizen text and reject whitespace-only values."""
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @field_validator("phone_number")
    @classmethod
    def phone_number_has_valid_characters(cls, value: str) -> str:
        """Restrict phone input to the accepted digits and dialing punctuation."""
        if len(value) < 7 or len(value) > 20:
            raise ValueError("Phone number must contain between 7 and 20 characters")
        if not re.fullmatch(r"[0-9+() -]+", value):
            raise ValueError("Phone number contains invalid characters")
        return value

    @field_validator("email")
    @classmethod
    def email_has_valid_format(cls, value: str | None) -> str | None:
        """Normalize an optional email and reject values outside the basic format."""
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email address is invalid")
        return value


class DocumentMetadata(MongoModel):
    """Metadata for a file stored remotely; the file bytes are not stored here."""

    original_filename: str = Field(min_length=1, max_length=255)
    cloudinary_public_id: str = Field(min_length=1, max_length=255)
    secure_url: str = Field(min_length=1, max_length=2048)
    resource_type: Literal["image", "raw", "video"]
    format: str = Field(min_length=1, max_length=32)
    size_bytes: int = Field(gt=0)
    uploaded_at: datetime = Field(default_factory=utc_now)

    @field_validator("original_filename", "cloudinary_public_id", "format")
    @classmethod
    def strip_required_metadata(cls, value: str) -> str:
        """Trim mandatory upload metadata and reject values containing only spaces."""
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @field_validator("secure_url")
    @classmethod
    def secure_url_must_be_https(cls, value: str) -> str:
        """Require HTTPS and disallow credentials embedded in a stored document URL."""
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError("Document URL must be a credential-free HTTPS URL")
        return value

    @field_validator("uploaded_at")
    @classmethod
    def uploaded_at_is_utc(cls, value: datetime) -> datetime:
        """Normalize Cloudinary metadata timestamps to timezone-aware UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class AISuggestion(MongoModel):
    """Validated advisory fields returned by the AI classification provider."""

    category: str = Field(min_length=1, max_length=80)
    subcategory: str | None = Field(default=None, max_length=80)
    summary: str = Field(min_length=1, max_length=1500)
    suggested_priority: Priority
    confidence: float = Field(ge=0, le=1)
    explanation: str = Field(min_length=1, max_length=1000)

    @field_validator("category", "summary", "explanation")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Trim required AI text fields and reject a blank model response."""
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @field_validator("subcategory")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Represent omitted or whitespace-only subcategories as ``None``."""
        if value is None:
            return None
        value = value.strip()
        return value or None


class OfficerApprovedValues(MongoModel):
    """Staff-approved values kept separately from original AI recommendations."""

    category: str | None = Field(default=None, min_length=1, max_length=80)
    subcategory: str | None = Field(default=None, max_length=80)
    priority: Priority | None = None
    department: DepartmentReference | None = None

    @field_validator("category", "subcategory")
    @classmethod
    def strip_approved_text(cls, value: str | None) -> str | None:
        """Trim staff-entered corrections while preserving omitted fields."""
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Approved text must not be blank")
        return value

    @model_validator(mode="after")
    def require_at_least_one_approved_value(self) -> "OfficerApprovedValues":
        """Require a review to approve or correct at least one supported field."""
        if not any(
            value is not None
            for value in (
                self.category,
                self.subcategory,
                self.priority,
                self.department,
            )
        ):
            raise ValueError("At least one officer-approved value is required")
        return self


class GrievanceDocument(TimestampedModel):
    """Persist the complaint, processing state, recommendations, and review data.

    AI and approved values are separate; only approved values represent staff
    decisions. Citizen access credentials are excluded from normal serialization.
    """

    id: MongoObjectId = Field(default_factory=ObjectId, alias="_id")
    reference_id: str = Field(
        default_factory=generate_grievance_reference_id,
        min_length=25,
        max_length=25,
        pattern=r"^CFX-\d{8}-[A-F0-9]{12}$",
    )
    citizen_details: CitizenDetails
    complaint_description: ComplaintDescription
    ai_suggestion: AISuggestion | None = None
    ai_processing_status: AIProcessingStatus = AIProcessingStatus.PENDING
    recommended_department: DepartmentReference | None = None
    officer_approved: OfficerApprovedValues | None = None
    assigned_officer_id: MongoObjectId | None = None
    status: GrievanceStatus = GrievanceStatus.SUBMITTED
    supporting_documents: list[DocumentMetadata] = Field(default_factory=list)
    # Keep citizen tracking credentials out of ordinary model and API dumps.
    citizen_access_token_hash: str | None = Field(
        default=None,
        repr=False,
        exclude=True,
    )
    citizen_access_token_expires_at: datetime | None = Field(
        default=None,
        repr=False,
        exclude=True,
    )
    citizen_tracking_code: str | None = Field(
        default=None,
        repr=False,
        exclude=True,
    )
