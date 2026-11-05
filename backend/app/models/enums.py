"""Allowed grievance, AI processing, priority, and account-role values."""
# Exercise through the API: python -m uvicorn app.main:app --reload (from backend).

from enum import StrEnum


class GrievanceStatus(StrEnum):
    """Workflow states accepted by the grievance model and status API."""

    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class Priority(StrEnum):
    """Priority values shared by AI suggestions and officer corrections."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AIProcessingStatus(StrEnum):
    """Track whether AI processing completed or staff review is required."""

    PENDING = "pending"
    COMPLETED = "completed"
    MANUAL_REVIEW = "manual_review"


class UserRole(StrEnum):
    """Backend authorization roles; permissions are enforced server-side."""

    ADMIN = "ADMIN"
    OFFICER = "OFFICER"
