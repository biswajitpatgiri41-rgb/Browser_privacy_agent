"""LangGraph state definition."""
from typing import Any, Optional
from dataclasses import dataclass, field
from uuid import UUID

from app.schemas.context import SanitizedContext
from app.schemas.action import AgentAction
from app.schemas.agent_response import AgentResponse
from app.services.risk_classifier import RiskLevel


@dataclass
class PolicyResult:
    """Result of policy check."""
    passed: bool
    violations: list[str] = field(default_factory=list)
    safe_error: str = ""


@dataclass
class AgentState:
    """
    Typed state for LangGraph orchestration.

    Fields:
    - request_id: Unique request identifier
    - session_id: Session identifier
    - task: User task description
    - sanitized_context: Parsed and validated context
    - ui_state: Current UI state snapshot
    - policy_result: Result of deterministic policy check
    - planner_output: Raw planner output
    - validated_action: Action after validation pipeline
    - risk: Classified risk level
    - done: Whether graph execution is complete
    - error: Error message if any
    - iteration: Current iteration count
    """
    request_id: str
    session_id: str
    task: str
    sanitized_context: SanitizedContext
    ui_state: dict[str, Any] = field(default_factory=dict)
    policy_result: Optional[PolicyResult] = None
    planner_output: Optional[dict[str, Any]] = None
    validated_action: Optional[AgentAction] = None
    risk: Optional[RiskLevel] = None
    done: bool = False
    error: Optional[str] = None
    iteration: int = 0


# Type alias for LangGraph
AgentStateDict = dict[str, Any]


def state_to_dict(state: AgentState) -> AgentStateDict:
    """Convert AgentState to dict for LangGraph."""
    return {
        "request_id": state.request_id,
        "session_id": state.session_id,
        "task": state.task,
        "sanitized_context": state.sanitized_context,
        "ui_state": state.ui_state,
        "policy_result": state.policy_result,
        "planner_output": state.planner_output,
        "validated_action": state.validated_action,
        "risk": state.risk,
        "done": state.done,
        "error": state.error,
        "iteration": state.iteration,
    }


def dict_to_state(data: AgentStateDict) -> AgentState:
    """Convert dict to AgentState."""
    return AgentState(
        request_id=data["request_id"],
        session_id=data["session_id"],
        task=data["task"],
        sanitized_context=data["sanitized_context"],
        ui_state=data.get("ui_state", {}),
        policy_result=data.get("policy_result"),
        planner_output=data.get("planner_output"),
        validated_action=data.get("validated_action"),
        risk=data.get("risk"),
        done=data.get("done", False),
        error=data.get("error"),
        iteration=data.get("iteration", 0),
    )