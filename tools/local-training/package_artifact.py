#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_json(path: Path, default: Any) -> Any:
    return json.loads(path.read_text("utf-8")) if path.exists() else default


def main() -> None:
    parser = argparse.ArgumentParser(description="Package a trained bowling model artifact.")
    parser.add_argument("--run", required=True, type=Path, help="Training run output directory")
    parser.add_argument("--name", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    model_dir = args.run / "model"
    processor_dir = args.run / "processor"
    if not model_dir.exists():
        raise SystemExit(f"Missing model directory: {model_dir}")
    if not processor_dir.exists():
        raise SystemExit(f"Missing processor directory: {processor_dir}")

    metrics = load_json(args.run / "metrics.json", {})
    training_config = load_json(args.run / "training-config.json", {})
    manifest = {
        "schemaVersion": "bowling-local-model-artifact-v1",
        "name": args.name,
        "version": args.version,
        "architecture": "donut",
        "framework": "transformers",
        "task": "image-to-bowling-json",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "entrypoint": {
            "modelPath": "model",
            "processorPath": "processor",
        },
        "metrics": metrics,
        "trainingConfig": training_config,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        for path in sorted(model_dir.rglob("*")):
            if path.is_file():
                archive.write(path, Path("model") / path.relative_to(model_dir))
        for path in sorted(processor_dir.rglob("*")):
            if path.is_file():
                archive.write(path, Path("processor") / path.relative_to(processor_dir))
        for extra_name in ("metrics.json", "training-config.json"):
            extra_path = args.run / extra_name
            if extra_path.exists():
                archive.write(extra_path, extra_name)

    print(json.dumps({"artifact": str(args.out), "manifest": manifest}, indent=2))


if __name__ == "__main__":
    main()
