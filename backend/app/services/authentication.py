"""Password hashing, JWT issuance/verification, and account creation services."""
# Exercise through the API: python -m uvicorn app.main:app --reload (from backend).

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
    """Raised when a required authentication secret is missing or unsafe."""


class InvalidCredentialsError(Exception):
    """Raised for unknown accounts or passwords that do not verify."""


class InactiveUserError(Exception):
    """Raised when an account exists but is disabled."""


class InvalidTokenError(Exception):
    """Raised when a JWT is invalid or its subject cannot resolve to a user."""


class UserAlreadyExistsError(Exception):
    """Raised when an account with the normalized email already exists."""


class InvalidUserDepartmentError(Exception):
    """Raised when account creation names an unsupported department."""


class AdminAlreadyBootstrappedError(Exception):
    """Raised when a second initial administrator bootstrap is attempted."""


def _signing_key(settings: Settings) -> str:
    """Return the configured JWT secret or reject an unsafe short key."""
    key = settings.jwt_secret_key.get_secret_value().strip()
    if len(key) < 32:
        raise AuthenticationConfigurationError
    return key


def create_access_token(user: UserDocument, settings: Settings) -> tuple[str, int]:
    """Create the bearer token returned after successful login.

    Steps: read the configured signing key, calculate the expiry from settings,
    add the user ID and issuer claims, sign with HS256, and return both token
    and lifetime so the client knows when it must authenticate again.
    """
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
    """Verify a bearer token before its subject is used for database lookup.

    Validate signature, algorithm, issuer, expiry, and required claims; then
    validate ``sub`` as a Mongo ObjectId. Collapse malformed/expired token
    details into one internal error so API responses do not leak JWT internals.
    """
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
    """Authenticate credentials and return only an active validated account.

    Steps: normalize the email, load the stored account, verify the Argon2 hash,
    construct the Pydantic user model, and reject disabled accounts. Unknown
    users and bad passwords share one error to avoid account enumeration.
    """
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
    """Resolve a verified token subject to a currently active account.

    A valid token is not sufficient on its own: every protected request reloads
    the account so deleted or disabled users lose access immediately.
    """
    document = get_user_by_id(database, user_id)
    if document is None:
        raise InvalidTokenError
    user = UserDocument.model_validate(document)
    if not user.is_active:
        raise InactiveUserError
    return user


def _build_user_document(request: UserCreate) -> UserDocument:
    """Convert validated create input into a safe document for MongoDB.

    Resolve any department code against the configured mapping, hash the
    SecretStr password with Argon2, and build the domain model. Unknown
    department codes fail before the database insert.
    """
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
    """Create a validated account while relying on the unique index for races.

    Check for an existing canonical email, build the model with a password hash,
    insert it, and translate Mongo's duplicate-key race into a domain error.
    """
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
    """Create the initial admin only when no administrator is already present.

    Steps: check whether any admin already exists, construct admin input through
    the same validation used by regular account creation, and delegate hashing
    and insertion to ``create_user``. The email unique index protects a
    duplicate-address race; the admin-count check is the bootstrap guard.
    """
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
