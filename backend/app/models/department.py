"""Pydantic models for department references and supported grievance categories."""
# Exercise through the API: python -m uvicorn app.main:app --reload (from backend).

from pydantic import Field

from app.models.common import MongoModel


class DepartmentReference(MongoModel):
    """Embed a department's stable code and display name in another record."""

    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=120)


class Department(MongoModel):
    """Configure one illustrative department and the categories it handles."""

    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=120)
    supported_categories: list[str] = Field(min_length=1)
