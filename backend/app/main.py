import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.api.health import router as health_router
from app.core.config import get_settings
from app.database.mongo import create_mongo_client, ping_mongo


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.mongodb_client = None
    app.state.mongodb_database = None

    if not settings.has_mongodb_configuration:
        app.state.mongodb_status = "not_configured"
        logger.warning(
            "MongoDB is not configured",
            extra={"event": "mongodb_not_configured"},
        )
        yield
        return

    client: MongoClient | None = None
    try:
        client = create_mongo_client(settings)
        app.state.mongodb_client = client
        app.state.mongodb_database = client[settings.mongodb_db_name]
        ping_mongo(client)
    except (PyMongoError, ValueError) as exc:
        app.state.mongodb_status = "unavailable"
        logger.error(
            "MongoDB connection initialization failed",
            extra={
                "event": "mongodb_initialization_failed",
                "error_type": type(exc).__name__,
            },
        )
        if client is not None and isinstance(exc, ValueError):
            client.close()
            client = None
            app.state.mongodb_client = None
            app.state.mongodb_database = None
    else:
        app.state.mongodb_status = "connected"
        logger.info(
            "MongoDB connection initialized",
            extra={"event": "mongodb_connected"},
        )

    try:
        yield
    finally:
        if client is not None:
            client.close()
            logger.info(
                "MongoDB connection closed",
                extra={"event": "mongodb_disconnected"},
            )


app = FastAPI(title="Creditfix API", lifespan=lifespan)
app.include_router(health_router)