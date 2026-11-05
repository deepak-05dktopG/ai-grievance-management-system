from typing import Annotated
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
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
from app.services.grievance_management import (
    GrievanceNotFoundError,
    InvalidCitizenAccessTokenError,
    verify_citizen_access_token,
)


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class DocumentUploader:
    actor: UserDocument | None = None
    citizen_access_token: str | None = None


def _resolve_credentials(
    database: Database,
    credentials: HTTPAuthorizationCredentials | None,
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


def get_current_user(
    database: Annotated[Database, Depends(get_database)],
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> UserDocument:
    return _resolve_credentials(database, credentials)


def get_document_uploader(
    reference_id: str,
    database: Annotated[Database, Depends(get_database)],
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    citizen_access_token: Annotated[
        str | None,
        Header(alias="X-Citizen-Access-Token"),
    ] = None,
) -> DocumentUploader:
    if credentials is not None:
        return DocumentUploader(actor=_resolve_credentials(database, credentials))
    if not citizen_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or citizen access token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        verify_citizen_access_token(database, reference_id, citizen_access_token)
    except InvalidCitizenAccessTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired citizen access token",
        ) from None
    except GrievanceNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance not found",
        ) from None
    return DocumentUploader(citizen_access_token=citizen_access_token)


def require_admin(
    current_user: Annotated[UserDocument, Depends(get_current_user)],
) -> UserDocument:
    if current_user.role is not UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return current_user
