"""Copy and validate the trained PII NER ONNX model for extension packaging."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Path to exported ONNX model")
    parser.add_argument(
        "--extension-root",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "extension",
    )
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".onnx":
        raise FileNotFoundError(f"Expected an ONNX file: {source}")

    destination = args.extension_root / "models" / "ner.onnx"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

    try:
        import onnx

        onnx.checker.check_model(onnx.load(str(destination)))
    except ImportError:
        print("Copied model; install onnx to validate the graph")
    else:
        print(f"Validated and copied: {destination}")


if __name__ == "__main__":
    main()
