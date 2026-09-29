"""Metrics endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

from app.utils.timing import timing_middleware

router = APIRouter(prefix="/api/v1", tags=["metrics"])


class MetricsResponse(BaseModel):
    requests_total: int = 0
    requests_success: int = 0
    requests_failed: int = 0
    avg_latency_ms: float = 0.0
    timing_stats: dict[str, Any] = {}


# In-memory metrics (replace with Prometheus in production)
_metrics = {
    "requests_total": 0,
    "requests_success": 0,
    "requests_failed": 0,
    "latencies": []
}


def record_request(success: bool, latency_ms: float) -> None:
    _metrics["requests_total"] += 1
    if success:
        _metrics["requests_success"] += 1
    else:
        _metrics["requests_failed"] += 1
    _metrics["latencies"].append(latency_ms)
    # Keep last 1000 latencies
    if len(_metrics["latencies"]) > 1000:
        _metrics["latencies"] = _metrics["latencies"][-1000:]


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """Get application metrics."""
    latencies = _metrics["latencies"]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

    return MetricsResponse(
        requests_total=_metrics["requests_total"],
        requests_success=_metrics["requests_success"],
        requests_failed=_metrics["requests_failed"],
        avg_latency_ms=avg_latency,
        timing_stats=timing_middleware.get_all_stats()
    )


@router.get("/metrics/prometheus")
async def get_prometheus_metrics():
    """Prometheus-format metrics."""
    lines = [
        f'requests_total {_metrics["requests_total"]}',
        f'requests_success_total {_metrics["requests_success"]}',
        f'requests_failed_total {_metrics["requests_failed"]}',
    ]
    latencies = _metrics["latencies"]
    if latencies:
        lines.append(f'request_latency_ms_sum {sum(latencies)}')
        lines.append(f'request_latency_ms_count {len(latencies)}')
    return "\n".join(lines) + "\n"