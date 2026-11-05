from pydantic import Field, field_validator, model_validator

from app.models.common import ComplaintDescription, MongoModel, MongoObjectId
from app.models.department import DepartmentReference
from app.models.enums import GrievanceStatus, Priority
from app.models.grievance import CitizenDetails, GrievanceDocument


class GrievanceCreateRequest(MongoModel):
    citizen_details: CitizenDetails
    complaint_description: ComplaintDescription


class GrievanceResponse(GrievanceDocument):
    id: MongoObjectId = Field(alias="_id", exclude=True)


class GrievanceReviewRequest(MongoModel):
    category: str | None = Field(default=None, min_length=1, max_length=80)
    subcategory: str | None = Field(default=None, max_length=80)
    priority: Priority | None = None
    department: DepartmentReference | None = None

    @field_validator("category", "subcategory")
    @classmethod
    def strip_review_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @model_validator(mode="after")
    def require_review_value(self) -> "GrievanceReviewRequest":
        if not any(
            getattr(self, field_name) is not None
            for field_name in ("category", "subcategory", "priority", "department")
        ):
            raise ValueError("At least one review value is required")
        return self


class GrievanceStatusUpdateRequest(MongoModel):
    status: GrievanceStatus


class GrievanceListResponse(MongoModel):
    items: list[GrievanceResponse]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    pages: int = Field(ge=0)
