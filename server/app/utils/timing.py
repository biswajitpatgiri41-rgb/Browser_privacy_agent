"""Timing utilities."""
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Timer:
    """Simple timer for measuring durations."""
    name: str
    start_time: float = field(default_factory=time.perf_counter)
    end_time: float | None = None

    def stop(self) -> float:
        self.end_time = time.perf_counter()
        return self.elapsed()

    def elapsed(self) -> float:
        end = self.end_time or time.perf_counter()
        return end - self.start_time

    def __enter__(self) -> "Timer":
        return self

    def __exit__(self, *args: Any) -> None:
        self.stop()


@contextmanager
def timed(name: str) -> Timer:
    """Context manager for timing code blocks."""
    timer = Timer(name)
    try:
        yield timer
    finally:
        timer.stop()


class TimingMiddleware:
    """Middleware for tracking request timing."""

    def __init__(self):
        self.timings: dict[str, list[float]] = {}

    def record(self, operation: str, duration: float) -> None:
        if operation not in self.timings:
            self.timings[operation] = []
        self.timings[operation].append(duration)

    def get_stats(self, operation: str) -> dict[str, float] | None:
        timings = self.timings.get(operation, [])
        if not timings:
            return None
        return {
            "count": len(timings),
            "total": sum(timings),
            "avg": sum(timings) / len(timings),
            "min": min(timings),
            "max": max(timings)
        }

    def get_all_stats(self) -> dict[str, dict[str, float]]:
        return {op: self.get_stats(op) for op in self.timings}


timing_middleware = TimingMiddleware()