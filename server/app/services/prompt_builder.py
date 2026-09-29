"""Prompt builder for planner backends."""
from typing import Any
from app.schemas.context import SanitizedContext
from app.schemas.agent_request import AgentRequest
from app.config import get_settings
from app.services.training_prompt_adapter import TrainingCompatiblePromptAdapter


class PromptBuilder:
    """Builds prompts for different planner backends."""

    def __init__(self):
        self.settings = get_settings()

    def build_planner_prompt(self, request: AgentRequest) -> str:
        """Build the training-compatible prompt for the real planner adapter."""
        context_json = {
            "version": request.context.version,
            "request_id": request.context.request_id,
            "session_id": request.context.session_id,
            "url": request.context.url,
            "title": request.context.title,
            "elements": [
                {
                    "element_id": e.element_id,
                    "id": e.element_id,
                    "role": e.role,
                    "tag": e.tag,
                    "safe_label": e.safe_label,
                    "label": e.safe_label,
                    "is_interactive": e.is_interactive,
                    "interactive": e.is_interactive,
                    "is_visible": e.is_visible,
                    "visible": e.is_visible,
                    "sensitive": bool(e.pii_regions),
                    "pii_regions": [p.model_dump(mode="json") for p in e.pii_regions],
                }
                for e in request.context.elements[: self.settings.max_context_elements]
            ],
            "viewport": request.context.viewport.model_dump(mode="json"),
            "privacy": request.context.privacy.model_dump(mode="json"),
        }

        return TrainingCompatiblePromptAdapter.build_training_prompt(
            task=request.task,
            allowed_actions=request.allowed_actions,
            sanitized_context=context_json,
            step=request.step,
        )

    def build_vision_prompt(self, request: AgentRequest) -> list[dict[str, Any]]:
        """Build messages for vision-language models."""
        prompt = self.build_planner_prompt(request)
        return [
            {
                "role": "system",
                "content": "You are a browser automation agent. Output only valid JSON actions."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]


def create_prompt_builder() -> PromptBuilder:
    return PromptBuilder()