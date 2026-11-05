"""FastAPI application setup; run from backend with: python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.core.config import get_settings
from app.database.indexes import (
    ensure_audit_indexes,
    ensure_grievance_indexes,
    ensure_user_indexes,
)
from app.database.mongo import create_mongo_client, ping_mongo
from app.api.grievances import router as grievances_router


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Own the MongoDB client's startup, readiness, and shutdown lifecycle.

    Startup reads settings, initializes app state, connects and pings MongoDB,
    and creates required indexes. If Mongo is unavailable, the API still starts
    in a degraded state so health checks can explain the dependency failure.
    The ``finally`` block closes any created client when the server stops.
    """
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
        ensure_grievance_indexes(app.state.mongodb_database)
        ensure_audit_indexes(app.state.mongodb_database)
        ensure_user_indexes(app.state.mongodb_database)
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


app = FastAPI(
    title="Creditfix API",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "grievances",
            "description": (
                "Grievance submission is public. Read, review, status, and "
                "document endpoints require authentication and department access."
            ),
        },
        {"name": "authentication", "description": "JWT login and user management."},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Citizen-Access-Token",
    ],
)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(grievances_router)


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Return FastAPI validation errors without reflecting submitted passwords.

    FastAPI's error objects can include the rejected input value. Remove that
    value specifically for password fields, then JSON-encode the remaining
    field locations and messages for the standard 422 response.
    """
    errors = exc.errors()
    for error in errors:
        if "password" in error.get("loc", ()):
            error.pop("input", None)
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(errors)},
    )


@app.exception_handler(PyMongoError)
async def handle_mongodb_error(
    request: Request,
    exc: PyMongoError,
) -> JSONResponse:
    """Log a sanitized database failure and return a stable 503 response.

    Keep the request path and exception class for operations, but never send
    the driver's potentially sensitive connection details to the client.
    """
    logger.error(
        "MongoDB request failed",
        extra={
            "event": "mongodb_request_failed",
            "path": request.url.path,
            "error_type": type(exc).__name__,
        },
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database operation failed"},
    )