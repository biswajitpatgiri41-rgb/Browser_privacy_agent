"""Transformers-based planner backend with LoRA/PEFT adapter support."""
import json
import time
from typing import Any, Optional
from pathlib import Path

from .base import PlannerBackend, PlannerInput, PlannerOutput
from app.config import get_settings
from app.services.training_prompt_adapter import TrainingCompatiblePromptAdapter


# Module-level singleton for lazy model loading
_model = None
_tokenizer = None
_initialized = False
_init_error: Optional[str] = None


def _get_device_and_dtype():
    """Determine device and dtype based on availability and settings."""
    import torch
    settings = get_settings()

    if settings.model_device == "cpu":
        return "cpu", torch.float32

    if settings.model_device == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA requested but not available")
        return "cuda", torch.float16

    # auto mode
    if torch.cuda.is_available():
        return "cuda", torch.float16
    return "cpu", torch.float32


async def _initialize_model():
    """Initialize the model and tokenizer with LoRA adapter. Called once."""
    global _model, _tokenizer, _initialized, _init_error

    if _initialized:
        return

    if _init_error:
        raise RuntimeError(f"Model initialization previously failed: {_init_error}")

    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
        import torch

        settings = get_settings()

        # Determine device and dtype
        device, dtype = _get_device_and_dtype()

        # Load tokenizer from adapter directory (contains chat_template.jinja)
        adapter_path = Path(settings.model_adapter_path).expanduser() if settings.model_adapter_path else None
        if adapter_path is not None and not adapter_path.is_absolute():
            candidates = [
                Path.cwd() / adapter_path,
                Path(__file__).resolve().parents[3] / adapter_path,
            ]
            adapter_path = next((candidate for candidate in candidates if candidate.exists()), candidates[-1])
        tokenizer_path = adapter_path if adapter_path is not None and adapter_path.exists() else settings.model_base

        _tokenizer = AutoTokenizer.from_pretrained(
            str(tokenizer_path),
            trust_remote_code=True,
            use_fast=True,
        )

        # Ensure pad token is set
        if _tokenizer.pad_token is None:
            _tokenizer.pad_token = _tokenizer.eos_token

        # Load base model
        _model = AutoModelForCausalLM.from_pretrained(
            settings.model_base,
            device_map=device if device == "cuda" else None,
            torch_dtype=dtype,
            trust_remote_code=True,
            low_cpu_mem_usage=True,
        )

        # Move to device if CPU
        if device == "cpu":
            _model = _model.to(device)

        # Attach LoRA adapter if path provided
        if adapter_path is not None and adapter_path.exists():
            _model = PeftModel.from_pretrained(
                _model,
            str(adapter_path),
                torch_dtype=dtype,
            )

        _model.eval()
        _initialized = True

    except Exception as e:
        _init_error = str(e)
        _initialized = False
        raise RuntimeError(f"Failed to initialize transformers backend: {e}")


def _get_model_and_tokenizer():
    """Get the initialized model and tokenizer."""
    if not _initialized:
        raise RuntimeError("Model not initialized. Call _initialize_model() first.")
    return _model, _tokenizer


def _reset_model():
    """Reset the model singleton (for testing)."""
    global _model, _tokenizer, _initialized, _init_error
    _model = None
    _tokenizer = None
    _initialized = False
    _init_error = None
class TransformersPlannerBackend(PlannerBackend):
    """Planner backend using local transformers model with LoRA adapter."""

    def __init__(self):
        self.settings = get_settings()

    def get_backend_name(self) -> str:
        return "transformers"

    async def health_check(self) -> bool:
        try:
            await _initialize_model()
            return _initialized and _model is not None
        except Exception:
            return False

    async def plan(self, input_data: PlannerInput) -> PlannerOutput:
        await _initialize_model()

        model, tokenizer = _get_model_and_tokenizer()

        # Build messages for chat template
        messages = self._build_messages(input_data)

        # Apply chat template (uses template from adapter directory)
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        # Tokenize
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

        # Generate with deterministic settings
        import torch
        start_time = time.time()

        with torch.inference_mode():
            outputs = model.generate(
                **inputs,
                max_new_tokens=self.settings.model_max_new_tokens,
                temperature=self.settings.model_temperature,
                do_sample=False,  # Deterministic
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )

        generation_time = time.time() - start_time

        # Decode only the generated tokens
        generated_ids = outputs[0][inputs.input_ids.shape[1]:]
        response = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()

        # Parse JSON from response (handle code fences/whitespace)
        action = self._parse_action(response)

        return PlannerOutput(
            action=action,
            reasoning=action.get("reasoning", ""),
            confidence=action.get("confidence", 0.5),
            raw_response=response
        )

    def _build_messages(self, input_data: PlannerInput) -> list[dict[str, str]]:
        """Build the training-compatible prompt expected by the LoRA adapter."""
        prompt = TrainingCompatiblePromptAdapter.build_training_prompt(
            task=input_data.task,
            allowed_actions=input_data.allowed_actions,
            sanitized_context=input_data.sanitized_context,
            step=input_data.step,
        )
        return [{"role": "user", "content": prompt}]

    def _parse_action(self, response: str) -> dict[str, Any]:
        """Parse JSON action from model response, handling code fences."""
        # Try direct JSON parse first
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from code fences
        import re
        json_match = re.search(r"```(?:json)?\s*(\{.*?})\s*```", response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find first JSON object in response
        json_match = re.search(r"(\{.*})", response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Failed to parse
        return {
            "action": "finish",
            "confidence": 0.1,
            "reasoning": "Failed to parse model output as valid JSON"
        }


# Backwards compatibility - module-level functions
async def initialize():
    """Initialize the model (for backwards compatibility)."""
    await _initialize_model()


def get_model():
    """Get the model instance (for backwards compatibility)."""
    return _get_model_and_tokenizer()[0]


def get_tokenizer():
    """Get the tokenizer instance (for backwards compatibility)."""
    return _get_model_and_tokenizer()[1]