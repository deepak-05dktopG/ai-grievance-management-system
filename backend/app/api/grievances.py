from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pymongo.database import Database

from app.api.dependencies import get_database
from app.models.enums import GrievanceStatus, Priority
from app.models.grievance import GrievanceDocument
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
