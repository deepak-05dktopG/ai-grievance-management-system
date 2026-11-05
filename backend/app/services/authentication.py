from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.core.config import Settings
from app.database.users import (
    get_user_by_email,
    get_user_by_id,
    has_admin_user,
    insert_user,
)
from app.models.enums import UserRole
from app.models.user import UserCreate, UserDocument
from app.services.department_mapping import get_department_by_code


JWT_ISSUER = "creditfix-prototype"
PASSWORD_HASHER = PasswordHasher()


class AuthenticationConfigurationError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class InactiveUserError(Exception):
    pass


class InvalidTokenError(Exception):
    pass


class UserAlreadyExistsError(Exception):
    pass


class InvalidUserDepartmentError(Exception):
    pass


class AdminAlreadyBootstrappedError(Exception):
    pass


def _signing_key(settings: Settings) -> str:
    key = settings.jwt_secret_key.get_secret_value().strip()
    if len(key) < 32:
        raise AuthenticationConfigurationError
    return key


def create_access_token(user: UserDocument, settings: Settings) -> tuple[str, int]:
    expires_in = settings.jwt_access_token_minutes * 60
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "iss": JWT_ISSUER,
            "iat": now,
            "exp": now + timedelta(seconds=expires_in),
        },
        _signing_key(settings),
        algorithm="HS256",
    )
    return token, expires_in


def decode_access_token(token: str, settings: Settings) -> ObjectId:
    try:
        payload = jwt.decode(
            token,
            _signing_key(settings),
            algorithms=["HS256"],
            issuer=JWT_ISSUER,
            options={"require": ["sub", "exp", "iat", "iss"]},
        )
        subject = payload.get("sub")
        if not isinstance(subject, str) or not ObjectId.is_valid(subject):
            raise InvalidTokenError
        return ObjectId(subject)
    except (jwt.InvalidTokenError, AuthenticationConfigurationError) as exc:
        if isinstance(exc, AuthenticationConfigurationError):
            raise
        raise InvalidTokenError from None


def authenticate_user(
    database: Database,
    email: str,
    password: str,
) -> UserDocument:
    document = get_user_by_email(database, email.strip().casefold())
    if document is None:
        raise InvalidCredentialsError
    try:
        PASSWORD_HASHER.verify(document["password_hash"], password)
    except (VerifyMismatchError, InvalidHashError, VerificationError, KeyError):
        raise InvalidCredentialsError from None

    user = UserDocument.model_validate(document)
    if not user.is_active:
        raise InactiveUserError
    return user


def get_active_user(database: Database, user_id: ObjectId) -> UserDocument:
    document = get_user_by_id(database, user_id)
    if document is None:
        raise InvalidTokenError
    user = UserDocument.model_validate(document)
    if not user.is_active:
        raise InactiveUserError
    return user


def _build_user_document(request: UserCreate) -> UserDocument:
    department = None
    if request.department_code is not None:
        department = get_department_by_code(request.department_code)
        if department is None:
            raise InvalidUserDepartmentError

    return UserDocument(
        name=request.name,
        email=request.email,
        password_hash=PASSWORD_HASHER.hash(request.password.get_secret_value()),
        role=request.role,
        department=department,
    )


def create_user(database: Database, request: UserCreate) -> UserDocument:
    if get_user_by_email(database, request.email) is not None:
        raise UserAlreadyExistsError
    user = _build_user_document(request)
    document: dict[str, Any] = user.model_dump(by_alias=True, mode="python")
    try:
        insert_user(database, document)
    except DuplicateKeyError:
        raise UserAlreadyExistsError from None
    return user


def create_first_admin(
    database: Database,
    name: str,
    email: str,
    password: str,
) -> UserDocument:
    if has_admin_user(database):
        raise AdminAlreadyBootstrappedError
    return create_user(
        database,
        UserCreate(
            name=name,
            email=email,
            password=password,
            role=UserRole.ADMIN,
        ),
    )
