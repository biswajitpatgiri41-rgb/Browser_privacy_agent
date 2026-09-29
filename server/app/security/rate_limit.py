"""Rate limiting."""
import time
from collections import defaultdict
from typing import Any
from dataclasses import dataclass

from app.config import get_settings


@dataclass
class RateLimitResult:
    allowed: bool
    remaining: int
    reset_time: float
    limit: int
    window_seconds: int


class RateLimiter:
    """In-memory rate limiter with sliding window."""

    def __init__(self):
        self.settings = get_settings()
        self.requests: dict[str, list[float]] = defaultdict(list)

    def check_limit(self, key: str) -> RateLimitResult:
        """Check if request is within rate limit."""
        now = time.time()
        window_start = now - self.settings.rate_limit_window_seconds

        # Clean old entries
        self.requests[key] = [t for t in self.requests[key] if t > window_start]

        current_count = len(self.requests[key])
        remaining = max(0, self.settings.rate_limit_requests - current_count)

        if current_count >= self.settings.rate_limit_requests:
            oldest = self.requests[key][0] if self.requests[key] else now
            reset_time = oldest + self.settings.rate_limit_window_seconds
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=reset_time,
                limit=self.settings.rate_limit_requests,
                window_seconds=self.settings.rate_limit_window_seconds
            )

        # Add current request
        self.requests[key].append(now)

        return RateLimitResult(
            allowed=True,
            remaining=remaining - 1,
            reset_time=now + self.settings.rate_limit_window_seconds,
            limit=self.settings.rate_limit_requests,
            window_seconds=self.settings.rate_limit_window_seconds
        )

    def get_client_key(self, request: Any, session_id: str | None = None) -> str:
        """Extract rate limit key from request."""
        # In production, use client IP or session
        if session_id:
            return f"session:{session_id}"
        return "default"


def create_rate_limiter() -> RateLimiter:
    return RateLimiter()