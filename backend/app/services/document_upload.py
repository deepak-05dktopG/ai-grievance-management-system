"""Document validation and Cloudinary persistence for grievance attachments."""
# Exercise through POST /api/v1/grievances/{reference_id}/documents on the running API.

import logging
from io import BytesIO
from pathlib import PurePosixPath
from uuid import uuid4

from cloudinary import uploader as cloudinary_uploader
from cloudinary.exceptions import Error as CloudinaryError
from pydantic import ValidationError
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.core.config import Settings, get_settings
from app.database.grievances import (
    append_supporting_document,
    get_grievance,
    insert_audit_log,
)
from app.models.audit import AuditActor, AuditLogDocument
from app.models.common import utc_now
from app.models.enums import UserRole
from app.models.grievance import DocumentMetadata, GrievanceDocument
from app.models.user import UserDocument
from app.services.grievance_management import (
    GrievanceAccessDeniedError,
    GrievanceNotFoundError,
    InvalidCitizenAccessTokenError,
    ensure_grievance_access,
    verify_citizen_access_token,
)


logger = logging.getLogger(__name__)
MAX_DOCUMENT_SIZE = 5 * 1024 * 1024
ALLOWED_FORMATS = {
    "pdf": ("application/pdf", b"%PDF-"),
    "jpg": ("image/jpeg", b"\xff\xd8\xff"),
    "jpeg": ("image/jpeg", b"\xff\xd8\xff"),
    "png": ("image/png", b"\x89PNG\r\n\x1a\n"),
}


class DocumentTooLargeError(Exception):
    """Raised when an attachment exceeds the configured byte limit."""


class InvalidDocumentError(Exception):
    """Raised when filename, extension, MIME type, or file signature is invalid."""


class DocumentUploadConfigurationError(Exception):
    """Raised when required Cloudinary settings are not configured."""


class DocumentUploadError(Exception):
    """Raised for a remote upload or returned metadata that cannot be trusted."""


def _validate_document(
    filename: str | None,
    content_type: str | None,
    content: bytes,
) -> tuple[str, str]:
    """Validate upload size, safe filename, extension, MIME type, and signature.

    Steps: reject oversize/empty input, reduce any client path to its basename,
    map the extension to an allowed type, then require both the declared MIME
    type and leading file signature to match before returning normalized values.
    """
    if len(content) > MAX_DOCUMENT_SIZE:
        raise DocumentTooLargeError

    if not filename:
        raise InvalidDocumentError
    clean_filename = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not clean_filename or len(clean_filename) > 255:
        raise InvalidDocumentError

    extension = PurePosixPath(clean_filename).suffix.lower().lstrip(".")
    file_type = ALLOWED_FORMATS.get(extension)
    if file_type is None or content_type is None:
        raise InvalidDocumentError

    expected_content_type, signature = file_type
    supplied_content_type = content_type.split(";", 1)[0].strip().lower()
    if (
        supplied_content_type != expected_content_type
        or not content.startswith(signature)
    ):
        raise InvalidDocumentError

    return clean_filename, extension


def _cloudinary_options(settings: Settings) -> dict[str, str]:
    """Build the provider options from settings without logging credential values."""
    return {
        "cloud_name": settings.cloudinary_cloud_name.strip(),
        "api_key": settings.cloudinary_api_key.get_secret_value().strip(),
        "api_secret": settings.cloudinary_api_secret.get_secret_value().strip(),
    }


def _delete_uploaded_asset(public_id: str, options: dict[str, str]) -> None:
    """Compensate for a failed database write by deleting the remote upload.

    This compensating action is used when Cloudinary accepted the file but
    metadata/audit persistence did not. Cleanup failures are logged as
    sanitized events and do not replace the original database error.
    """
    try:
        result = cloudinary_uploader.destroy(
            public_id,
            resource_type="raw",
            **options,
        )
    except CloudinaryError:
        logger.error(
            "Cloudinary cleanup failed after document persistence failure",
            extra={"event": "cloudinary_document_cleanup_failed"},
        )
        return
    if not isinstance(result, dict) or result.get("result") != "ok":
        logger.error(
            "Cloudinary cleanup did not confirm asset deletion",
            extra={"event": "cloudinary_document_cleanup_unconfirmed"},
        )


def upload_supporting_document(
    database: Database,
    reference_id: str,
    *,
    filename: str | None,
    content_type: str | None,
    content: bytes,
    actor: UserDocument | None,
    citizen_access_token: str | None,
) -> DocumentMetadata:
    """Validate access, upload bytes, and persist metadata plus an audit event.

    Steps: validate file bytes, authorize the citizen token or staff department,
    check Cloudinary settings, upload under a random server-generated ID, and
    validate the provider's HTTPS metadata. Then transactionally append metadata
    and an audit event. If validation or the database transaction fails after
    upload, delete the remote asset to avoid an orphan.
    """
    clean_filename, file_format = _validate_document(filename, content_type, content)

    if actor is not None:
        grievance_document = get_grievance(database, reference_id)
        if grievance_document is None:
            raise GrievanceNotFoundError
        grievance = GrievanceDocument.model_validate(grievance_document)
        ensure_grievance_access(grievance, actor)
    elif citizen_access_token is not None:
        grievance = verify_citizen_access_token(
            database,
            reference_id,
            citizen_access_token,
        )
    else:
        raise InvalidCitizenAccessTokenError

    settings = get_settings()
    if not settings.has_cloudinary_configuration:
        raise DocumentUploadConfigurationError

    cloudinary_options = _cloudinary_options(settings)
    generated_name = uuid4().hex
    public_id = f"grievances/{reference_id}/documents/{generated_name}.{file_format}"
    try:
        upload_result = cloudinary_uploader.upload(
            BytesIO(content),
            public_id=public_id,
            resource_type="raw",
            access_mode="authenticated",
            overwrite=False,
            filename=f"{generated_name}.{file_format}",
            **cloudinary_options,
        )
    except CloudinaryError:
        logger.warning(
            "Cloudinary document upload failed",
            extra={"event": "cloudinary_document_upload_failed"},
        )
        raise DocumentUploadError from None

    uploaded_public_id = (
        upload_result.get("public_id")
        if isinstance(upload_result, dict)
        else None
    )
    # Accept only the exact generated identifier so an unexpected provider
    # response cannot cause metadata to point at a different asset.
    if not isinstance(uploaded_public_id, str) or uploaded_public_id != public_id:
        logger.error(
            "Cloudinary returned an invalid generated document identifier",
            extra={"event": "cloudinary_document_response_invalid"},
        )
        if isinstance(uploaded_public_id, str) and uploaded_public_id:
            _delete_uploaded_asset(uploaded_public_id, cloudinary_options)
        raise DocumentUploadError

    # Validate provider-returned metadata before writing any database reference.
    try:
        metadata = DocumentMetadata(
            original_filename=clean_filename,
            cloudinary_public_id=uploaded_public_id,
            secure_url=upload_result.get("secure_url", ""),
            resource_type="raw",
            format=file_format,
            size_bytes=len(content),
            uploaded_at=utc_now(),
        )
    except ValidationError:
        logger.error(
            "Cloudinary returned invalid document metadata",
            extra={"event": "cloudinary_document_response_invalid"},
        )
        _delete_uploaded_asset(uploaded_public_id, cloudinary_options)
        raise DocumentUploadError from None

    try:
        with database.client.start_session() as session:
            with session.start_transaction():
                result = append_supporting_document(
                    database,
                    reference_id,
                    metadata.model_dump(mode="python"),
                    updated_at=utc_now(),
                    session=session,
                )
                if result.matched_count != 1:
                    raise GrievanceNotFoundError

                audit = AuditLogDocument(
                    grievance_id=grievance.id,
                    reference_id=reference_id,
                    action="grievance.document_uploaded",
                    actor=AuditActor(
                        actor_type="citizen" if actor is None else (
                            "admin" if actor.role is UserRole.ADMIN else "officer"
                        ),
                        actor_id=actor.id if actor is not None else None,
                    ),
                    new_values={
                        "cloudinary_public_id": metadata.cloudinary_public_id,
                        "format": metadata.format,
                        "size_bytes": metadata.size_bytes,
                    },
                )
                insert_audit_log(
                    database,
                    audit.model_dump(
                        by_alias=True,
                        mode="python",
                        exclude_none=True,
                    ),
                    session,
                )
    except (GrievanceNotFoundError, PyMongoError):
        _delete_uploaded_asset(uploaded_public_id, cloudinary_options)
        raise

    return metadata
