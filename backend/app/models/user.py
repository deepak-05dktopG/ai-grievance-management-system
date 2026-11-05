import re
from datetime import datetime

from bson import ObjectId
from pydantic import Field, SecretStr, field_validator, model_validator

from app.models.common import CreatedModel, MongoModel, MongoObjectId
from app.models.department import DepartmentReference
from app.models.enums import UserRole


class UserDocument(CreatedModel):
    id: MongoObjectId = Field(default_factory=ObjectId, alias="_id")
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password_hash: str = Field(repr=False, min_length=1)
    role: UserRole
    department: DepartmentReference | None = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().casefold()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email address is invalid")
        return value

    @model_validator(mode="after")
    def officers_require_department(self) -> "UserDocument":
        if self.role is UserRole.OFFICER and self.department is None:
            raise ValueError("Officer accounts require a department")
        return self


class UserCreate(MongoModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr
    role: UserRole
    department_code: str | None = Field(default=None, min_length=2, max_length=20)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().casefold()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email address is invalid")
        return value

    @field_validator("department_code")
    @classmethod
    def normalize_department_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if not value:
            raise ValueError("Department code must not be blank")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: SecretStr) -> SecretStr:
        if not 12 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Password must contain 12 to 128 characters")
        return value

    @model_validator(mode="after")
    def validate_role_department(self) -> "UserCreate":
        if self.role is UserRole.OFFICER and self.department_code is None:
            raise ValueError("Officer accounts require a department")
        if self.role is UserRole.ADMIN and self.department_code is not None:
            raise ValueError("Admin accounts cannot be assigned to a department")
        return self


class UserResponse(MongoModel):
    id: MongoObjectId = Field(alias="_id", serialization_alias="id")
    name: str
    email: str
    role: UserRole
    department: DepartmentReference | None
    is_active: bool
    created_at: datetime

    @classmethod
    def from_user(cls, user: UserDocument) -> "UserResponse":
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            department=user.department,
            is_active=user.is_active,
            created_at=user.created_at,
        )


class LoginRequest(MongoModel):
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().casefold()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email address is invalid")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: SecretStr) -> SecretStr:
        if not 1 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Password must contain at most 128 characters")
        return value


class LoginResponse(MongoModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
