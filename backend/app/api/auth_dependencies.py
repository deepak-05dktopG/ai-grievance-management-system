from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from app.api.dependencies import get_database
from app.core.config import get_settings
from app.models.enums import UserRole
from app.models.user import UserDocument
from app.services.authentication import (
    AuthenticationConfigurationError,
    InactiveUserError,
    InvalidTokenError,
    decode_access_token,
    get_active_user,
)


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    database: Annotated[Database, Depends(get_database)],
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> UserDocument:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = decode_access_token(credentials.credentials, get_settings())
        return get_active_user(database, user_id)
    except AuthenticationConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured",
        ) from None
    except (InactiveUserError, InvalidTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive account",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def require_admin(
    current_user: Annotated[UserDocument, Depends(get_current_user)],
) -> UserDocument:
    if current_user.role is not UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return current_user
