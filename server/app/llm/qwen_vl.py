"""Qwen-VL based planner backend (vision-language model)."""
import json
import base64
from typing import Any
from .base import PlannerBackend, PlannerInput, PlannerOutput
from app.config import get_settings


class QwenVLPlannerBackend(PlannerBackend):
    """Planner backend using Qwen-VL for vision-language understanding."""

    def __init__(self):
        self.settings = get_settings()
        self._model = None
        self._processor = None
        self._initialized = False

    def get_backend_name(self) -> str:
        return "qwen_vl"

    async def health_check(self) -> bool:
        return self._initialized and self._model is not None

    async def _initialize(self):
        if self._initialized:
            return
        try:
            from transformers import AutoModelForCausalLM, AutoProcessor
            import torch

            self._processor = AutoProcessor.from_pretrained(
                self.settings.model_base,
                trust_remote_code=True
            )
            self._model = AutoModelForCausalLM.from_pretrained(
                self.settings.model_base,
                device_map=self.settings.model_device,
                torch_dtype=torch.float16,
                trust_remote_code=True
            ).eval()
            self._initialized = True
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Qwen-VL backend: {e}")

    async def plan(self, input_data: PlannerInput) -> PlannerOutput:
        await self._initialize()

        # Build conversation with images if available
        ocr_regions = input_data.sanitized_context.get("ocr_regions", [])
        has_images = len(ocr_regions) > 0

        messages = [
            {
                "role": "system",
                "content": "You are a browser automation agent. Given a task, page context, and optional screenshots/OCR, output a single JSON action."
            }
        ]

        user_content = []
        if has_images:
            for ocr in ocr_regions[:3]:  # Limit to 3 OCR regions
                if ocr.get("image_base64"):
                    user_content.append({
                        "type": "image",
                        "image": ocr["image_base64"]
                    })

        user_content.append({
            "type": "text",
            "text": self._build_prompt(input_data)
        })

        messages.append({"role": "user", "content": user_content})

        # Apply chat template
        text = self._processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )

        # Process images
        images = []
        for msg in messages:
            if msg["role"] == "user":
                for content in msg["content"]:
                    if content["type"] == "image":
                        import io
                        from PIL import Image
                        img_data = base64.b64decode(content["image"])
                        images.append(Image.open(io.BytesIO(img_data)))

        inputs = self._processor(text=text, images=images, return_tensors="pt").to(self._model.device)

        import torch
        with torch.no_grad():
            outputs = self._model.generate(
                **inputs,
                max_new_tokens=256,
                temperature=0.1,
                do_sample=True,
                pad_token_id=self._processor.tokenizer.eos_token_id
            )

        response = self._processor.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)

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

        ocr_text = ""
        ocr_regions = input_data.sanitized_context.get("ocr_regions", [])
        if ocr_regions:
            ocr_text = "\nOCR Text:\n" + "\n".join(
                f"  Region {ocr['region_id']}: {ocr.get('text', '')[:200]}"
                for ocr in ocr_regions[:5]
            )

        return f"""Task: {input_data.task}
Step: {input_data.step}
Interactive Elements:
{elements_summary or "  (none)"}
{ocr_text}
Allowed Actions: {", ".join(input_data.allowed_actions)}

Output JSON with: action, element_id (if applicable), confidence, reasoning"""