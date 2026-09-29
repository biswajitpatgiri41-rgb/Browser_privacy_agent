"""Action schemas for agent actions."""
from enum import Enum
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator


class ActionType(str, Enum):
    """Allowed browser actions."""
    CLICK = "click"
    SCROLL = "scroll"
    SELECT = "select"
    NAVIGATE = "navigate"
    WAIT = "wait"
    FINISH = "finish"


class ScrollDirection(str, Enum):
    """Scroll direction."""
    UP = "up"
    DOWN = "down"
    LEFT = "left"
    RIGHT = "right"


class AgentAction(BaseModel):
    """Agent action with strict validation."""
    version: Literal["1.0.0"] = "1.0.0"
    action: ActionType
    element_id: Optional[str] = Field(
        default=None,
        pattern=r"^el_[a-zA-Z0-9]{8,}$",
        description="Target element ID from sanitized context"
    )
    value: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Value for select/input actions (sanitized, no secrets)"
    )
    url: Optional[str] = Field(
        default=None,
        description="Target URL for navigate action"
    )
    direction: Optional[ScrollDirection] = Field(
        default=None,
        description="Scroll direction"
    )
    amount: Optional[float] = Field(
        default=None,
        ge=0,
        le=10000,
        description="Scroll amount in pixels"
    )
    duration_ms: Optional[int] = Field(
        default=None,
        ge=0,
        le=30000,
        description="Wait duration in milliseconds"
    )
    confidence: float = Field(ge=0.0, le=1.0, description="Model confidence in this action")
    reasoning: str = Field(max_length=500, description="Brief reasoning for the action")
    metadata: Dict[str, Any] = Field(default_factory=dict, max_length=10)

    @field_validator("element_id")
    @classmethod
    def validate_element_id_required(cls, v: Optional[str], info) -> Optional[str]:
        action = info.data.get("action")
        if action in (ActionType.CLICK, ActionType.SELECT) and not v:
            raise ValueError(f"element_id required for {action}")
        if action == ActionType.FINISH and v:
            raise ValueError("element_id must not be provided for finish action")
        return v

    @field_validator("value")
    @classmethod
    def validate_value_required(cls, v: Optional[str], info) -> Optional[str]:
        action = info.data.get("action")
        if action == ActionType.SELECT and not v:
            raise ValueError("value required for select action")
        return v

    @field_validator("url")
    @classmethod
    def validate_url_required(cls, v: Optional[str], info) -> Optional[str]:
        action = info.data.get("action")
        if action == ActionType.NAVIGATE and not v:
            raise ValueError("url required for navigate action")
        return v

    @field_validator("direction")
    @classmethod
    def validate_direction_required(cls, v: Optional[ScrollDirection], info) -> Optional[ScrollDirection]:
        action = info.data.get("action")
        if action == ActionType.SCROLL and not v:
            raise ValueError("direction required for scroll action")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount_for_scroll(cls, v: Optional[float], info) -> Optional[float]:
        action = info.data.get("action")
        if action == ActionType.SCROLL and v is None:
            raise ValueError("amount required for scroll action")
        return v

    @field_validator("duration_ms")
    @classmethod
    def validate_duration_required(cls, v: Optional[int], info) -> Optional[int]:
        action = info.data.get("action")
        if action == ActionType.WAIT and v is None:
            raise ValueError("duration_ms required for wait action")
        return v

    model_config = {
        "extra": "forbid",
        "use_enum_values": True,
    }
