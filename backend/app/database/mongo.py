from pymongo import MongoClient

from app.core.config import Settings


def create_mongo_client(settings: Settings) -> MongoClient:
    if not settings.has_mongodb_configuration:
        raise ValueError("MongoDB configuration is incomplete")

    return MongoClient(
        settings.mongodb_uri.get_secret_value(),
        serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
        appname="creditfix-prototype",
    )


def ping_mongo(client: MongoClient) -> None:
    client.admin.command("ping")
