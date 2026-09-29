"""Action planner service - coordinates planning pipeline."""
from typing import Any
from app.llm import PlannerBackend, PlannerInput, create_planner_backend
from app.services.prompt_builder import PromptBuilder, create_prompt_builder
from app.schemas.agent_request import AgentRequest
from app.schemas.context import SanitizedContext
from app.config import get_settings


class ActionPlanner:
    """Orchestrates the planning process with a pluggable backend."""

    def __init__(
        self,
        backend: PlannerBackend | None = None,
        prompt_builder: PromptBuilder | None = None
    ):
        self.backend = backend or create_planner_backend()
        self.prompt_builder = prompt_builder or create_prompt_builder()
        self.settings = get_settings()

    async def plan(self, request: AgentRequest) -> dict[str, Any]:
        """
        Generate an action plan from the request.
        Returns raw planner output for validation pipeline.
        """
        # Build planner input
        planner_input = PlannerInput(
            task=request.task,
            sanitized_context=request.context.model_dump(),
            allowed_actions=request.allowed_actions,
            privacy_metadata=request.context.privacy.model_dump(),
            step=request.step
        )

        # Get plan from backend
        planner_output = await self.backend.plan(planner_input)

        return {
            "action": planner_output.action,
            "reasoning": planner_output.reasoning,
            "confidence": planner_output.confidence,
            "raw_response": planner_output.raw_response,
            "backend": self.backend.get_backend_name()
        }

    async def health_check(self) -> bool:
        return await self.backend.health_check()


def create_action_planner(
    backend: PlannerBackend | None = None,
    prompt_builder: PromptBuilder | None = None
) -> ActionPlanner:
    return ActionPlanner(backend=backend, prompt_builder=prompt_builder)