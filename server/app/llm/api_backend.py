"""API-based planner backend (OpenAI-compatible)."""
import json
import httpx
from typing import Any
from .base import PlannerBackend, PlannerInput, PlannerOutput
from app.config import get_settings


class APIPlannerBackend(PlannerBackend):
    """Planner backend using OpenAI-compatible API."""

    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(
            base_url=self.settings.api_base_url or "https://api.openai.com/v1",
            headers={
                "Authorization": f"Bearer {self.settings.api_key}",
                "Content-Type": "application/json"
            },
            timeout=self.settings.api_timeout_seconds
        )

    def get_backend_name(self) -> str:
        return f"api:{self.settings.api_provider}"

    async def health_check(self) -> bool:
        try:
            response = await self.client.get("/models", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False

    async def plan(self, input_data: PlannerInput) -> PlannerOutput:
        prompt = self._build_prompt(input_data)

        response = await self.client.post(
            "/chat/completions",
            json={
                "model": self.settings.api_model,
                "messages": [
                    {"role": "system", "content": self._system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,
                "max_tokens": 500,
                "response_format": {"type": "json_object"}
            }
        )
        response.raise_for_status()
        data = response.json()

        raw_content = data["choices"][0]["message"]["content"]
        action = json.loads(raw_content)

        return PlannerOutput(
            action=action,
            reasoning=action.get("reasoning", ""),
            confidence=action.get("confidence", 0.5),
            raw_response=raw_content
        )

    def _system_prompt(self) -> str:
        return """You are a browser automation agent. Given a task and sanitized page context, output a single JSON action.
Allowed actions: click, scroll, select, navigate, wait, finish.
Never output explanations - only valid JSON matching the schema.
Confidence must be 0-1.
Element IDs must match those in the provided context."""

    def _build_prompt(self, input_data: PlannerInput) -> str:
        elements = input_data.sanitized_context.get("elements", [])
        interactive = [e for e in elements if e.get("is_interactive", False)]
        elements_summary = "\n".join(
            f"  {e['element_id']}: {e['tag']} '{e.get('safe_label', '')}'"
            for e in interactive[:20]
        )

        return f"""Task: {input_data.task}
Step: {input_data.step}
Interactive Elements:
{elements_summary or "  (none)"}
Allowed Actions: {", ".join(input_data.allowed_actions)}

Output JSON with: action, element_id (if applicable), confidence, reasoning"""

    async def close(self):
        await self.client.aclose()