from pydantic import Field

from app.models.common import MongoModel


class DepartmentReference(MongoModel):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=120)


class Department(MongoModel):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=120)
    supported_categories: list[str] = Field(min_length=1)
