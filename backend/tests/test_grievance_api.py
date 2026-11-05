from copy import deepcopy
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ConnectionFailure, DuplicateKeyError

import app.main as main
from app.api.dependencies import get_database
from app.core.config import Settings
from app.database.indexes import AUDIT_LOGS_COLLECTION, GRIEVANCES_COLLECTION


class MemoryCursor:
    def __init__(self, documents: list[dict[str, Any]]) -> None:
        self.documents = documents

    def sort(self, field: str, direction: int) -> "MemoryCursor":
        self.documents.sort(
            key=lambda document: _get_path(document, field) or "",
            reverse=direction < 0,
        )
        return self

    def skip(self, count: int) -> "MemoryCursor":
        self.documents = self.documents[count:]
        return self

    def limit(self, count: int) -> "MemoryCursor":
        self.documents = self.documents[:count]
        return self

    def __iter__(self):
        return iter(self.documents)


class MemoryCollection:
    def __init__(
        self,
        documents: list[dict[str, Any]],
        *,
        enforce_reference_unique: bool = False,
    ) -> None:
        self.documents = documents
        self.enforce_reference_unique = enforce_reference_unique
        self.duplicate_inserts = 0
        self.insert_error: Exception | None = None

    def insert_one(self, document: dict[str, Any], session: Any = None) -> None:
        if self.insert_error is not None:
            raise self.insert_error
        if self.duplicate_inserts:
            self.duplicate_inserts -= 1
            raise DuplicateKeyError("synthetic unique-index collision")
        if self.enforce_reference_unique and document.get("reference_id") and any(
            item.get("reference_id") == document["reference_id"]
            for item in self.documents
        ):
            raise DuplicateKeyError("duplicate reference ID")
        self.documents.append(deepcopy(document))

    def find_one(
        self,
        query: dict[str, Any],
        session: Any = None,
    ) -> dict[str, Any] | None:
        return next(
            (
                deepcopy(document)
                for document in self.documents
                if _matches(document, query)
            ),
            None,
        )

    def find(self, query: dict[str, Any]) -> MemoryCursor:
        return MemoryCursor(
            [
                deepcopy(document)
                for document in self.documents
                if _matches(document, query)
            ]
        )

    def count_documents(self, query: dict[str, Any]) -> int:
        return sum(_matches(document, query) for document in self.documents)

    def update_one(
        self,
        query: dict[str, Any],
        update: dict[str, Any],
        session: Any = None,
    ) -> Any:
        for document in self.documents:
            if _matches(document, query):
                document.update(deepcopy(update["$set"]))
                return type("UpdateResult", (), {"matched_count": 1})()
        return type("UpdateResult", (), {"matched_count": 0})()


def _get_path(document: dict[str, Any], path: str) -> Any:
    current: Any = document
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return _MISSING
        current = current[part]
    return current


_MISSING = object()


def _matches(document: dict[str, Any], query: dict[str, Any]) -> bool:
    for key, expected in query.items():
        if key == "$and":
            if not all(_matches(document, clause) for clause in expected):
                return False
            continue
        if key == "$or":
            if not any(_matches(document, clause) for clause in expected):
                return False
            continue

        actual = _get_path(document, key)
        if isinstance(expected, dict) and "$in" in expected:
            if actual not in expected["$in"] and not (
                actual is _MISSING and None in expected["$in"]
            ):
                return False
        elif isinstance(expected, dict) and "$exists" in expected:
            if (actual is not _MISSING) != expected["$exists"]:
                return False
        elif actual != expected:
            return False
    return True


class MemoryTransaction:
    def __init__(self, database: "MemoryDatabase") -> None:
        self.database = database
        self.snapshot: dict[str, list[dict[str, Any]]] = {}

    def __enter__(self) -> "MemoryTransaction":
        self.snapshot = {
            name: deepcopy(collection.documents)
            for name, collection in self.database.collections.items()
        }
        return self

    def __exit__(self, exception_type, exception, traceback) -> bool:
        if exception_type is not None:
            for name, documents in self.snapshot.items():
                self.database.collections[name].documents[:] = documents
        return False


class MemorySession:
    def __init__(self, database: "MemoryDatabase") -> None:
        self.database = database

    def __enter__(self) -> "MemorySession":
        return self

    def __exit__(self, exception_type, exception, traceback) -> bool:
        return False

    def start_transaction(self) -> MemoryTransaction:
        return MemoryTransaction(self.database)


class MemoryClient:
    def __init__(self, database: "MemoryDatabase") -> None:
        self.database = database

    def start_session(self) -> MemorySession:
        return MemorySession(self.database)


class MemoryDatabase:
    def __init__(self) -> None:
        self.collections = {
            GRIEVANCES_COLLECTION: MemoryCollection(
                [],
                enforce_reference_unique=True,
            ),
            AUDIT_LOGS_COLLECTION: MemoryCollection([]),
        }
        self.client = MemoryClient(self)

    def __getitem__(self, collection_name: str) -> MemoryCollection:
        return self.collections[collection_name]


@pytest.fixture
def api_client(monkeypatch):
    database = MemoryDatabase()
    monkeypatch.setattr(main, "get_settings", lambda: Settings(_env_file=None))
    main.app.dependency_overrides[get_database] = lambda: database
    with TestClient(main.app) as client:
        yield client, database
    main.app.dependency_overrides.clear()


def submission_payload(name: str = "Asha Sharma") -> dict[str, Any]:
    return {
        "citizen_details": {
            "full_name": name,
            "phone_number": "+91 98765 43210",
            "email": "asha@example.test",
        },
        "complaint_description": (
            "The streetlight near the community hall has been out for several days."
        ),
    }


def submit(client: TestClient, name: str = "Asha Sharma") -> dict[str, Any]:
    response = client.post("/api/v1/grievances", json=submission_payload(name))
    assert response.status_code == 201
    return response.json()


def test_submit_creates_grievance_and_audit_event(api_client) -> None:
    client, database = api_client

    response = client.post("/api/v1/grievances", json=submission_payload())

    assert response.status_code == 201
    grievance = response.json()
    assert grievance["reference_id"].startswith("CFX-")
    assert grievance["status"] == "SUBMITTED"
    assert grievance["ai_suggestion"] is None
    assert "_id" not in grievance
    assert database[GRIEVANCES_COLLECTION].documents[0]["reference_id"] == (
        grievance["reference_id"]
    )
    audit = database[AUDIT_LOGS_COLLECTION].documents[0]
    assert audit["action"] == "grievance.submitted"
    assert audit["actor"]["actor_type"] == "citizen"
    assert audit["new_values"] == {"status": "SUBMITTED"}


def test_duplicate_reference_collision_is_retried(api_client) -> None:
    client, database = api_client
    database[GRIEVANCES_COLLECTION].duplicate_inserts = 1

    response = client.post("/api/v1/grievances", json=submission_payload())

    assert response.status_code == 201
    assert len(database[GRIEVANCES_COLLECTION].documents) == 1
    assert len(database[AUDIT_LOGS_COLLECTION].documents) == 1


def test_audit_failure_rolls_back_grievance_creation(api_client) -> None:
    client, database = api_client
    database[AUDIT_LOGS_COLLECTION].insert_error = ConnectionFailure(
        "synthetic audit storage failure"
    )

    response = client.post("/api/v1/grievances", json=submission_payload())

    assert response.status_code == 503
    assert database[GRIEVANCES_COLLECTION].documents == []
    assert database[AUDIT_LOGS_COLLECTION].documents == []


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"citizen_details": {"full_name": "", "phone_number": "1234567"},
         "complaint_description": "A complaint description of sufficient length."},
        {**submission_payload(), "unexpected": True},
        {**submission_payload(), "complaint_description": "short"},
    ],
)
def test_submission_validation_errors_return_422(api_client, payload) -> None:
    client, _ = api_client

    response = client.post("/api/v1/grievances", json=payload)

    assert response.status_code == 422


def test_retrieve_grievance_by_reference_and_return_404(api_client) -> None:
    client, _ = api_client
    submitted = submit(client)

    response = client.get(f"/api/v1/grievances/{submitted['reference_id']}")
    missing = client.get("/api/v1/grievances/CFX-20260101-000000000000")

    assert response.status_code == 200
    assert response.json()["reference_id"] == submitted["reference_id"]
    assert "_id" not in response.json()
    assert missing.status_code == 404


def test_list_paginates_and_filters_by_status_department_and_priority(api_client) -> None:
    client, database = api_client
    first = submit(client, "Asha Sharma")
    second = submit(client, "Bina Patel")
    submit(client, "Chitra Rao")

    database[GRIEVANCES_COLLECTION].documents[0]["ai_suggestion"] = {
        "category": "Roads and Infrastructure",
        "subcategory": "Street lighting",
        "summary": "A streetlight is not working.",
        "suggested_priority": "high",
        "confidence": 0.8,
        "explanation": "The complaint concerns a streetlight.",
    }
    database[GRIEVANCES_COLLECTION].documents[0]["recommended_department"] = {
        "code": "PWD",
        "name": "Public Works",
    }
    database[GRIEVANCES_COLLECTION].documents[1]["status"] = "UNDER_REVIEW"
    database[GRIEVANCES_COLLECTION].documents[1]["officer_approved"] = {
        "priority": "medium",
        "department": {"code": "WSD", "name": "Water Supply"},
    }

    page = client.get("/api/v1/grievances?page=1&page_size=2")
    status_result = client.get("/api/v1/grievances?status=UNDER_REVIEW")
    department_result = client.get("/api/v1/grievances?department=WSD")
    priority_result = client.get("/api/v1/grievances?priority=medium")

    assert page.status_code == 200
    assert page.json()["total"] == 3
    assert page.json()["page"] == 1
    assert page.json()["page_size"] == 2
    assert page.json()["pages"] == 2
    assert len(page.json()["items"]) == 2
    assert status_result.json()["items"][0]["reference_id"] == second["reference_id"]
    assert department_result.json()["items"][0]["reference_id"] == second["reference_id"]
    assert priority_result.json()["items"][0]["reference_id"] == second["reference_id"]
    assert first["reference_id"] in {
        item["reference_id"] for item in client.get(
            "/api/v1/grievances?department=PWD&priority=high"
        ).json()["items"]
    }


@pytest.mark.parametrize(
    "query",
    [
        "?status=unknown",
        "?priority=urgent",
        "?department=not a code",
        "?page=0",
        "?page_size=101",
    ],
)
def test_list_rejects_invalid_filters_and_pagination(api_client, query) -> None:
    client, _ = api_client

    response = client.get(f"/api/v1/grievances{query}")

    assert response.status_code == 422


def test_review_preserves_ai_and_records_officer_changes(api_client) -> None:
    client, database = api_client
    submitted = submit(client)
    original_suggestion = {
        "category": "Roads and Infrastructure",
        "subcategory": "Street lighting",
        "summary": "A streetlight is not working.",
        "suggested_priority": "high",
        "confidence": 0.8,
        "explanation": "The complaint concerns a streetlight.",
    }
    stored = database[GRIEVANCES_COLLECTION].documents[0]
    stored["ai_suggestion"] = deepcopy(original_suggestion)
    stored["recommended_department"] = {"code": "PWD", "name": "Public Works"}

    response = client.patch(
        f"/api/v1/grievances/{submitted['reference_id']}/review",
        json={"category": "Water Supply", "priority": "medium"},
    )

    assert response.status_code == 200
    reviewed = response.json()
    assert reviewed["ai_suggestion"] == original_suggestion
    assert reviewed["officer_approved"]["category"] == "Water Supply"
    assert reviewed["officer_approved"]["priority"] == "medium"
    assert reviewed["officer_approved"]["department"] == {
        "code": "WSD",
        "name": "Water Supply",
    }
    audit = database[AUDIT_LOGS_COLLECTION].documents[-1]
    assert audit["action"] == "grievance.reviewed"
    assert audit["actor"]["actor_type"] == "officer"
    assert audit["previous_values"] == {
        "category": "Roads and Infrastructure",
        "subcategory": "Street lighting",
        "priority": "high",
        "department": {"code": "PWD", "name": "Public Works"},
    }
    assert audit["new_values"]["category"] == "Water Supply"


def test_review_can_use_only_configured_departments_and_validates_body(api_client) -> None:
    client, _ = api_client
    submitted = submit(client)
    endpoint = f"/api/v1/grievances/{submitted['reference_id']}/review"

    empty = client.patch(endpoint, json={})
    unknown_department = client.patch(
        endpoint,
        json={"department": {"code": "OTHER", "name": "Unknown"}},
    )
    invalid_priority = client.patch(endpoint, json={"priority": "urgent"})
    missing = client.patch(
        "/api/v1/grievances/CFX-20260101-000000000000/review",
        json={"priority": "high"},
    )

    assert empty.status_code == 422
    assert unknown_department.status_code == 422
    assert invalid_priority.status_code == 422
    assert missing.status_code == 404


def test_status_transition_validation_and_audit_events(api_client) -> None:
    client, database = api_client
    submitted = submit(client)
    endpoint = f"/api/v1/grievances/{submitted['reference_id']}/status"

    invalid = client.patch(endpoint, json={"status": "RESOLVED"})
    assert invalid.status_code == 409
    assert len(database[AUDIT_LOGS_COLLECTION].documents) == 1

    first = client.patch(endpoint, json={"status": "UNDER_REVIEW"})
    second = client.patch(endpoint, json={"status": "IN_PROGRESS"})
    invalid_value = client.patch(endpoint, json={"status": "UNKNOWN"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert invalid_value.status_code == 422
    status_events = [
        event
        for event in database[AUDIT_LOGS_COLLECTION].documents
        if event["action"] == "grievance.status_changed"
    ]
    assert len(status_events) == 2
    assert status_events[0]["previous_values"] == {"status": "SUBMITTED"}
    assert status_events[0]["new_values"] == {"status": "UNDER_REVIEW"}


def test_audit_failure_rolls_back_review_and_status_updates(api_client) -> None:
    client, database = api_client
    submitted = submit(client)
    reference_id = submitted["reference_id"]
    database[AUDIT_LOGS_COLLECTION].insert_error = ConnectionFailure(
        "synthetic audit storage failure"
    )

    review = client.patch(
        f"/api/v1/grievances/{reference_id}/review",
        json={"priority": "high"},
    )
    transition = client.patch(
        f"/api/v1/grievances/{reference_id}/status",
        json={"status": "UNDER_REVIEW"},
    )

    assert review.status_code == 503
    assert transition.status_code == 503
    stored = database[GRIEVANCES_COLLECTION].documents[0]
    assert "officer_approved" not in stored
    assert stored["status"] == "SUBMITTED"
    assert len(database[AUDIT_LOGS_COLLECTION].documents) == 1


def test_missing_database_and_mongodb_failures_are_sanitized(api_client) -> None:
    client, database = api_client
    database[GRIEVANCES_COLLECTION].insert_error = ConnectionFailure(
        "synthetic internal database diagnostic"
    )

    response = client.post("/api/v1/grievances", json=submission_payload())

    assert response.status_code == 503
    assert "synthetic internal database diagnostic" not in response.text
    main.app.dependency_overrides.clear()
    unavailable = client.get("/api/v1/grievances")
    assert unavailable.status_code == 503
    assert "Database is unavailable" in unavailable.text
