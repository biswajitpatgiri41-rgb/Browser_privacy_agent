"""Verify the configured real Transformers planner without exposing secrets."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server"
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))
os.environ.setdefault("PYTHONPATH", str(SERVER))


def context(elements: list[dict]) -> dict:
    return {
        "version": "1.0.0",
        "request_id": "11111111-1111-4111-8111-111111111111",
        "session_id": "22222222-2222-4222-8222-222222222222",
        "url": "https://example.test/form",
        "title": "Controlled test page",
        "elements": elements,
        "viewport": {"width": 1280, "height": 720, "device_pixel_ratio": 1},
        "privacy": {"verified": True, "pii_detected": 2, "redaction_applied": 2, "token_map": {}},
        "ocr_regions": [],
    }


async def main() -> int:
    from app.config import get_settings
    from app.llm.transformers_backend import TransformersPlannerBackend
    from app.llm.base import PlannerInput

    settings = get_settings()
    adapter = Path(settings.model_adapter_path).expanduser()
    if not adapter.is_absolute():
        candidates = [Path.cwd() / adapter, ROOT / adapter, SERVER / adapter]
        adapter = next((candidate for candidate in candidates if candidate.exists()), candidates[-1])

    print(f"backend=transformers")
    print(f"base_model={settings.model_base}")
    print(f"adapter_exists={adapter.exists()}")
    print(f"adapter_path={adapter}")
    if not adapter.exists():
        return 2

    backend = TransformersPlannerBackend()
    started = time.perf_counter()
    healthy = await backend.health_check()
    init_ms = (time.perf_counter() - started) * 1000
    print(f"initialization_ms={init_ms:.1f}")
    if not healthy:
        print("status=FAIL planner_initialization")
        return 3

    submit_elements = [
        {"element_id": "el_cancel01", "tag": "button", "role": "button", "bbox": {"x": 0, "y": 0, "width": 80, "height": 30}, "safe_label": "Cancel", "is_interactive": True, "is_visible": True, "attributes": {}, "pii_regions": []},
        {"element_id": "el_submit1", "tag": "button", "role": "button", "bbox": {"x": 90, "y": 0, "width": 80, "height": 30}, "safe_label": "Submit", "is_interactive": True, "is_visible": True, "attributes": {}, "pii_regions": []},
    ]
    cases = [
        ("Click Submit", submit_elements),
        ("Click Login", submit_elements + [{"element_id": "el_login01", "tag": "button", "role": "button", "bbox": {"x": 180, "y": 0, "width": 80, "height": 30}, "safe_label": "Login", "is_interactive": True, "is_visible": True, "attributes": {}, "pii_regions": []}]),
        ("Click Purchase", [{"element_id": "el_help001", "tag": "button", "role": "button", "bbox": {"x": 0, "y": 0, "width": 80, "height": 30}, "safe_label": "Help", "is_interactive": True, "is_visible": True, "attributes": {}, "pii_regions": []}]),
    ]

    all_pass = True
    for index, (task, elements) in enumerate(cases, start=1):
        result = await backend.plan(PlannerInput(
            task=task,
            sanitized_context=context(elements),
            allowed_actions=["click", "scroll", "select", "navigate", "wait", "finish"],
            privacy_metadata={"verified": True},
            step=1,
        ))
        payload = {"case": index, "task": task, "action": result.action, "confidence": result.confidence, "raw_response": result.raw_response}
        print(json.dumps(payload, default=str))
        if task == "Click Submit":
            all_pass = all_pass and result.action.get("action") == "click" and result.action.get("element_id") == "el_submit1"
        elif task == "Click Login":
            all_pass = all_pass and result.action.get("action") == "click" and result.action.get("element_id") == "el_login01"

    print(f"status={'PASS' if all_pass else 'FAIL'}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
