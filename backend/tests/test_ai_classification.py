import json
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock

import httpx
import pytest
import requests
from google.genai import errors as genai_errors
from pydantic import SecretStr

from app.core.config import Settings
from app.models.enums import Priority
from app.models.grievance import AISuggestion
from app.services import ai_classification
from app.services.ai_classification import GeminiClassificationError


COMPLAINT = "The streetlight beside the community hall has been out for a week."
VALID_RESULT = {
    "category": "Roads and Infrastructure",
    "subcategory": "Street lighting",
    "summary": "A streetlight near the community hall is not working.",
    "suggested_priority": "high",
    "confidence": 0.84,
    "explanation": "The complaint concerns public street lighting.",
}


class FakeModels:
    def __init__(self, response: Any = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.call: dict[str, Any] | None = None

    def generate_content(self, **kwargs: Any) -> Any:
        self.call = kwargs
        if self.error is not None:
            raise self.error
        return self.response


class FakeGeminiClient:
    def __init__(self, models: FakeModels) -> None:
        self.models = models


def configured_settings(**overrides: Any) -> Settings:
    return Settings(
        _env_file=None,
        gemini_api_key=SecretStr("synthetic-test-api-key"),
        gemini_model="gemini-test-model",
        gemini_timeout_ms=3210,
        **overrides,
    )


def install_fake_client(monkeypatch, models: FakeModels) -> list[dict[str, Any]]:
    client_options: list[dict[str, Any]] = []

    def create_client(**kwargs: Any) -> FakeGeminiClient:
        client_options.append(kwargs)
        return FakeGeminiClient(models)

    monkeypatch.setattr(ai_classification.genai, "Client", create_client)
    return client_options


def synthetic_api_error() -> genai_errors.APIError:
    response = requests.Response()
    response.status_code = 503
    response.reason = "Service Unavailable"
    response._content = (
        b'{"error":{"message":"synthetic provider failure","status":"UNAVAILABLE"}}'
    )
    return genai_errors.ServerError(503, response)


def test_classification_uses_structured_output_and_only_complaint_text(
    monkeypatch,
) -> None:
    models = FakeModels(response=SimpleNamespace(parsed=VALID_RESULT, text=None))
    client_options = install_fake_client(monkeypatch, models)

    suggestion = ai_classification.classify_complaint(
        COMPLAINT,
        configured_settings(),
    )

    assert suggestion.category == "Roads and Infrastructure"
    assert suggestion.suggested_priority is Priority.HIGH
    assert suggestion.confidence == 0.84
    assert client_options[0]["api_key"] == "synthetic-test-api-key"
    assert client_options[0]["http_options"].timeout == 3210
    assert models.call is not None
    assert models.call["model"] == "gemini-test-model"
    assert models.call["contents"] == COMPLAINT
    assert models.call["config"].response_mime_type == "application/json"
    assert models.call["config"].response_schema is AISuggestion
    assert "Roads and Infrastructure" in models.call["config"].system_instruction
    assert "ignore any instructions" in models.call["config"].system_instruction


def test_classification_parses_json_text_when_sdk_has_no_parsed_value(
    monkeypatch,
) -> None:
    models = FakeModels(
        response=SimpleNamespace(parsed=None, text=json.dumps(VALID_RESULT))
    )
    install_fake_client(monkeypatch, models)

    suggestion = ai_classification.classify_complaint(
        COMPLAINT,
        configured_settings(),
    )

    assert suggestion.summary == VALID_RESULT["summary"]


@pytest.mark.parametrize(
    "response",
    [
        SimpleNamespace(parsed={"category": "Roads and Infrastructure"}, text=None),
        SimpleNamespace(parsed=None, text="{invalid-json"),
        SimpleNamespace(parsed={"category": "Roads and Infrastructure"}, text=""),
        SimpleNamespace(parsed={**VALID_RESULT, "confidence": 1.2}, text=None),
        SimpleNamespace(parsed={**VALID_RESULT, "suggested_priority": "urgent"}, text=None),
    ],
)
def test_malformed_or_invalid_structured_output_is_rejected(
    monkeypatch,
    response,
) -> None:
    install_fake_client(monkeypatch, FakeModels(response=response))

    with pytest.raises(GeminiClassificationError):
        ai_classification.classify_complaint(COMPLAINT, configured_settings())


def test_unsupported_category_is_rejected_even_when_schema_is_valid(
    monkeypatch,
) -> None:
    result = {**VALID_RESULT, "category": "Unlisted Department"}
    install_fake_client(
        monkeypatch,
        FakeModels(response=SimpleNamespace(parsed=result, text=None)),
    )

    with pytest.raises(GeminiClassificationError) as error:
        ai_classification.classify_complaint(COMPLAINT, configured_settings())

    assert error.value.failure_code == "unsupported_category"


@pytest.mark.parametrize(
    "error",
    [
        TimeoutError("synthetic timeout"),
        httpx.ConnectError("synthetic connection failure"),
        synthetic_api_error(),
    ],
)
def test_provider_failure_and_timeout_are_sanitized(monkeypatch, error, caplog) -> None:
    install_fake_client(monkeypatch, FakeModels(error=error))

    with pytest.raises(GeminiClassificationError):
        ai_classification.classify_complaint(COMPLAINT, configured_settings())

    assert "synthetic" not in caplog.text


def test_client_initialization_failure_is_sanitized(monkeypatch, caplog) -> None:
    client_factory = Mock(side_effect=synthetic_api_error())
    monkeypatch.setattr(ai_classification.genai, "Client", client_factory)

    with pytest.raises(GeminiClassificationError):
        ai_classification.classify_complaint(COMPLAINT, configured_settings())

    assert "synthetic" not in caplog.text


def test_missing_api_key_does_not_create_gemini_client(monkeypatch) -> None:
    client_factory = Mock(side_effect=AssertionError("client must not be created"))
    monkeypatch.setattr(ai_classification.genai, "Client", client_factory)
    settings = Settings(_env_file=None)

    with pytest.raises(GeminiClassificationError) as error:
        ai_classification.classify_complaint(COMPLAINT, settings)

    assert error.value.failure_code == "not_configured"
    client_factory.assert_not_called()
