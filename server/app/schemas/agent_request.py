"""Agent request schema."""
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from .context import SanitizedContext


class AgentRequest(BaseModel):
    """Request to the agent planning endpoint."""
    version: Literal["1.0.0"] = "1.0.0"
    request_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    session_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    task: str = Field(min_length=1, max_length=2000, description="User task instruction")
    context: SanitizedContext
    step: int = Field(ge=1, description="Step number in session")
    allowed_actions: list[str] = Field(default_factory=lambda: ["click", "scroll", "select", "navigate", "wait", "finish"])

    @field_validator("context")
    @classmethod
    def validate_context_privacy(cls, v: SanitizedContext) -> SanitizedContext:
        if not v.privacy.verified:
            raise ValueError("privacy.verified must be true in context")
        return v

    model_config = {
        "extra": "forbid",
    }
