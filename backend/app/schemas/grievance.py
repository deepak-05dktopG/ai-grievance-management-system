"""Validated request/response shapes for grievance API endpoints."""
# Exercise through the API: python -m uvicorn app.main:app --reload (from backend).

from datetime import datetime

from pydantic import Field, field_validator, model_validator

from app.models.common import ComplaintDescription, MongoModel, MongoObjectId
from app.models.department import DepartmentReference
from app.models.enums import GrievanceStatus, Priority
from app.models.audit import AuditLogDocument
from app.models.grievance import CitizenDetails, GrievanceDocument


class GrievanceCreateRequest(MongoModel):
    """Public request body for creating a grievance, before server processing."""

    citizen_details: CitizenDetails
    complaint_description: ComplaintDescription


class GrievanceResponse(GrievanceDocument):
    """API projection of a grievance without its internal MongoDB identifier."""

    id: MongoObjectId = Field(alias="_id", exclude=True)


class GrievanceSubmissionResponse(GrievanceResponse):
    """Initial submission response, including the citizen's one-time access token."""

    citizen_access_token: str


class GrievanceTrackingResponse(MongoModel):
    """Limited tracking fields that may be returned to the submitting citizen."""

    reference_id: str
    status: GrievanceStatus
    ai_processing_status: str
    officer_reviewed: bool
    created_at: datetime
    updated_at: datetime


class AuditLogResponse(AuditLogDocument):
    """Public audit event shape that excludes the internal database identifier."""

    id: MongoObjectId = Field(alias="_id", exclude=True)


class GrievanceReviewRequest(MongoModel):
    """Partial staff correction; only supplied fields are applied by the service."""

    category: str | None = Field(default=None, min_length=1, max_length=80)
    subcategory: str | None = Field(default=None, max_length=80)
    priority: Priority | None = None
    department: DepartmentReference | None = None

    @field_validator("category", "subcategory")
    @classmethod
    def strip_review_text(cls, value: str | None) -> str | None:
        """Trim supplied correction text and reject empty strings as values."""
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @model_validator(mode="after")
    def require_review_value(self) -> "GrievanceReviewRequest":
        """Reject an empty correction so a review request changes at least one field."""
        if not any(
            getattr(self, field_name) is not None
            for field_name in ("category", "subcategory", "priority", "department")
        ):
            raise ValueError("At least one review value is required")
        return self


class GrievanceStatusUpdateRequest(MongoModel):
    """Requested next workflow state; transition permission is checked separately."""

    status: GrievanceStatus


class GrievanceListResponse(MongoModel):
    """Paginated staff response with items and matching result counts."""

    items: list[GrievanceResponse]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    pages: int = Field(ge=0)
