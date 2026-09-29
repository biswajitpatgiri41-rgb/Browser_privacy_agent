"""LangGraph nodes for the agent workflow."""
from typing import Any, Dict
from app.graph.state import AgentState, PolicyResult, AgentStateDict
from app.security import create_payload_validator, create_prompt_injection_detector
from app.services import (
    create_action_planner,
    create_action_validator,
    create_risk_classifier,
    create_context_parser,
    ActionValidationError
)
from app.schemas.agent_request import AgentRequest
from app.config import get_settings


# Node: policy_check
def policy_check_node(state: AgentStateDict) -> AgentStateDict:
    """
    Deterministic policy check - fail closed.
    Checks: privacy.verified, version, size limits, forbidden fields, ID formats.
    """
    validator = create_payload_validator()
    injection_detector = create_prompt_injection_detector()
    settings = get_settings()

    request_data = {
        "version": "1.0.0",
        "request_id": state["request_id"],
        "session_id": state["session_id"],
        "task": state["task"],
        "context": state["sanitized_context"].model_dump() if hasattr(state["sanitized_context"], "model_dump") else state["sanitized_context"]
    }

    payload_result = validator.validate_request(request_data)
    injection_results = injection_detector.scan_dict(request_data)

    violations = []
    violations.extend(payload_result.violations)
    if injection_results:
        violations.append("Prompt injection detected")

    context = state["sanitized_context"]
    if hasattr(context, "elements") and len(context.elements) > settings.max_context_elements:
        violations.append(f"Excessive context size: {len(context.elements)} elements")

    if hasattr(context, "ocr_regions") and len(context.ocr_regions) > 50:
        violations.append(f"Excessive OCR regions: {len(context.ocr_regions)}")

    if len(state["task"]) > settings.max_task_length:
        violations.append(f"Task too long: {len(state['task'])} chars")

    passed = len(violations) == 0
    safe_error = "Policy check failed" if not passed else ""

    state["policy_result"] = PolicyResult(
        passed=passed,
        violations=violations,
        safe_error=safe_error
    )
    state["iteration"] += 1

    return state


# Node: perception_decode
def perception_decode_node(state: AgentStateDict) -> AgentStateDict:
    """
    Decode and prepare perception data from context.
    Extracts interactive elements, validates structure.
    """
    parser = create_context_parser()
    context = state["sanitized_context"]

    if isinstance(context, dict):
        context = parser.parse_context(context)
        state["sanitized_context"] = context

    interactive = parser.extract_interactive_elements(context)

    state["ui_state"] = {
        "url": context.url,
        "viewport": f"{context.viewport.width}x{context.viewport.height}",
        "interactive_count": len(interactive),
        "total_elements": len(context.elements),
        "elements": [
            {
                "element_id": e.element_id,
                "tag": e.tag,
                "safe_label": e.safe_label,
                "role": e.role,
                "is_interactive": e.is_interactive,
                "input_type": e.input_type,
                "bbox": e.bbox.model_dump()
            }
            for e in interactive[:20]
        ]
    }

    state["iteration"] += 1
    return state


# Node: planner
async def planner_node(state: AgentStateDict) -> AgentStateDict:
    """
    Call planner backend to generate action.
    Uses dependency injection for planner backend.
    """
    planner = create_action_planner()

    request = AgentRequest(
        version="1.0.0",
        request_id=state["request_id"],
        session_id=state["session_id"],
        task=state["task"],
        context=state["sanitized_context"],
        step=state["iteration"],
        allowed_actions=["click", "scroll", "select", "navigate", "wait", "finish"]
    )

    try:
        result = await planner.plan(request)
        state["planner_output"] = result
    except Exception as e:
        state["error"] = f"Planner error: {e}"
        state["planner_output"] = {
            "action": {"action": "finish", "confidence": 0.1, "reasoning": "Planner failed"},
            "raw_response": '{"action": "finish", "confidence": 0.1, "reasoning": "Planner failed"}'
        }

    state["iteration"] += 1
    return state


# Node: action_validation
def action_validation_node(state: AgentStateDict) -> AgentStateDict:
    """
    Validate planner output through full validation pipeline.
    JSON parse -> Pydantic -> allow-list -> element existence -> state/risk.
    """
    validator = create_action_validator()
    risk_classifier = create_risk_classifier()
    context = state["sanitized_context"]
    planner_output = state["planner_output"]

    if not planner_output:
        state["error"] = "No planner output"
        state["validated_action"] = None
        state["iteration"] += 1
        return state

    raw_response = planner_output.get("raw_response", "")
    allowed_actions = ["click", "scroll", "select", "navigate", "wait", "finish"]

    try:
        response = validator.validate(raw_response, context, allowed_actions)
        state["validated_action"] = response.action

        risk = risk_classifier.classify(response.action, context)
        state["risk"] = risk

    except ActionValidationError as e:
        state["error"] = e.safe_error
        state["validated_action"] = None
        state["risk"] = None

    state["iteration"] += 1
    return state


# Node: finish
def finish_node(state: AgentStateDict) -> AgentStateDict:
    """
    Finalize and prepare response.
    Returns safe error if validation failed, otherwise returns action.
    """
    if state["error"]:
        state["done"] = True
        return state

    if not state["validated_action"]:
        state["error"] = "No valid action produced"
        state["done"] = True
        return state

    risk = state.get("risk")
    if risk and risk.value == "blocked":
        state["error"] = "Action blocked by risk classifier"
        state["validated_action"] = None
        state["done"] = True
        return state

    state["done"] = True
    return state


# Conditional edges
def policy_check_router(state: AgentStateDict) -> str:
    """Route after policy check."""
    policy_result = state.get("policy_result")
    if policy_result and not policy_result.passed:
        return "finish"
    return "perception_decode"


def action_validation_router(state: AgentStateDict) -> str:
    """Route after action validation."""
    if state.get("error") or not state.get("validated_action"):
        return "finish"

    risk = state.get("risk")
    if risk and risk.value == "blocked":
        return "finish"

    return "finish"


MAX_ITERATIONS = 10
MAX_GRAPH_STEPS = 5


def iteration_guard(state: AgentStateDict) -> str:
    """Guard against infinite loops."""
    if state.get("iteration", 0) >= MAX_ITERATIONS:
        state["error"] = "Maximum iterations exceeded"
        return "finish"
    return "continue"