"""API dependencies."""
from fastapi import Depends, Header, HTTPException
from typing import Optional
from uuid import UUID

from app.config import get_settings
from app.security import create_rate_limiter


async def get_request_id(x_request_id: Optional[str] = Header(None, alias="X-Request-ID")) -> str:
    """Extract or generate request ID."""
    if x_request_id:
        try:
            UUID(x_request_id)
            return x_request_id
        except ValueError:
            pass
    import uuid
    return str(uuid.uuid4())


async def get_session_id(x_session_id: Optional[str] = Header(None, alias="X-Session-ID")) -> Optional[str]:
    """Extract session ID."""
    if x_session_id:
        try:
            UUID(x_session_id)
            return x_session_id
        except ValueError:
            pass
    return None


# Rate limiter dependency
_rate_limiter = None

def get_rate_limiter():
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = create_rate_limiter()
    return _rate_limiter


# Settings dependency
def get_app_settings():
    return get_settings()