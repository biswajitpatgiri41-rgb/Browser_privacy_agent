"""Temporary deterministic planner backend used during model integration recovery."""

from __future__ import annotations

import json
import re
from typing import Any

from app.config import get_settings
from .base import PlannerBackend, PlannerInput, PlannerOutput


class TemporaryPlannerBackend(PlannerBackend):
    """Local, deterministic planner used when real model backends are intentionally deferred."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def get_backend_name(self) -> str:
        return "temporary"

    async def health_check(self) -> bool:
        return True

    async def plan(self, input_data: PlannerInput | dict[str, Any]) -> PlannerOutput:
        if isinstance(input_data, dict):
            task = str(input_data.get("task", "") or "")
            allowed_actions = set(input_data.get("allowed_actions", []) or [])
            context = input_data.get("sanitized_context") or {}
        else:
            task = str(input_data.task or "")
            allowed_actions = set(input_data.allowed_actions or [])
            context = input_data.sanitized_context or {}

        task = task.lower().strip()
        elements = context.get("elements", []) if isinstance(context, dict) else []
        interactive = [e for e in elements if bool(e.get("is_interactive"))]

        action = self._build_action(task, interactive, allowed_actions)
        raw_response = json.dumps(action, separators=(",", ":"))
        return PlannerOutput(
            action=action,
            reasoning=action.get("reasoning", ""),
            confidence=float(action.get("confidence", 0.5)),
            raw_response=raw_response,
        )

    def _build_action(
        self,
        task: str,
        interactive: list[dict[str, Any]],
        allowed_actions: set[str],
    ) -> dict[str, Any]:
        if not task:
            return {"action": "finish", "confidence": 0.1, "reasoning": "No task available"}

        click_keywords = {"click", "tap", "press", "open", "select", "focus"}
        scroll_keywords = {"scroll", "move", "down", "up", "left", "right", "more", "next"}
        wait_keywords = {"wait", "pause", "sleep", "hold"}
        navigate_keywords = {"navigate", "go to", "visit", "open page", "load", "url"}
        finish_keywords = {"finish", "done", "stop", "complete", "cancel", "close"}

        if any(keyword in task for keyword in finish_keywords):
            return {"action": "finish", "confidence": 0.9, "reasoning": "Task is complete or no further automation is needed"}

        if any(keyword in task for keyword in wait_keywords) and "wait" in allowed_actions:
            return {"action": "wait", "duration_ms": 1000, "confidence": 0.8, "reasoning": "The task explicitly requests a brief pause before continuing"}

        if any(keyword in task for keyword in navigate_keywords) and "navigate" in allowed_actions:
            url_match = re.search(r"https?://\S+", task)
            url = url_match.group(0) if url_match else "https://example.com"
            return {"action": "navigate", "url": url, "confidence": 0.8, "reasoning": "The task requires navigation to a specific target"}

        if any(keyword in task for keyword in scroll_keywords) and "scroll" in allowed_actions:
            direction = "down"
            if "up" in task:
                direction = "up"
            elif "left" in task:
                direction = "left"
            elif "right" in task:
                direction = "right"
            return {
                "action": "scroll",
                "direction": direction,
                "amount": 300,
                "confidence": 0.7,
                "reasoning": "The task requests browsing to additional content or a different viewport position",
            }

        if interactive:
            target = interactive[0]
            element_id = str(target.get("element_id"))
            safe_label = str(target.get("safe_label") or target.get("tag") or "target")

            if "select" in task and "select" in allowed_actions:
                return {
                    "action": "select",
                    "element_id": element_id,
                    "value": safe_label,
                    "confidence": 0.7,
                    "reasoning": "The task requires choosing a relevant option from the available controls",
                }

            if any(keyword in task for keyword in click_keywords) and "click" in allowed_actions:
                return {
                    "action": "click",
                    "element_id": element_id,
                    "confidence": 0.75,
                    "reasoning": "A matching interactive element is available for the requested user action",
                }

            if "click" in allowed_actions:
                return {
                    "action": "click",
                    "element_id": element_id,
                    "confidence": 0.6,
                    "reasoning": "The page offers a relevant interactive target and the default safe action is to click it",
                }

        return {"action": "finish", "confidence": 0.2, "reasoning": "No safe browser action is available for the current task"}
