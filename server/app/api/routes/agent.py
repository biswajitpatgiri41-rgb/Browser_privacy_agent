"""Agent planning endpoint."""
import time
from fastapi import APIRouter, Depends, HTTPException, Request

from app.services import (
    create_context_parser,
)
from app.security import (
    create_payload_validator,
    create_prompt_injection_detector,
    create_audit_logger,
    create_rate_limiter,
    ValidationResult
)
from app.schemas.agent_request import AgentRequest
from app.schemas.agent_response import AgentResponse
from app.graph.workflow import run_agent_graph
from app.llm import create_planner_backend
from app.utils.logging import get_logger

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])

logger = get_logger("agent")


def get_planner():
    return None


def get_context_parser():
    return create_context_parser()


def get_payload_validator():
    return create_payload_validator()


def get_injection_detector():
    return create_prompt_injection_detector()


def get_audit_logger():
    return create_audit_logger()


def get_rate_limiter():
    return create_rate_limiter()


@router.post("/plan", response_model=AgentResponse)
async def plan_action(
    request: Request,
    raw_request: AgentRequest,
    planner=Depends(get_planner),
    context_parser=Depends(get_context_parser),
    payload_validator=Depends(get_payload_validator),
    injection_detector=Depends(get_injection_detector),
    audit_logger=Depends(get_audit_logger),
    rate_limiter=Depends(get_rate_limiter)
):
    start_time = time.time()
    request_id = raw_request.request_id
    session_id = raw_request.session_id

    # Rate limiting
    rate_key = rate_limiter.get_client_key(request, session_id)
    rate_result = rate_limiter.check_limit(rate_key)
    if not rate_result.allowed:
        audit_logger.log_request_rejected(request_id, session_id, ["Rate limit exceeded"])
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(int(rate_result.reset_time - time.time()))}
        )

    # Log request received
    audit_logger.log_request_received(request_id, session_id, raw_request.task)

    # Security: Payload validation
    payload_result: ValidationResult = payload_validator.validate_request(raw_request.model_dump())
    if not payload_result.valid:
        audit_logger.log_request_rejected(request_id, session_id, payload_result.violations)
        raise HTTPException(status_code=400, detail=payload_result.safe_message)

    # Security: Prompt injection detection
    injection_results = injection_detector.scan_dict(raw_request.model_dump())
    if injection_results:
        audit_logger.log_request_rejected(request_id, session_id, ["Prompt injection detected"])
        raise HTTPException(status_code=400, detail="Invalid request")

    audit_logger.log_request_validated(request_id, session_id)

    # Parse and validate context
    try:
        context = context_parser.parse_context(raw_request.context.model_dump())
        context_warnings = context_parser.validate_context_integrity(context)
        for warning in context_warnings:
            logger.warning(f"Context warning: {warning} | request_id={request_id}")
    except Exception as e:
        audit_logger.log_error(request_id, session_id, f"Context parsing failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid context")

    # Get allowed actions from config
    allowed_actions = ["click", "scroll", "select", "navigate", "wait", "finish"]
    planner_backend = create_planner_backend()

    # Execute the single production planning path through LangGraph.
    try:
        graph_state = await run_agent_graph(
            request_id=request_id,
            session_id=session_id,
            task=raw_request.task,
            sanitized_context=context,
        )
    except Exception as e:
        audit_logger.log_error(request_id, session_id, f"LangGraph planning failed: {e}")
        return AgentResponse(
            request_id=request_id,
            session_id=session_id,
            action={
                "action": "finish",
                "confidence": 0.1,
                "reasoning": "Planning workflow failed; no browser action is authorized"
            },
            privacy=context.privacy,
            requires_confirmation=False
        )

    action = graph_state.get("validated_action")
    graph_error = graph_state.get("error")
    if action is None or graph_error:
        audit_logger.log_action_rejected(request_id, session_id, "none", graph_error or "No validated action")
        # Return safe fallback
        return AgentResponse(
            request_id=request_id,
            session_id=session_id,
            action={
                "action": "finish",
                "confidence": 0.1,
                "reasoning": f"Planning rejected: {graph_error or 'No validated action'}"
            },
            privacy=context.privacy,
            requires_confirmation=False
        )

    risk_level = graph_state.get("risk")
    action_name = getattr(action.action, "value", action.action)
    response = AgentResponse(
        request_id=request_id,
        session_id=session_id,
        action=action,
        privacy=context.privacy,
        requires_confirmation=getattr(risk_level, "value", risk_level) == "high",
        metadata={"planner_backend": planner_backend.get_backend_name(), "orchestration": "langgraph"},
    )

    # Log and return
    audit_logger.log_action_validated(request_id, session_id, action_name, risk_level.value)
    audit_logger.log_response_sent(request_id, session_id, action_name)

    duration = time.time() - start_time
    logger.info(
        f"Plan completed | request_id={request_id} | action={action_name} | "
        f"risk={risk_level.value} | duration_ms={duration*1000:.1f}"
    )

    return response


@router.post("/plan/stream")
async def plan_action_stream(
    request: Request,
    raw_request: AgentRequest
):
    """Streaming version - not implemented yet."""
    raise HTTPException(status_code=501, detail="Streaming not implemented")