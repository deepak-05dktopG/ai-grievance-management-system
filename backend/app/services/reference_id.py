from datetime import datetime, timezone
from secrets import token_hex


def generate_grievance_reference_id() -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = token_hex(6).upper()
    return f"CFX-{date_part}-{random_part}"
