"""Generate public grievance reference IDs using a UTC date and random suffix."""
# Reference IDs are generated during API submission: python -m uvicorn app.main:app --reload.

from datetime import datetime, timezone
from secrets import token_hex


def generate_grievance_reference_id() -> str:
    """Create a public ID from a UTC date and a cryptographically random suffix.

    The database's unique index remains the final collision guard; callers can
    generate a replacement when an insert reports a duplicate.
    """
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = token_hex(6).upper()
    return f"CFX-{date_part}-{random_part}"
