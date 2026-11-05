import logging
import math
from typing import Any, Literal

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.database.grievances import (
    get_grievance,
    insert_audit_log,
    insert_grievance,
    list_grievances,
    update_grievance,
)
from app.models.audit import AuditActor, AuditLogDocument
from app.models.common import utc_now
from app.models.enums import AIProcessingStatus, GrievanceStatus
from app.models.grievance import GrievanceDocument, OfficerApprovedValues
from app.schemas.grievance import (
    GrievanceCreateRequest,
    GrievanceResponse,
    GrievanceReviewRequest,
    GrievanceStatusUpdateRequest,
)
from app.services.department_mapping import (
    get_department_by_code,
    recommend_department,
)
from app.services.ai_classification import (
    GeminiClassificationError,
    classify_complaint,
)
from app.services.reference_id import generate_grievance_reference_id


logger = logging.getLogger(__name__)
MAX_REFERENCE_ID_ATTEMPTS = 3
MAX_PAGE_SIZE = 100

ALLOWED_STATUS_TRANSITIONS = {
    GrievanceStatus.SUBMITTED: {
        GrievanceStatus.UNDER_REVIEW,
        GrievanceStatus.REJECTED,
    },
    GrievanceStatus.UNDER_REVIEW: {
        GrievanceStatus.IN_PROGRESS,
        GrievanceStatus.REJECTED,
    },
    GrievanceStatus.IN_PROGRESS: {
        GrievanceStatus.RESOLVED,
        GrievanceStatus.REJECTED,
    },
    GrievanceStatus.RESOLVED: {
        GrievanceStatus.IN_PROGRESS,
        GrievanceStatus.CLOSED,
    },
    GrievanceStatus.REJECTED: {
        GrievanceStatus.UNDER_REVIEW,
        GrievanceStatus.CLOSED,
    },
    GrievanceStatus.CLOSED: set(),
}


class ReferenceIdConflictError(Exception):
    pass


class GrievanceNotFoundError(Exception):
    pass


class InvalidStatusTransitionError(Exception):
    pass


class InvalidDepartmentError(Exception):
    pass


def _insert_audit_event(
    database: Database,
    *,
    grievance: GrievanceDocument,
    action: Literal[
        "grievance.submitted",
        "grievance.reviewed",
        "grievance.status_changed",
    ],
    actor_type: Literal["citizen", "officer"],
    new_values: dict[str, Any],
    previous_values: dict[str, Any] | None = None,
    session: Any,
) -> None:
    audit = AuditLogDocument(
        grievance_id=grievance.id,
        reference_id=grievance.reference_id,
        action=action,
        actor=AuditActor(actor_type=actor_type),
        previous_values=previous_values,
        new_values=new_values,
    )
    insert_audit_log(
        database,
        audit.model_dump(by_alias=True, mode="python", exclude_none=True),
        session,
    )


def create_grievance(
    database: Database,
    request: GrievanceCreateRequest,
) -> GrievanceDocument:
    grievance = GrievanceDocument(**request.model_dump())
    settings = get_settings()
    try:
        suggestion = classify_complaint(grievance.complaint_description, settings)
    except GeminiClassificationError as exc:
        grievance.ai_processing_status = AIProcessingStatus.MANUAL_REVIEW
        logger.warning(
            "Grievance saved for manual review after classification failure",
            extra={
                "event": "grievance_classification_manual_review",
                "failure_code": exc.failure_code,
            },
        )
    else:
        grievance.ai_suggestion = suggestion
        grievance.recommended_department = recommend_department(
            suggestion.category
        )
        if (
            grievance.recommended_department is not None
            and suggestion.confidence >= settings.gemini_confidence_threshold
        ):
            grievance.ai_processing_status = AIProcessingStatus.COMPLETED
        else:
            grievance.ai_processing_status = AIProcessingStatus.MANUAL_REVIEW

    for attempt in range(MAX_REFERENCE_ID_ATTEMPTS):
        session = database.client.start_session()
        try:
            with session:
                with session.start_transaction():
                    insert_grievance(
                        database,
                        grievance.model_dump(
                            by_alias=True,
                            mode="python",
                            exclude_none=True,
                        ),
                        session,
                    )
                    _insert_audit_event(
                        database,
                        grievance=grievance,
                        action="grievance.submitted",
                        actor_type="citizen",
                        new_values={
                            "status": grievance.status.value,
                            "ai_processing_status": grievance.ai_processing_status.value,
                        },
                        session=session,
                    )
            return grievance
        except DuplicateKeyError:
            if attempt == MAX_REFERENCE_ID_ATTEMPTS - 1:
                logger.error(
                    "Grievance reference ID collision retry limit reached",
                    extra={"event": "grievance_reference_collision"},
                )
                raise ReferenceIdConflictError from None
            grievance.reference_id = generate_grievance_reference_id()
    raise ReferenceIdConflictError


def get_grievance_by_reference(
    database: Database,
    reference_id: str,
) -> GrievanceDocument:
    document = get_grievance(database, reference_id)
    if document is None:
        raise GrievanceNotFoundError
    return GrievanceDocument.model_validate(document)


def _effective_priority_query(priority: str) -> dict[str, Any]:
    return {
        "$or": [
            {"officer_approved.priority": priority},
            {
                "officer_approved.priority": {"$in": [None]},
                "ai_suggestion.suggested_priority": priority,
            },
        ]
    }


def _effective_department_query(department: str) -> dict[str, Any]:
    return {
        "$or": [
            {"officer_approved.department.code": department},
            {
                "officer_approved.department.code": {"$in": [None]},
                "recommended_department.code": department,
            },
        ]
    }


def list_grievance_page(
    database: Database,
    *,
    page: int,
    page_size: int,
    status: GrievanceStatus | None = None,
    department: str | None = None,
    priority: str | None = None,
) -> dict[str, Any]:
    clauses: list[dict[str, Any]] = []
    if status is not None:
        clauses.append({"status": status.value})
    if department is not None:
        clauses.append(_effective_department_query(department))
    if priority is not None:
        clauses.append(_effective_priority_query(priority))
    query: dict[str, Any] = {"$and": clauses} if clauses else {}

    documents, total = list_grievances(
        database,
        query,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    return {
        "items": [GrievanceResponse.model_validate(document) for document in documents],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }


def review_grievance(
    database: Database,
    reference_id: str,
    request: GrievanceReviewRequest,
) -> GrievanceDocument:
    session = database.client.start_session()
    with session:
        with session.start_transaction():
            document = get_grievance(database, reference_id, session=session)
            if document is None:
                raise GrievanceNotFoundError
            grievance = GrievanceDocument.model_validate(document)
            existing = grievance.officer_approved
            values = (
                existing.model_dump(mode="python")
                if existing is not None
                else {}
            )
            changes = request.model_dump(exclude_unset=True, mode="python")

            requested_department = changes.get("department")
            if requested_department is not None:
                canonical_department = get_department_by_code(
                    requested_department["code"]
                )
                if canonical_department is None:
                    raise InvalidDepartmentError
                changes["department"] = canonical_department
            elif "department" in request.model_fields_set:
                changes["department"] = None

            if "category" in changes:
                values["category"] = changes["category"]
                if "subcategory" not in changes:
                    values["subcategory"] = None
                if "department" not in request.model_fields_set:
                    mapped = recommend_department(changes["category"])
                    values["department"] = (
                        mapped.model_dump(mode="python") if mapped is not None else None
                    )
            if "subcategory" in changes:
                values["subcategory"] = changes["subcategory"]
            if "priority" in changes:
                values["priority"] = changes["priority"]
            if "department" in changes:
                department = changes["department"]
                values["department"] = (
                    department.model_dump(mode="python")
                    if department is not None
                    else None
                )

            approved = OfficerApprovedValues.model_validate(values)
            approved_data = approved.model_dump(mode="python", exclude_none=True)
            now = utc_now()
            result = update_grievance(
                database,
                reference_id,
                {"officer_approved": approved_data, "updated_at": now},
                session=session,
            )
            if result.matched_count == 0:
                raise GrievanceNotFoundError

            if existing is not None:
                previous_values = existing.model_dump(
                    mode="json",
                    exclude_none=True,
                )
            else:
                previous_values = {}
                if grievance.ai_suggestion is not None:
                    previous_values.update(
                        {
                            "category": grievance.ai_suggestion.category,
                            "subcategory": grievance.ai_suggestion.subcategory,
                            "priority": grievance.ai_suggestion.suggested_priority.value,
                        }
                    )
                if grievance.recommended_department is not None:
                    previous_values["department"] = (
                        grievance.recommended_department.model_dump(
                            mode="json",
                        )
                    )
            _insert_audit_event(
                database,
                grievance=grievance,
                action="grievance.reviewed",
                actor_type="officer",
                previous_values=previous_values,
                new_values=approved.model_dump(mode="json", exclude_none=True),
                session=session,
            )
            updated = get_grievance(database, reference_id, session=session)
            if updated is None:
                raise GrievanceNotFoundError
            return GrievanceDocument.model_validate(updated)


def update_grievance_status(
    database: Database,
    reference_id: str,
    request: GrievanceStatusUpdateRequest,
) -> GrievanceDocument:
    session = database.client.start_session()
    with session:
        with session.start_transaction():
            document = get_grievance(database, reference_id, session=session)
            if document is None:
                raise GrievanceNotFoundError
            grievance = GrievanceDocument.model_validate(document)
            if request.status not in ALLOWED_STATUS_TRANSITIONS[grievance.status]:
                raise InvalidStatusTransitionError

            now = utc_now()
            result = update_grievance(
                database,
                reference_id,
                {"status": request.status, "updated_at": now},
                session=session,
                expected_status=grievance.status,
            )
            if result.matched_count == 0:
                raise InvalidStatusTransitionError

            _insert_audit_event(
                database,
                grievance=grievance,
                action="grievance.status_changed",
                actor_type="officer",
                previous_values={"status": grievance.status.value},
                new_values={"status": request.status.value},
                session=session,
            )
            updated = get_grievance(database, reference_id, session=session)
            if updated is None:
                raise GrievanceNotFoundError
            return GrievanceDocument.model_validate(updated)
