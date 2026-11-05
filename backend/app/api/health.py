"""Health endpoint; check it at http://127.0.0.1:8000/health while the API runs."""

import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.database.mongo import ping_mongo


logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=None)
def health_check(request: Request) -> dict[str, str] | JSONResponse:
    """Report API readiness and the latest MongoDB connectivity check.

    If no client was configured, return a degraded 503 immediately. Otherwise
    ping MongoDB, update the shared status used by startup state, and return
    either a healthy response or a sanitized degraded response.
    """
    client: Any = request.app.state.mongodb_client
    if client is None:
        database_status = request.app.state.mongodb_status
        logger.info(
            "Health check reports database unavailable",
            extra={"event": "health_check", "database_status": database_status},
        )
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "application": "ok",
                "database": database_status,
            },
        )

    try:
        ping_mongo(client)
    except PyMongoError as exc:
        logger.warning(
            "MongoDB health check failed",
            extra={
                "event": "mongodb_health_check_failed",
                "error_type": type(exc).__name__,
            },
        )
        request.app.state.mongodb_status = "unavailable"
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "application": "ok",
                "database": "unavailable",
            },
        )

    request.app.state.mongodb_status = "connected"
    return {
        "status": "ok",
        "application": "ok",
        "database": "connected",
    }
