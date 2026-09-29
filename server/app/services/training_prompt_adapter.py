"""Normalize canonical sanitized browser state into the trained planner schema."""

from __future__ import annotations

import json
from typing import Any


class TrainingCompatiblePromptAdapter:
    """Map the app's production context to the format used by the trained LoRA model."""

    @staticmethod
    def normalize_screen(sanitized_context: dict[str, Any]) -> dict[str, Any]:
        viewport = sanitized_context.get("viewport", {})
        width = int(viewport.get("width", 1280))
        height = int(viewport.get("height", 720))

        elements: list[dict[str, Any]] = []
        for element in sanitized_context.get("elements", []):
            element_id = str(element.get("element_id") or element.get("id") or f"el_{len(elements)}")
            role = str(element.get("role") or element.get("tag") or "other")
            label = str(element.get("safe_label") or element.get("label") or element.get("text") or "")
            sensitive = bool(element.get("sensitive") or bool(element.get("pii_regions")))
            interactive = bool(element.get("is_interactive", False))
            visible = bool(element.get("is_visible", True))
            tag = str(element.get("tag") or role)

            normalized = {
                "id": element_id,
                "element_id": element_id,
                "role": role,
                "label": label,
                "safe_label": label,
                "tag": tag,
                "sensitive": sensitive,
                "interactive": interactive,
                "is_interactive": interactive,
                "visible": visible,
                "is_visible": visible,
            }
            if element.get("attributes"):
                normalized["attributes"] = element.get("attributes")
            elements.append(normalized)

        return {
            "screenWidth": width,
            "screenHeight": height,
            "width": width,
            "height": height,
            "elements": elements,
        }

    @classmethod
    def build_training_prompt(
        cls,
        *,
        task: str,
        allowed_actions: list[str],
        sanitized_context: dict[str, Any],
        step: int,
    ) -> str:
        privacy = sanitized_context.get("privacy", {})
        screen = cls.normalize_screen(sanitized_context)
        payload = {
            "task": task,
            "step": step,
            "allowed_actions": list(allowed_actions),
            "screen": screen,
            "privacy": {
                "verified": bool(privacy.get("verified", True)),
                "pii_detected": int(privacy.get("pii_detected", 0)),
                "redaction_applied": int(privacy.get("redaction_applied", 0)),
                "redaction_version": str(privacy.get("redaction_version", "v1")),
            },
        }

        return (
            "Task: " + task + "\n"
            + "Structured UI state:\n"
            + json.dumps(payload, separators=(",", ":"))
            + "\n"
            + "Return only valid JSON in the form {\"action\":\"...\",\"element_id\":\"...\",\"confidence\":0.0,\"reasoning\":\"...\"}."
        )
