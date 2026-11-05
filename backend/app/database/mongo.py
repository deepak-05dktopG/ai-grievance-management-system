"""Mongo client helpers; run the API from backend with: python -m uvicorn app.main:app --reload."""

from pymongo import MongoClient

from app.core.config import Settings


def create_mongo_client(settings: Settings) -> MongoClient:
    """Create the shared PyMongo client from validated backend settings.

    First reject incomplete Mongo configuration, then pass the protected URI,
    server-selection timeout, and application label to the driver.
    """
    if not settings.has_mongodb_configuration:
        raise ValueError("MongoDB configuration is incomplete")

    return MongoClient(
        settings.mongodb_uri.get_secret_value(),
        serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
        appname="creditfix-prototype",
    )


def ping_mongo(client: MongoClient) -> None:
    """Issue MongoDB's ping command so connectivity errors surface immediately."""
    client.admin.command("ping")
