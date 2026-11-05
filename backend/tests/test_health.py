from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError
from pydantic import SecretStr

import app.main as main
from app.core.config import Settings
from app.database.indexes import GRIEVANCE_INDEXES, GRIEVANCES_COLLECTION


class FakeMongoAdmin:
    def __init__(self, *, fail_on_call: int | set[int] | None = None) -> None:
        self.calls = 0
        self.fail_on_call = fail_on_call

    def command(self, command: str) -> dict[str, int]:
        assert command == "ping"
        self.calls += 1
        failures = (
            {self.fail_on_call}
            if isinstance(self.fail_on_call, int)
            else self.fail_on_call
        )
        if failures is not None and self.calls in failures:
            raise ServerSelectionTimeoutError("synthetic connection failure")
        return {"ok": 1}


class FakeMongoClient:
    def __init__(self, *, fail_on_call: int | set[int] | None = None) -> None:
        self.admin = FakeMongoAdmin(fail_on_call=fail_on_call)
        self.database = FakeMongoDatabase()
        self.database_name: str | None = None
        self.closed = False

    def __getitem__(self, database_name: str) -> "FakeMongoDatabase":
        self.database_name = database_name
        return self.database

    def close(self) -> None:
        self.closed = True


class FakeMongoCollection:
    def __init__(self) -> None:
        self.created_indexes: list[tuple[list[tuple[str, int]], dict[str, object]]] = []

    def create_index(
        self,
        keys: list[tuple[str, int]],
        **options: object,
    ) -> str:
        self.created_indexes.append((keys, options))
        return str(options["name"])


class FakeMongoDatabase:
    def __init__(self) -> None:
        self.collection = FakeMongoCollection()

    def __getitem__(self, collection_name: str) -> FakeMongoCollection:
        assert collection_name == GRIEVANCES_COLLECTION
        return self.collection


@pytest.fixture
def client_factory(monkeypatch) -> Iterator[tuple[list[FakeMongoClient], TestClient]]:
    clients: list[FakeMongoClient] = []
    settings = Settings(
        _env_file=None,
        mongodb_uri=SecretStr("mongodb://synthetic.invalid"),
        mongodb_db_name="creditfix_test",
    )
    monkeypatch.setattr(main, "get_settings", lambda: settings)

    def make_client(
        uri: str,
        *,
        serverSelectionTimeoutMS: int,
        appname: str,
    ) -> FakeMongoClient:
        assert uri == "mongodb://synthetic.invalid"
        assert serverSelectionTimeoutMS == 5000
        assert appname == "creditfix-prototype"
        mongo_client = FakeMongoClient()
        clients.append(mongo_client)
        return mongo_client

    def create_client(configured: Settings) -> FakeMongoClient:
        return make_client(
            configured.mongodb_uri.get_secret_value(),
            serverSelectionTimeoutMS=configured.mongodb_server_selection_timeout_ms,
            appname="creditfix-prototype",
        )

    monkeypatch.setattr(main, "create_mongo_client", create_client)
    with TestClient(main.app) as test_client:
        yield clients, test_client
    assert all(mongo_client.closed for mongo_client in clients)


def test_settings_load_environment_values_as_secrets(monkeypatch) -> None:
    monkeypatch.setenv("MONGODB_URI", "mongodb://synthetic.invalid")
    monkeypatch.setenv("MONGODB_DB_NAME", "creditfix_test")

    settings = Settings(_env_file=None)

    assert settings.has_mongodb_configuration
    assert settings.mongodb_uri.get_secret_value() == "mongodb://synthetic.invalid"
    assert str(settings.mongodb_uri) == "**********"


def test_settings_load_dotenv_values(tmp_path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "MONGODB_URI=mongodb://synthetic.invalid\n"
        "MONGODB_DB_NAME=creditfix_test\n",
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert settings.has_mongodb_configuration
    assert settings.mongodb_uri.get_secret_value() == "mongodb://synthetic.invalid"
    assert settings.mongodb_db_name == "creditfix_test"


def test_health_reports_connected_when_ping_succeeds(client_factory) -> None:
    clients, client = client_factory

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "application": "ok",
        "database": "connected",
    }
    assert len(clients) == 1
    assert clients[0].admin.calls == 2
    assert clients[0].database_name == "creditfix_test"
    assert clients[0].database.collection.created_indexes == list(GRIEVANCE_INDEXES)


def test_health_reports_unconfigured_database(monkeypatch) -> None:
    settings = Settings(_env_file=None)
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    monkeypatch.setattr(
        main,
        "create_mongo_client",
        lambda _: pytest.fail("Mongo client must not be created without configuration"),
    )

    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "application": "ok",
        "database": "not_configured",
    }


def test_health_reports_startup_ping_failure_without_leaking_details(
    monkeypatch,
) -> None:
    settings = Settings(
        _env_file=None,
        mongodb_uri=SecretStr("mongodb://synthetic.invalid"),
        mongodb_db_name="creditfix_test",
    )
    fake_client = FakeMongoClient(fail_on_call={1, 2})
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    monkeypatch.setattr(main, "create_mongo_client", lambda _: fake_client)

    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "application": "ok",
        "database": "unavailable",
    }
    assert "synthetic connection failure" not in response.text
    assert fake_client.admin.calls == 2
    assert fake_client.closed


def test_health_reports_connectivity_loss_after_successful_startup(
    client_factory,
) -> None:
    clients, client = client_factory
    clients[0].admin.fail_on_call = 2

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"
    assert clients[0].admin.calls == 2
