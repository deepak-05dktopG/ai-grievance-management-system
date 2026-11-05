"""Shared request dependencies for database access."""
# Run from backend: python -m uvicorn app.main:app --reload

from fastapi import HTTPException, Request, status
from pymongo.database import Database


def get_database(request: Request) -> Database:
    """Read the database handle created by FastAPI's startup lifespan.

    If startup could not configure or connect MongoDB, return an explicit 503
    instead of allowing a route to fail later with an attribute error.
    """
    database = getattr(request.app.state, "mongodb_database", None)
    if database is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        )
    return database
