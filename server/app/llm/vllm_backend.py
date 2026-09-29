"""vLLM-based planner backend (high-throughput local inference)."""
import json
from typing import Any
from .base import PlannerBackend, PlannerInput, PlannerOutput
from app.config import get_settings


class VLLMPlannerBackend(PlannerBackend):
    """Planner backend using vLLM for high-throughput inference."""

    def __init__(self):
        self.settings = get_settings()
        self._llm = None
        self._initialized = False

    def get_backend_name(self) -> str:
        return "vllm"

    async def health_check(self) -> bool:
        return self._initialized and self._llm is not None

    async def _initialize(self):
        if self._initialized:
            return
        try:
            from vllm import LLM, SamplingParams

            self._llm = LLM(
                model=self.settings.model_base,
                trust_remote_code=True,
                dtype="float16"
            )
            self._sampling_params = SamplingParams(
                temperature=0.1,
                max_tokens=256,
                stop=["\n\n"]
            )
            self._initialized = True
        except Exception as e:
            raise RuntimeError(f"Failed to initialize vLLM backend: {e}")

    async def plan(self, input_data: PlannerInput) -> PlannerOutput:
        await self._initialize()

        prompt = self._build_prompt(input_data)
        outputs = self._llm.generate([prompt], self._sampling_params)
        response = outputs[0].outputs[0].text.strip()

        try:
            action = json.loads(response)
        except json.JSONDecodeError:
            action = {"action": "finish", "confidence": 0.1, "reasoning": "Failed to parse model output"}

        return PlannerOutput(
            action=action,
            reasoning=action.get("reasoning", ""),
            confidence=action.get("confidence", 0.5),
            raw_response=response
        )

    def _build_prompt(self, input_data: PlannerInput) -> str:
        elements = input_data.sanitized_context.get("elements", [])
        interactive = [e for e in elements if e.get("is_interactive", False)]
        elements_summary = "\n".join(
            f"  {e['element_id']}: {e['tag']} '{e.get('safe_label', '')}'"
            for e in interactive[:20]
        )

        return f"""<|system|>
You are a browser automation agent. Given a task and sanitized page context, output a single JSON action.
Allowed actions: click, scroll, select, navigate, wait, finish.
Never output explanations - only valid JSON matching the schema.
Confidence must be 0-1.
Element IDs must match those in the provided context.
<|user|>
Task: {input_data.task}
Step: {input_data.step}
Interactive Elements:
{elements_summary or "  (none)"}
Allowed Actions: {", ".join(input_data.allowed_actions)}

Output JSON with: action, element_id (if applicable), confidence, reasoning
<|assistant|>
"""