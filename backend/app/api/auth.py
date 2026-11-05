"""Authentication API routes; run the API from backend with: python -m uvicorn app.main:app --reload."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from app.api.auth_dependencies import get_current_user, require_admin
from app.api.dependencies import get_database
from app.core.config import get_settings
from app.models.user import LoginRequest, LoginResponse, UserCreate, UserDocument, UserResponse
from app.services.authentication import (
    AuthenticationConfigurationError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidUserDepartmentError,
    UserAlreadyExistsError,
    authenticate_user,
    create_access_token,
    create_user,
)


router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest,
    database: Annotated[Database, Depends(get_database)],
) -> LoginResponse:
    """Log in a user and return the token plus the public account profile.

    Steps: find the normalized email, verify its Argon2 password hash, reject
    inactive accounts, sign a short-lived JWT, then map expected authentication
    failures to safe HTTP responses. The raw password and stored hash are never
    included in the response.
    """
    try:
        user = authenticate_user(
            database,
            request.email,
            request.password.get_secret_value(),
        )
        access_token, expires_in = create_access_token(user, get_settings())
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InactiveUserError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        ) from None
    except AuthenticationConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured",
        ) from None
    return LoginResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=UserResponse.from_user(user),
    )


@router.get("/me", response_model=UserResponse)
def current_user(
    user: Annotated[UserDocument, Depends(get_current_user)],
) -> UserResponse:
    """Return only the public fields of the account resolved from the JWT."""
    return UserResponse.from_user(user)


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user_endpoint(
    request: UserCreate,
    database: Annotated[Database, Depends(get_database)],
    _administrator: Annotated[UserDocument, Depends(require_admin)],
) -> UserResponse:
    """Create an account for an authenticated administrator.

    FastAPI first resolves ``require_admin`` and validates ``UserCreate``.
    The service then resolves the department, hashes the password, and inserts
    the account; duplicate emails and invalid departments become client-safe
    conflict or validation responses.
    """
    try:
        user = create_user(database, request)
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        ) from None
    except InvalidUserDepartmentError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Department is not in the illustrative department configuration",
        ) from None
    return UserResponse.from_user(user)
