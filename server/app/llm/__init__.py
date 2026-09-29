"""LLM backends package."""
from .base import PlannerBackend, PlannerInput, PlannerOutput
from .api_backend import APIPlannerBackend
from .temporary_backend import TemporaryPlannerBackend

__all__ = [
    "PlannerBackend",
    "PlannerInput",
    "PlannerOutput",
    "APIPlannerBackend",
    "TemporaryPlannerBackend",
]

# Optional backends - import lazily to avoid heavy dependencies
try:
    from .transformers_backend import TransformersPlannerBackend
    __all__.append("TransformersPlannerBackend")
except ImportError:
    pass

try:
    from .vllm_backend import VLLMPlannerBackend
    __all__.append("VLLMPlannerBackend")
except ImportError:
    pass

try:
    from .qwen_vl import QwenVLPlannerBackend
    __all__.append("QwenVLPlannerBackend")
except ImportError:
    pass


def create_planner_backend(backend_name: str | None = None) -> PlannerBackend:
    """Factory function to create planner backend by name."""
    from app.config import get_settings

    if backend_name is None:
        settings = get_settings()
        backend_name = settings.planner_backend

    if backend_name.startswith("api"):
        return APIPlannerBackend()
    elif backend_name == "temporary":
        return TemporaryPlannerBackend()
    elif backend_name == "transformers":
        from .transformers_backend import TransformersPlannerBackend
        return TransformersPlannerBackend()
    elif backend_name == "vllm":
        from .vllm_backend import VLLMPlannerBackend
        return VLLMPlannerBackend()
    elif backend_name == "qwen_vl":
        from .qwen_vl import QwenVLPlannerBackend
        return QwenVLPlannerBackend()
    else:
        raise ValueError(f"Unknown planner backend: {backend_name}")