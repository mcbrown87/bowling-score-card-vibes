#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import random
import zipfile
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text("utf-8"))


def decode_data_url(data_url: str) -> tuple[str, bytes]:
    header, payload = data_url.split(",", 1)
    media_type = header.removeprefix("data:").split(";", 1)[0] or "image/jpeg"
    return media_type, base64.b64decode(payload)


def extension_for_media_type(media_type: str) -> str:
    lowered = media_type.lower()
    if "png" in lowered:
        return "png"
    if "webp" in lowered:
        return "webp"
    return "jpg"


def load_export_examples(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
            examples = []
            for example in manifest.get("examples", []):
                target = json.loads(archive.read(example["labelPath"]).decode("utf-8"))
                examples.append(
                    {
                        **example,
                        "imageBytes": archive.read(example["imagePath"]),
                        "targetText": json.dumps(target, separators=(",", ":")),
                    }
                )
            return manifest, examples

    export = load_json(path)
    return export, list(export.get("examples", []))


def write_split(out_dir: Path, split_name: str, rows: list[dict[str, Any]]) -> None:
    split_dir = out_dir / split_name
    image_dir = split_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = split_dir / "metadata.jsonl"

    with metadata_path.open("w", encoding="utf-8") as metadata_file:
        for row in rows:
            if "imageBytes" in row:
                media_type = row.get("contentType") or "image/jpeg"
                image_bytes = row["imageBytes"]
            else:
                media_type, image_bytes = decode_data_url(row["imageDataUrl"])
            extension = extension_for_media_type(media_type)
            file_name = f"images/{row['imageSha256']}.{extension}"
            (split_dir / file_name).write_bytes(image_bytes)
            metadata_file.write(
                json.dumps(
                    {
                        "file_name": file_name,
                        "ground_truth": row["targetText"],
                        "storedImageId": row.get("storedImageId"),
                        "imageSha256": row["imageSha256"],
                        "originalFileName": row.get("originalFileName"),
                    },
                    separators=(",", ":"),
                )
                + "\n"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare bowling scorecard export for training.")
    parser.add_argument("--export", required=True, type=Path, help="Admin training dataset zip or legacy JSON")
    parser.add_argument("--out", required=True, type=Path, help="Output dataset directory")
    parser.add_argument("--validation-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    export, examples = load_export_examples(args.export)
    if not examples:
        raise SystemExit("No examples found in export")

    random.Random(args.seed).shuffle(examples)
    validation_count = max(1, round(len(examples) * args.validation_ratio)) if len(examples) > 1 else 0
    validation_rows = examples[:validation_count]
    train_rows = examples[validation_count:] or examples

    args.out.mkdir(parents=True, exist_ok=True)
    write_split(args.out, "train", train_rows)
    write_split(args.out, "validation", validation_rows)

    summary = {
        "schemaVersion": "bowling-local-training-dataset-v1",
        "sourceSchemaVersion": export.get("schemaVersion"),
        "sourceExportedAt": export.get("exportedAt"),
        "imageCount": len(examples),
        "correctionCount": export.get("correctionCount"),
        "trainCount": len(train_rows),
        "validationCount": len(validation_rows),
    }
    (args.out / "dataset-summary.json").write_text(json.dumps(summary, indent=2), "utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
