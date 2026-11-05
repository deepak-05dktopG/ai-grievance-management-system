"""Grievance API routes; run the API from backend with: python -m uvicorn app.main:app --reload."""
# API prefix: /api/v1/grievances; use the route paths below for feature requests.

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from pymongo.database import Database

from app.api.auth_dependencies import DocumentUploader, get_current_user, get_document_uploader
from app.api.dependencies import get_database
from app.models.enums import GrievanceStatus, Priority, UserRole
from app.models.grievance import DocumentMetadata, GrievanceDocument
from app.models.user import UserDocument
from app.schemas.grievance import (
    AuditLogResponse,
    GrievanceCreateRequest,
    GrievanceListResponse,
    GrievanceResponse,
    GrievanceReviewRequest,
    GrievanceSubmissionResponse,
    GrievanceStatusUpdateRequest,
    GrievanceTrackingResponse,
)
from app.services.grievance_management import (
    MAX_PAGE_SIZE,
    GrievanceAccessDeniedError,
    GrievanceNotFoundError,
    InvalidCitizenAccessTokenError,
    InvalidDepartmentError,
    InvalidStatusTransitionError,
    ReferenceIdConflictError,
    create_grievance,
    get_grievance_by_reference,
    get_citizen_tracking,
    list_grievance_audit_logs,
    list_grievance_page,
    review_grievance,
    update_grievance_status,
)
from app.services.document_upload import (
    DocumentTooLargeError,
    DocumentUploadConfigurationError,
    DocumentUploadError,
    InvalidDocumentError,
    upload_supporting_document,
)


router = APIRouter(
    prefix="/api/v1/grievances",
    tags=["grievances"],
)

ReferenceId = Annotated[
    str,
    Path(
        min_length=25,
        max_length=25,
        pattern=r"^CFX-\d{8}-[A-F0-9]{12}$",
    ),
]


def _not_found() -> HTTPException:
    """Build the same non-identifying 404 response for missing case records."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Grievance not found",
    )


@router.post(
    "",
    response_model=GrievanceSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_grievance(
    request: GrievanceCreateRequest,
    database: Annotated[Database, Depends(get_database)],
) -> GrievanceSubmissionResponse:
    """Create and return a citizen grievance with its tracking credentials.

    Steps: validate the request, call the management service to classify and
    persist the case plus its audit record, then return the reference and the
    one-time citizen token. The service stores only the token hash; the plaintext
    token is exposed only in this initial response for later tracking/uploads.
    """
    try:
        grievance = create_grievance(database, request)
        response = grievance.model_dump(
            mode="json",
            by_alias=True,
            exclude_none=True,
        )
        response["citizen_access_token"] = grievance.citizen_access_token
        return GrievanceSubmissionResponse.model_validate(response)
    except ReferenceIdConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not allocate a unique grievance reference",
        ) from None


@router.get(
    "/{reference_id}/track",
    response_model=GrievanceTrackingResponse,
)
def track_grievance(
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
    citizen_access_token: Annotated[
        str,
        Header(alias="X-Citizen-Access-Token"),
    ],
) -> GrievanceTrackingResponse:
    """Return only permitted progress fields after validating the citizen token.

    Steps: take the reference from the URL, take the citizen token from its
    dedicated header, ask the service to verify token hash and expiry, then
    return the deliberately limited tracking response.
    """
    try:
        return get_citizen_tracking(database, reference_id, citizen_access_token)
    except GrievanceNotFoundError:
        raise _not_found() from None
    except InvalidCitizenAccessTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired citizen access token",
        ) from None


@router.get("", response_model=GrievanceListResponse)
def list_grievances(
    database: Annotated[Database, Depends(get_database)],
    current_user: Annotated[UserDocument, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1, le=1_000_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
    grievance_status: Annotated[
        GrievanceStatus | None,
        Query(alias="status"),
    ] = None,
    department: Annotated[
        str | None,
        Query(
            min_length=2,
            max_length=20,
            pattern=r"^[A-Za-z0-9_-]+$",
            description="Illustrative department code",
        ),
    ] = None,
    priority: Priority | None = None,
) -> GrievanceListResponse:
    """List a filtered page while constraining officers to their own department.

    Steps: authenticate the user, constrain officer queries to their assigned
    department (rejecting conflicting filters), pass validated pagination and
    optional filters to the service, then return the result page.
    """
    if current_user.role is UserRole.OFFICER:
        if current_user.department is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Officer department is not configured",
            )
        if (
            department is not None
            and department.upper() != current_user.department.code
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Grievances outside your department are not accessible",
            )
        department = current_user.department.code
    result = list_grievance_page(
        database,
        page=page,
        page_size=page_size,
        status=grievance_status,
        department=department.upper() if department is not None else None,
        priority=priority.value if priority is not None else None,
    )
    return GrievanceListResponse.model_validate(result)


@router.get("/{reference_id}", response_model=GrievanceResponse)
def get_grievance(
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
    current_user: Annotated[UserDocument, Depends(get_current_user)],
) -> GrievanceDocument:
    """Return one case after the service enforces role and department access.

    The route translates expected missing/forbidden outcomes into HTTP status
    codes; the service owns the database lookup and access decision.
    """
    try:
        return get_grievance_by_reference(database, reference_id, current_user)
    except GrievanceNotFoundError:
        raise _not_found() from None
    except GrievanceAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Grievance is outside your department",
        ) from None


@router.patch(
    "/{reference_id}/review",
    response_model=GrievanceResponse,
)
def review_grievance_endpoint(
    request: GrievanceReviewRequest,
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
    current_user: Annotated[UserDocument, Depends(get_current_user)],
) -> GrievanceDocument:
    """Save staff corrections in the approved fields without replacing AI output.

    Steps: authenticate staff, validate the correction body, delegate department
    and transaction checks to the service, then translate expected outcomes to
    HTTP responses. The original AI suggestion remains a separate record.
    """
    try:
        return review_grievance(database, reference_id, request, current_user)
    except GrievanceNotFoundError:
        raise _not_found() from None
    except GrievanceAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Grievance is outside your department",
        ) from None
    except InvalidDepartmentError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Department is not in the illustrative department configuration",
        ) from None


@router.patch(
    "/{reference_id}/status",
    response_model=GrievanceResponse,
)
def update_status(
    request: GrievanceStatusUpdateRequest,
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
    current_user: Annotated[UserDocument, Depends(get_current_user)],
) -> GrievanceDocument:
    """Apply a workflow transition through the service's allow-list and audit.

    Steps: authenticate staff, validate the requested enum, ask the service to
    check the transition table and atomically update plus audit, then return the
    updated case. A conflict means an illegal or concurrent transition; an
    unknown status is rejected earlier by request validation.
    """
    try:
        return update_grievance_status(database, reference_id, request, current_user)
    except GrievanceNotFoundError:
        raise _not_found() from None
    except GrievanceAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Grievance is outside your department",
        ) from None
    except InvalidStatusTransitionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Status transition is not allowed",
        ) from None


@router.get(
    "/{reference_id}/audit-logs",
    response_model=list[AuditLogResponse],
)
def grievance_audit_logs(
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
    current_user: Annotated[UserDocument, Depends(get_current_user)],
) -> list[AuditLogResponse]:
    """Return audit events only after the actor passes case access checks.

    The service loads the case, applies role/department rules, and reads its
    ordered audit records; this route exposes them through the response schema.
    """
    try:
        return list_grievance_audit_logs(database, reference_id, current_user)
    except GrievanceNotFoundError:
        raise _not_found() from None
    except GrievanceAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Grievance is outside your department",
        ) from None


@router.post(
    "/{reference_id}/documents",
    response_model=DocumentMetadata,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
    uploader: Annotated[DocumentUploader, Depends(get_document_uploader)],
    file: UploadFile = File(...),
) -> DocumentMetadata:
    """Read a bounded upload and delegate authorization and persistence.

    Steps: read no more than the maximum size plus one detection byte, pass the
    file and the dependency-resolved uploader identity to the upload service,
    then map validation, storage, and configuration failures to HTTP responses.
    The extra byte detects oversize input without buffering an unbounded upload.
    """
    content = await file.read(5 * 1024 * 1024 + 1)
    try:
        return upload_supporting_document(
            database,
            reference_id,
            filename=file.filename,
            content_type=file.content_type,
            content=content,
            actor=uploader.actor,
            citizen_access_token=uploader.citizen_access_token,
        )
    except DocumentTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 5 MB limit",
        ) from None
    except InvalidDocumentError:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only valid PDF, JPG, JPEG, and PNG files are allowed",
        ) from None
    except GrievanceNotFoundError:
        raise _not_found() from None
    except GrievanceAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Grievance is outside your department",
        ) from None
    except InvalidCitizenAccessTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired citizen access token",
        ) from None
    except DocumentUploadConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document storage is not configured",
        ) from None
    except DocumentUploadError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Document storage upload failed",
        ) from None
    finally:
        await file.close()
