import json
import re
from datetime import datetime, timezone

import pytest
from bson import BSON, ObjectId
from pydantic import ValidationError

from app.database.indexes import ensure_grievance_indexes
from app.models.enums import GrievanceStatus, Priority
from app.models.grievance import (
    AISuggestion,
    DocumentMetadata,
    GrievanceDocument,
    OfficerApprovedValues,
)
from app.schemas.grievance import GrievanceCreateRequest, GrievanceResponse
from app.services.department_mapping import recommend_department
from app.services.reference_id import generate_grievance_reference_id


def valid_citizen() -> dict[str, str]:
    return {
        "full_name": "Asha Sharma",
        "phone_number": "+91 98765 43210",
        "email": "asha@example.test",
    }


def valid_grievance_data() -> dict[str, object]:
    return {
        "citizen_details": valid_citizen(),
        "complaint_description": "The streetlight near the community hall has been out for several days.",
    }


def test_grievance_request_and_document_validate_defaults() -> None:
    request = GrievanceCreateRequest(**valid_grievance_data())
    grievance = GrievanceDocument(**request.model_dump())

    assert grievance.status is GrievanceStatus.SUBMITTED
    assert grievance.ai_suggestion is None
    assert grievance.officer_approved is None
    assert grievance.supporting_documents == []
    assert grievance.created_at.tzinfo == timezone.utc
    assert grievance.updated_at.tzinfo == timezone.utc


@pytest.mark.parametrize(
    "data",
    [
        {"citizen_details": {"full_name": "", "phone_number": "1234567"}},
        {"citizen_details": {"full_name": "Asha", "phone_number": "abc12345"}},
        {"citizen_details": {**valid_citizen(), "email": "not-an-email"}},
        {**valid_grievance_data(), "complaint_description": "   "},
        {**valid_grievance_data(), "unexpected": "field"},
    ],
)
def test_invalid_grievance_request_is_rejected(data: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        GrievanceCreateRequest(**data)


def test_status_and_priority_values_are_enforced() -> None:
    valid = GrievanceDocument(
        **valid_grievance_data(),
        status=GrievanceStatus.IN_PROGRESS,
        ai_suggestion={
            "category": "Roads and Infrastructure",
            "subcategory": "Street lighting",
            "summary": "A streetlight is not working.",
            "suggested_priority": "high",
            "confidence": 0.8,
            "explanation": "The complaint concerns a public streetlight.",
        },
        officer_approved={"priority": "medium"},
    )

    assert valid.status is GrievanceStatus.IN_PROGRESS
    assert valid.ai_suggestion is not None
    assert valid.ai_suggestion.suggested_priority is Priority.HIGH
    assert valid.officer_approved is not None
    assert valid.officer_approved.priority is Priority.MEDIUM

    with pytest.raises(ValidationError):
        GrievanceDocument(**valid_grievance_data(), status="AWAITING_MAGIC")
    with pytest.raises(ValidationError):
        AISuggestion(
            category="Other",
            summary="Summary",
            suggested_priority="urgent",
            confidence=0.5,
            explanation="Explanation",
        )


@pytest.mark.parametrize("confidence", [-0.01, 1.01])
def test_ai_confidence_must_be_between_zero_and_one(confidence: float) -> None:
    with pytest.raises(ValidationError):
        AISuggestion(
            category="Public Health",
            summary="Summary",
            suggested_priority=Priority.MEDIUM,
            confidence=confidence,
            explanation="Explanation",
        )


def test_department_mapping_is_deterministic_and_unmapped_values_stay_unmapped() -> None:
    first = recommend_department(" Roads   and Infrastructure ")
    second = recommend_department("roads and infrastructure")

    assert first is not None
    assert second == first
    assert first.code == "PWD"
    assert first.name == "Public Works"
    assert recommend_department("Unmapped category") is None
    assert recommend_department(None) is None


def test_reference_id_is_human_readable_and_unique() -> None:
    first = generate_grievance_reference_id()
    second = generate_grievance_reference_id()

    assert re.fullmatch(r"CFX-\d{8}-[A-F0-9]{12}", first)
    assert re.fullmatch(r"CFX-\d{8}-[A-F0-9]{12}", second)
    assert first != second


def test_object_id_serializes_to_string_for_json_and_stays_object_id_for_mongo() -> None:
    object_id = ObjectId()
    grievance = GrievanceDocument(
        **valid_grievance_data(),
        _id=str(object_id),
        assigned_officer_id=str(ObjectId()),
    )

    mongo_document = grievance.model_dump(by_alias=True)
    json_document = json.loads(grievance.model_dump_json(by_alias=True))

    assert mongo_document["_id"] == object_id
    assert isinstance(mongo_document["_id"], ObjectId)
    BSON.encode(mongo_document)
    assert json_document["_id"] == str(object_id)
    assert isinstance(json_document["assigned_officer_id"], str)
    assert GrievanceResponse.model_validate(mongo_document).id == object_id
    assert GrievanceResponse.model_json_schema()["properties"]["_id"]["type"] == "string"

    with pytest.raises(ValidationError):
        GrievanceDocument(
            **valid_grievance_data(),
            _id="not-a-valid-object-id",
        )


def test_document_metadata_validates_url_and_utc_timestamp() -> None:
    uploaded_at = DocumentMetadata(
        original_filename="evidence.pdf",
        cloudinary_public_id="synthetic/evidence",
        secure_url="https://res.cloudinary.com/example/evidence.pdf",
        resource_type="raw",
        format="pdf",
        size_bytes=1024,
        uploaded_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
    )
    assert uploaded_at.uploaded_at.tzinfo == timezone.utc
    assert not hasattr(uploaded_at, "file_bytes")

    naive_timestamp = DocumentMetadata(
        original_filename="evidence.pdf",
        cloudinary_public_id="synthetic/evidence",
        secure_url="https://res.cloudinary.com/example/evidence.pdf",
        resource_type="raw",
        format="pdf",
        size_bytes=1024,
        uploaded_at=datetime(2026, 1, 1, 12),
    )
    assert naive_timestamp.uploaded_at.tzinfo == timezone.utc

    with pytest.raises(ValidationError):
        DocumentMetadata(
            original_filename="evidence.pdf",
            cloudinary_public_id="synthetic/evidence",
            secure_url="http://res.cloudinary.com/example/evidence.pdf",
            resource_type="raw",
            format="pdf",
            size_bytes=1024,
        )


class FakeIndexCollection:
    def __init__(self) -> None:
        self.created: list[tuple[list[tuple[str, int]], dict[str, object]]] = []

    def create_index(
        self,
        keys: list[tuple[str, int]],
        **options: object,
    ) -> str:
        self.created.append((keys, options))
        return str(options["name"])


class FakeIndexDatabase:
    def __init__(self) -> None:
        self.collection = FakeIndexCollection()

    def __getitem__(self, collection_name: str) -> FakeIndexCollection:
        assert collection_name == "grievances"
        return self.collection


def test_grievance_indexes_include_unique_reference_and_filter_indexes() -> None:
    database = FakeIndexDatabase()

    names = ensure_grievance_indexes(database)  # type: ignore[arg-type]

    assert names == [
        "uq_grievance_reference_id",
        "ix_grievance_status",
        "ix_grievance_recommended_department",
        "ix_grievance_created_at",
    ]
    assert database.collection.created[0][1]["unique"] is True
    assert database.collection.created[0][0] == [("reference_id", 1)]
    assert database.collection.created[1][0] == [("status", 1)]
    assert database.collection.created[2][0] == [("recommended_department.code", 1)]
    assert database.collection.created[3][0] == [("created_at", -1)]


def test_officer_approved_fields_remain_separate_from_ai_suggestions() -> None:
    grievance = GrievanceDocument(
        **valid_grievance_data(),
        ai_suggestion={
            "category": "Roads and Infrastructure",
            "subcategory": "Street lighting",
            "summary": "A streetlight is not working.",
            "suggested_priority": "high",
            "confidence": 0.8,
            "explanation": "The complaint concerns a public streetlight.",
        },
        recommended_department={
            "code": "PWD",
            "name": "Public Works",
        },
        officer_approved=OfficerApprovedValues(
            category="Electricity",
            priority=Priority.MEDIUM,
        ),
    )

    assert grievance.ai_suggestion is not None
    assert grievance.ai_suggestion.category == "Roads and Infrastructure"
    assert grievance.ai_suggestion.suggested_priority is Priority.HIGH
    assert grievance.officer_approved is not None
    assert grievance.officer_approved.category == "Electricity"
    assert grievance.officer_approved.priority is Priority.MEDIUM
