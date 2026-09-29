"""Abstract base class for planner backends."""
from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel


class PlannerInput(BaseModel):
    """Input to the planner."""
    task: str
    sanitized_context: dict[str, Any]
    allowed_actions: list[str]
    privacy_metadata: dict[str, Any]
    step: int


class PlannerOutput(BaseModel):
    """Output from the planner."""
    action: dict[str, Any]
    reasoning: str
    confidence: float
    raw_response: str = ""


class PlannerBackend(ABC):
    """Abstract interface for planner backends."""

    @abstractmethod
    async def plan(self, input_data: PlannerInput) -> PlannerOutput:
        """Generate an action plan from the input."""
        pass

    @abstractmethod
    def get_backend_name(self) -> str:
        """Return the backend identifier."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the backend is healthy."""
        pass
