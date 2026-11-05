"""Validated user documents and authentication/user-creation API schemas."""
# Exercise through the API: python -m uvicorn app.main:app --reload (from backend).

import re
from datetime import datetime

from bson import ObjectId
from pydantic import Field, SecretStr, field_validator, model_validator

from app.models.common import CreatedModel, MongoModel, MongoObjectId
from app.models.department import DepartmentReference
from app.models.enums import UserRole


class UserDocument(CreatedModel):
    """Validated account record stored in MongoDB, including only a password hash."""

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
        """Trim the stored account name and reject an empty result."""
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Canonicalize email casing and reject a malformed address."""
        value = value.strip().casefold()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email address is invalid")
        return value

    @model_validator(mode="after")
    def officers_require_department(self) -> "UserDocument":
        """Prevent persisted officer accounts from lacking a department scope."""
        if self.role is UserRole.OFFICER and self.department is None:
            raise ValueError("Officer accounts require a department")
        return self


class UserCreate(MongoModel):
    """Validated account-creation input; plaintext password is held as SecretStr."""

    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr
    role: UserRole
    department_code: str | None = Field(default=None, min_length=2, max_length=20)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        """Trim the requested account name before it is saved."""
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize the email for case-insensitive lookup and uniqueness."""
        value = value.strip().casefold()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email address is invalid")
        return value

    @field_validator("department_code")
    @classmethod
    def normalize_department_code(cls, value: str | None) -> str | None:
        """Convert a supplied department code to the canonical uppercase form."""
        if value is None:
            return None
        value = value.strip().upper()
        if not value:
            raise ValueError("Department code must not be blank")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: SecretStr) -> SecretStr:
        """Enforce the supported password length without exposing its contents."""
        if not 12 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Password must contain 12 to 128 characters")
        return value

    @model_validator(mode="after")
    def validate_role_department(self) -> "UserCreate":
        """Require departments for officers and forbid them for administrators."""
        if self.role is UserRole.OFFICER and self.department_code is None:
            raise ValueError("Officer accounts require a department")
        if self.role is UserRole.ADMIN and self.department_code is not None:
            raise ValueError("Admin accounts cannot be assigned to a department")
        return self


class UserResponse(MongoModel):
    """Public user fields returned by login and administrator account creation."""

    id: MongoObjectId = Field(alias="_id", serialization_alias="id")
    name: str
    email: str
    role: UserRole
    department: DepartmentReference | None
    is_active: bool
    created_at: datetime

    @classmethod
    def from_user(cls, user: UserDocument) -> "UserResponse":
        """Build a public response while deliberately omitting the password hash."""
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
    """Validated login credentials accepted by the authentication endpoint."""

    email: str = Field(min_length=3, max_length=254)
    password: SecretStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize login email the same way it is normalized on account creation."""
        value = value.strip().casefold()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Email address is invalid")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: SecretStr) -> SecretStr:
        """Reject empty or excessively long login passwords before verification."""
        if not 1 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Password must contain at most 128 characters")
        return value


class LoginResponse(MongoModel):
    """Bearer token and public user profile returned after successful login."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
