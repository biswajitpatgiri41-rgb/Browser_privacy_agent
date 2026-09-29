"""Health check endpoint."""
import time
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings
from app.llm import create_planner_backend
from app.utils.timing import timing_middleware

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    backend: str
    backend_healthy: bool
    model_loaded: bool = False
    uptime_seconds: float

    model_config = {"protected_namespaces": ()}


class ReadinessResponse(BaseModel):
    ready: bool
    model_loaded: bool = False
    checks: dict[str, bool]

    model_config = {"protected_namespaces": ()}


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    settings = get_settings()
    backend = create_planner_backend()
    backend_healthy = await backend.health_check()
    model_loaded = bool(getattr(backend, "model_loaded", False))

    return HealthResponse(
        status="healthy" if backend_healthy else "degraded",
        version="1.0.0",
        backend=backend.get_backend_name(),
        backend_healthy=backend_healthy,
        model_loaded=model_loaded,
        uptime_seconds=time.time() - START_TIME
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check():
    """Readiness check endpoint."""
    settings = get_settings()
    backend = create_planner_backend()
    backend_healthy = await backend.health_check()
    model_loaded = bool(getattr(backend, "model_loaded", False))

    checks = {
        "backend": backend_healthy,
        "config": True,
        "model_loaded": model_loaded,
    }

    return ReadinessResponse(
        ready=backend_healthy and checks["config"],
        model_loaded=model_loaded,
        checks=checks
    )


@router.get("/metrics/timing")
async def timing_metrics():
    """Get timing statistics."""
    return timing_middleware.get_all_stats()


# Track startup time
START_TIME = time.time()