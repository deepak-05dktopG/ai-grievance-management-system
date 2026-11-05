"""Grievance lifecycle, citizen access, routing, review, status, and audit services."""
# Exercise through the grievance API: python -m uvicorn app.main:app --reload (from backend).

import logging
import math
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.database.grievances import (
    get_grievance,
    get_audit_logs,
    insert_audit_log,
    insert_grievance,
    list_grievances,
    update_grievance,
)
from app.models.audit import AuditActor, AuditLogDocument
from app.models.common import utc_now
from app.models.enums import AIProcessingStatus, GrievanceStatus, UserRole
from app.models.grievance import GrievanceDocument, OfficerApprovedValues
from app.models.user import UserDocument
from app.schemas.grievance import (
    AuditLogResponse,
    GrievanceTrackingResponse,
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
    ClassificationProviderError,
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
    """Raised after unique-reference collisions exhaust the retry limit."""


class GrievanceNotFoundError(Exception):
    """Raised when no grievance matches the requested public reference."""


class InvalidStatusTransitionError(Exception):
    """Raised when a requested state change is illegal or loses a race."""


class InvalidDepartmentError(Exception):
    """Raised when a staff correction selects an unconfigured department."""


class GrievanceAccessDeniedError(Exception):
    """Raised when a staff account is outside the case's effective department."""


class InvalidCitizenAccessTokenError(Exception):
    """Raised when citizen tracking credentials are invalid or expired."""


def ensure_grievance_access(
    grievance: GrievanceDocument,
    actor: UserDocument,
) -> None:
    """Require officers to match the currently effective case department.

    Steps: allow administrators, reject users who are not configured officers,
    choose the officer-approved department when present (otherwise the system
    recommendation), and compare its code to the officer's assigned code.
    """
    if actor.role is UserRole.ADMIN:
        return
    if actor.role is not UserRole.OFFICER or actor.department is None:
        raise GrievanceAccessDeniedError
    department = (
        grievance.officer_approved.department
        if grievance.officer_approved is not None
        and grievance.officer_approved.department is not None
        else grievance.recommended_department
    )
    if department is None or department.code != actor.department.code:
        raise GrievanceAccessDeniedError


def _insert_audit_event(
    database: Database,
    *,
    grievance: GrievanceDocument,
    action: Literal[
        "grievance.submitted",
        "grievance.reviewed",
        "grievance.status_changed",
    ],
    actor_type: Literal["citizen", "officer", "admin"],
    actor: UserDocument | None = None,
    new_values: dict[str, Any],
    previous_values: dict[str, Any] | None = None,
    session: Any,
) -> None:
    """Build and insert one audit record using the case transaction session."""
    audit = AuditLogDocument(
        grievance_id=grievance.id,
        reference_id=grievance.reference_id,
        action=action,
        actor=AuditActor(
            actor_type=actor_type,
            actor_id=actor.id if actor is not None else None,
        ),
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
    """Create a case, request advisory classification, and atomically audit it.

    Steps: build the case and one-time citizen credential, call classification,
    deterministically map its category, and mark low-confidence/unmapped or
    failed results for manual review. Then insert the case and submission audit
    in one Mongo transaction, retrying only public-reference collisions.
    """
    grievance = GrievanceDocument(**request.model_dump())
    citizen_access_token = secrets.token_urlsafe(32)
    # Keep the one-time plaintext token only on this response model; persist its
    # digest and expiry so a database read cannot reveal the issued credential.
    grievance.citizen_access_token = citizen_access_token
    grievance.citizen_access_token_hash = hashlib.sha256(
        citizen_access_token.encode("utf-8")
    ).hexdigest()
    grievance.citizen_access_token_expires_at = utc_now() + timedelta(days=30)
    settings = get_settings()
    try:
        suggestion = classify_complaint(grievance.complaint_description, settings)
    except ClassificationProviderError as exc:
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
        # A model suggestion is complete only when confidence clears the
        # configured threshold and deterministic routing found a department.
        if (
            grievance.recommended_department is not None
            and suggestion.confidence >= settings.groq_confidence_threshold
        ):
            grievance.ai_processing_status = AIProcessingStatus.COMPLETED
        else:
            grievance.ai_processing_status = AIProcessingStatus.MANUAL_REVIEW

    # Grievance creation and its submission audit event must commit together.
    for attempt in range(MAX_REFERENCE_ID_ATTEMPTS):
        session = database.client.start_session()
        try:
            with session:
                with session.start_transaction():
                    document = grievance.model_dump(
                        by_alias=True,
                        mode="python",
                        exclude_none=True,
                    )
                    document["citizen_access_token_hash"] = grievance.citizen_access_token_hash
                    document["citizen_access_token_expires_at"] = grievance.citizen_access_token_expires_at
                    insert_grievance(database, document, session)
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
            # Only a unique-reference collision is retryable; other database
            # failures propagate to the API's explicit database error handler.
            if attempt == MAX_REFERENCE_ID_ATTEMPTS - 1:
                logger.error(
                    "Grievance reference ID collision retry limit reached",
                    extra={"event": "grievance_reference_collision"},
                )
                raise ReferenceIdConflictError from None
            grievance.reference_id = generate_grievance_reference_id()
    raise ReferenceIdConflictError


def verify_citizen_access_token(
    database: Database,
    reference_id: str,
    token: str,
) -> GrievanceDocument:
    """Verify a grievance-scoped token digest and expiry before citizen access.

    Steps: find the case, hash the supplied token, compare digests safely, check
    that expiry is a datetime later than now, and validate the stored document.
    A naive database datetime is interpreted as UTC.
    """
    document = get_grievance(database, reference_id)
    if document is None:
        raise GrievanceNotFoundError
    expected_hash = document.get("citizen_access_token_hash")
    expires_at = document.get("citizen_access_token_expires_at")
    supplied_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if (
        not isinstance(expected_hash, str)
        or not secrets.compare_digest(expected_hash, supplied_hash)
        or not isinstance(expires_at, datetime)
        or expires_at <= utc_now()
    ):
        raise InvalidCitizenAccessTokenError
    return GrievanceDocument.model_validate(document)


def get_citizen_tracking(
    database: Database,
    reference_id: str,
    token: str,
) -> GrievanceTrackingResponse:
    """Build the small tracking response that a citizen is allowed to see.

    First validate the case-scoped access token, then expose status, AI-processing
    state, review indicator, and timestamps without returning citizen details,
    AI explanation, or internal assignment data.
    """
    grievance = verify_citizen_access_token(database, reference_id, token)
    return GrievanceTrackingResponse(
        reference_id=grievance.reference_id,
        status=grievance.status,
        ai_processing_status=grievance.ai_processing_status.value,
        officer_reviewed=grievance.officer_approved is not None,
        created_at=grievance.created_at,
        updated_at=grievance.updated_at,
    )


def list_grievance_audit_logs(
    database: Database,
    reference_id: str,
    actor: UserDocument,
) -> list[AuditLogResponse]:
    """Check case visibility and convert its stored audit entries to response models."""
    grievance = get_grievance_by_reference(database, reference_id, actor)
    return [
        AuditLogResponse.model_validate(document)
        for document in get_audit_logs(database, grievance.reference_id)
    ]


def get_grievance_by_reference(
    database: Database,
    reference_id: str,
    actor: UserDocument,
) -> GrievanceDocument:
    """Find a case by public reference, validate its model, then enforce access."""
    document = get_grievance(database, reference_id)
    if document is None:
        raise GrievanceNotFoundError
    grievance = GrievanceDocument.model_validate(document)
    ensure_grievance_access(grievance, actor)
    return grievance


def _effective_priority_query(priority: str) -> dict[str, Any]:
    """Build a Mongo predicate using approved priority before AI suggestion.

    A model suggestion is used for filtering only when no officer-approved
    priority exists, matching which value is effective in the user interface.
    """
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
    """Build a Mongo predicate using approved routing before recommendation.

    Cases with a staff correction match that department; unreviewed cases may
    match the deterministic recommendation instead.
    """
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
    """Apply optional filters and return a bounded page plus pagination metadata.

    Steps: add only supplied filters, query the matching count and requested
    slice, validate each Mongo document into a response model, and calculate
    page count. Filter predicates prefer approved values over AI suggestions.
    """
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
    actor: UserDocument,
) -> GrievanceDocument:
    """Save staff-approved values while preserving AI suggestions and audit history.

    Steps: open a transaction, load and authorize the case, merge only supplied
    corrections with prior approved values, validate any department against the
    fixed mapping, and persist the approved fields. Record before/after values
    in the same transaction, then return the reloaded case; AI fields are not
    overwritten.
    """
    session = database.client.start_session()
    with session:
        with session.start_transaction():
            document = get_grievance(database, reference_id, session=session)
            if document is None:
                raise GrievanceNotFoundError
            grievance = GrievanceDocument.model_validate(document)
            ensure_grievance_access(grievance, actor)
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
                # A changed category invalidates its old subcategory. Unless
                # staff explicitly supplies a department, route it deterministically.
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
            target_department = (
                approved.department
                if approved.department is not None
                else grievance.recommended_department
            )
            if (
                actor.role is UserRole.OFFICER
                and (
                    actor.department is None
                    or target_department is None
                    or target_department.code != actor.department.code
                )
            ):
                raise GrievanceAccessDeniedError
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
                actor_type=(
                    "admin" if actor.role is UserRole.ADMIN else "officer"
                ),
                actor=actor,
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
    actor: UserDocument,
) -> GrievanceDocument:
    """Enforce the workflow transition table and atomically record the change.

    Steps: open a transaction, load and authorize the case, check the transition
    table, update only if the stored old status still matches, write the audit
    event, and reload the case. The compare-and-set protects concurrent updates.
    """
    session = database.client.start_session()
    with session:
        with session.start_transaction():
            document = get_grievance(database, reference_id, session=session)
            if document is None:
                raise GrievanceNotFoundError
            grievance = GrievanceDocument.model_validate(document)
            ensure_grievance_access(grievance, actor)
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
                actor_type=(
                    "admin" if actor.role is UserRole.ADMIN else "officer"
                ),
                actor=actor,
                previous_values={"status": grievance.status.value},
                new_values={"status": request.status.value},
                session=session,
            )
            updated = get_grievance(database, reference_id, session=session)
            if updated is None:
                raise GrievanceNotFoundError
            return GrievanceDocument.model_validate(updated)
