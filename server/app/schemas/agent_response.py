"""Agent response schema."""
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .action import AgentAction
from .context import PrivacyMetadata


class AgentResponse(BaseModel):
    """Response from the agent planning endpoint."""
    version: Literal["1.0.0"] = "1.0.0"
    request_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    session_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    action: AgentAction
    privacy: PrivacyMetadata
    requires_confirmation: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "extra": "forbid",
    }
