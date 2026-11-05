from enum import StrEnum


class GrievanceStatus(StrEnum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AIProcessingStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    MANUAL_REVIEW = "manual_review"


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    OFFICER = "OFFICER"
