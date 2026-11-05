from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from pymongo.database import Database

from app.api.dependencies import get_database
from app.models.enums import GrievanceStatus, Priority
from app.models.grievance import DocumentMetadata, GrievanceDocument
from app.schemas.grievance import (
    GrievanceCreateRequest,
    GrievanceListResponse,
    GrievanceResponse,
    GrievanceReviewRequest,
    GrievanceStatusUpdateRequest,
)
from app.services.grievance_management import (
    MAX_PAGE_SIZE,
    GrievanceNotFoundError,
    InvalidDepartmentError,
    InvalidStatusTransitionError,
    ReferenceIdConflictError,
    create_grievance,
    get_grievance_by_reference,
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
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Grievance not found",
    )


@router.post(
    "",
    response_model=GrievanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_grievance(
    request: GrievanceCreateRequest,
    database: Annotated[Database, Depends(get_database)],
) -> GrievanceDocument:
    try:
        return create_grievance(database, request)
    except ReferenceIdConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not allocate a unique grievance reference",
        ) from None


@router.get("", response_model=GrievanceListResponse)
def list_grievances(
    database: Annotated[Database, Depends(get_database)],
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
) -> GrievanceDocument:
    try:
        return get_grievance_by_reference(database, reference_id)
    except GrievanceNotFoundError:
        raise _not_found() from None


@router.patch(
    "/{reference_id}/review",
    response_model=GrievanceResponse,
)
def review_grievance_endpoint(
    request: GrievanceReviewRequest,
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
) -> GrievanceDocument:
    try:
        return review_grievance(database, reference_id, request)
    except GrievanceNotFoundError:
        raise _not_found() from None
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
) -> GrievanceDocument:
    try:
        return update_grievance_status(database, reference_id, request)
    except GrievanceNotFoundError:
        raise _not_found() from None
    except InvalidStatusTransitionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Status transition is not allowed",
        ) from None


@router.post(
    "/{reference_id}/documents",
    response_model=DocumentMetadata,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    reference_id: ReferenceId,
    database: Annotated[Database, Depends(get_database)],
    file: UploadFile = File(...),
) -> DocumentMetadata:
    content = await file.read(5 * 1024 * 1024 + 1)
    try:
        return upload_supporting_document(
            database,
            reference_id,
            filename=file.filename,
            content_type=file.content_type,
            content=content,
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
