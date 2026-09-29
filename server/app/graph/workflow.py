"""LangGraph workflow definition."""
from typing import Any, Dict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.graph.state import AgentState, AgentStateDict, dict_to_state, state_to_dict
from app.graph.nodes import (
    policy_check_node,
    perception_decode_node,
    planner_node,
    action_validation_node,
    finish_node,
    policy_check_router,
    action_validation_router,
    iteration_guard,
)


def create_workflow() -> StateGraph:
    """Create the LangGraph workflow for agent planning."""

    # Define graph with typed state
    workflow = StateGraph(AgentStateDict)

    # Add nodes
    workflow.add_node("policy_check", policy_check_node)
    workflow.add_node("perception_decode", perception_decode_node)
    workflow.add_node("planner", planner_node)
    workflow.add_node("action_validation", action_validation_node)
    workflow.add_node("finish", finish_node)

    # Add edges
    workflow.add_edge(START, "policy_check")

    # Conditional: policy_check -> perception_decode OR finish
    workflow.add_conditional_edges(
        "policy_check",
        policy_check_router,
        {
            "perception_decode": "perception_decode",
            "finish": "finish"
        }
    )

    workflow.add_edge("perception_decode", "planner")
    workflow.add_edge("planner", "action_validation")

    # Conditional: action_validation -> finish (success or failure both go to finish)
    workflow.add_conditional_edges(
        "action_validation",
        action_validation_router,
        {
            "finish": "finish"
        }
    )

    # Add iteration guard as a conditional edge from finish
    # (In practice, we'd add this as a check before each node)
    workflow.add_edge("finish", END)

    return workflow


def compile_workflow() -> StateGraph:
    """Compile workflow with checkpointer."""
    workflow = create_workflow()
    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)


async def run_agent_graph(
    request_id: str,
    session_id: str,
    task: str,
    sanitized_context: Any
) -> AgentStateDict:
    """
    Run the agent graph with given inputs.
    Returns final state dict.
    """
    compiled = compile_workflow()

    initial_state: AgentStateDict = {
        "request_id": request_id,
        "session_id": session_id,
        "task": task,
        "sanitized_context": sanitized_context,
        "ui_state": {},
        "policy_result": None,
        "planner_output": None,
        "validated_action": None,
        "risk": None,
        "done": False,
        "error": None,
        "iteration": 0,
    }

    # Run graph
    result = await compiled.ainvoke(initial_state)

    return result


# Synchronous wrapper for testing
def run_agent_graph_sync(
    request_id: str,
    session_id: str,
    task: str,
    sanitized_context: Any
) -> AgentStateDict:
    """Synchronous version for testing."""
    import asyncio
    return asyncio.run(run_agent_graph(request_id, session_id, task, sanitized_context))