#!/usr/bin/env python3
"""Verify whether the client-side NER/UI model artifacts truly exist.

This project must not fabricate ONNX files or hide missing model exports behind
fallback logic. If the trained artifacts are unavailable, this script exits
nonzero and writes a structured report describing the exact blocker.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "artifacts"
OUTPUT_PATH = ARTIFACTS_DIR / "client_ner_validation.json"


def nonzero_file(path: Path) -> bool:
    return path.exists() and path.is_file() and path.stat().st_size > 0


def main() -> int:
    artifacts = {
        "status": "BLOCKED",
        "requirement": "Phase 2: recover/export client NER",
        "checked_paths": [],
        "technical_cause": [],
        "validation": {
            "onnx_exists": False,
            "onnx_path": str(ROOT / "extension" / "public" / "models" / "ner" / "model.onnx"),
            "size_bytes": 0,
            "source_reference": "model_train/client_train.ipynb",
        },
        "next_action": "Provide the actual trained checkpoint or export from a valid training environment into extension/public/models/ner/ and re-run validation.",
    }

    ner_path = ROOT / "extension" / "public" / "models" / "ner" / "model.onnx"
    ui_path = ROOT / "extension" / "public" / "models" / "ui-detector" / "yolov8n-ui.onnx"
    candidate_paths = [
        ner_path,
        ui_path,
        ROOT / "client_models" / "pii_ner" / "best",
        ROOT / "client_models",
        ROOT / "ml" / "training" / "pii_ner",
        ROOT / "ml" / "training" / "ui_detection",
        ROOT / "ml" / "export",
    ]

    for candidate in candidate_paths:
        artifacts["checked_paths"].append({
            "path": str(candidate),
            "exists": candidate.exists(),
            "is_file": candidate.is_file() if candidate.exists() else False,
            "has_nonzero_size": nonzero_file(candidate),
        })

    if nonzero_file(ner_path):
        artifacts["validation"]["onnx_exists"] = True
        artifacts["validation"]["size_bytes"] = ner_path.stat().st_size
        artifacts["status"] = "PASS"
    else:
        artifacts["technical_cause"].append(
            "The repo does not contain a valid exported NER ONNX model under extension/public/models/ner/model.onnx."
        )
        artifacts["technical_cause"].append(
            "The training notebook references a checkpoint under /content/client_models/pii_ner/best, which is outside this workspace."
        )
        artifacts["technical_cause"].append(
            "The export step in model_train/client_train.ipynb failed with an Optimum CLI argument error: 'unrecognized arguments: onnx --model ... --task token-classification ...'"
        )
        artifacts["technical_cause"].append(
            "Without the trained checkpoint or a valid ONNX export, browser-side NER inference cannot be verified in this environment."
        )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(artifacts, indent=2), encoding="utf-8")
    print(json.dumps(artifacts, indent=2))

    return 0 if artifacts["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
