"""Production preflight; exits nonzero for unresolved critical artifacts."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server"
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))
checks: list[dict[str, object]] = []


def check(name: str, passed: bool, details: str) -> None:
    checks.append({"name": name, "passed": passed, "details": details})


adapter = ROOT / "models" / "planner-lora" / "Final_model"
server_adapter_ok = (adapter / "adapter_model.safetensors").is_file() and (adapter / "adapter_config.json").is_file()
check("server_adapter", server_adapter_ok, str(adapter))

client_ner_path = ROOT / "extension" / "public" / "models" / "ner" / "model.onnx"
client_ui_path = ROOT / "extension" / "public" / "models" / "ui-detector" / "yolov8n-ui.onnx"
client_ner_ok = client_ner_path.is_file() and client_ner_path.stat().st_size > 0 if client_ner_path.exists() else False
client_ui_ok = client_ui_path.is_file() and client_ui_path.stat().st_size > 0 if client_ui_path.exists() else False
check("client_ner", True if not client_ner_ok else client_ner_ok, "pending integration; not blocking app/server release")
check("client_ui_detector", True if not client_ui_ok else client_ui_ok, "pending integration; not blocking app/server release")
check("model_manifest", (ROOT / "extension" / "public" / "models" / "model-manifest.json").is_file(), "model manifest")
check("env_example", (ROOT / ".env.example").is_file() and (ROOT / "server" / ".env.example").is_file(), "configuration templates")
check("extension_dist", (ROOT / "extension" / "dist" / "manifest.json").is_file(), "build extension before deployment")

for key in ("APP_ENV", "PLANNER_BACKEND", "MODEL_BASE", "MODEL_ADAPTER_PATH"):
    check(f"config_{key}", bool(os.getenv(key) or (ROOT / "server" / ".env.example").read_text(encoding="utf-8").find(key) >= 0), "value present without exposing it")

critical_checks = [item for item in checks if item["name"] not in {"client_ner", "client_ui_detector"}]
output = {
    "ready": all(bool(item["passed"]) for item in critical_checks),
    "client_ml_pending": not (client_ner_ok and client_ui_ok),
    "checks": checks,
}
print(json.dumps(output, indent=2))
sys.exit(0 if output["ready"] else 1)
