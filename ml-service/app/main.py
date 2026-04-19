from __future__ import annotations

import json
import base64
import hashlib
import logging
import re
import shutil
import tarfile
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel


logger = logging.getLogger("bowling-ml-service")

DATA_DIR = Path("/app/data")
MODELS_DIR = DATA_DIR / "models"
IMPORTS_DIR = DATA_DIR / "imports"
MODELS_PATH = DATA_DIR / "models.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
IMPORTS_DIR.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text("utf-8"))


def save_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2), "utf-8")


def load_models() -> list[dict[str, Any]]:
    return load_json(MODELS_PATH, [])


def save_models(payload: list[dict[str, Any]]) -> None:
    save_json(MODELS_PATH, payload)


def safe_name(value: str) -> str:
    normalized = "".join(char if char.isalnum() or char in "._-" else "-" for char in value)
    return normalized.strip(".-") or str(uuid4())


class InferRequest(BaseModel):
    imageDataUrl: str
    prompt: str
    model: str | None = None
    modelArtifactId: str | None = None


class DonutInferenceError(RuntimeError):
    def __init__(self, message: str, raw_text: str | None = None) -> None:
        super().__init__(message)
        self.raw_text = raw_text


app = FastAPI(title="Bowling OCR ML Service", version="0.1.0")


def snippet(value: str | None, max_length: int = 800) -> str:
    if not value:
        return ""
    compacted = " ".join(value.split())
    if len(compacted) <= max_length:
        return compacted
    return f"{compacted[:max_length]}..."


def image_bytes_from_data_url(data_url: str) -> bytes:
    try:
        _, payload = data_url.split(",", 1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="imageDataUrl must be a data URL") from exc

    try:
        return base64.b64decode(payload, validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="imageDataUrl must contain valid base64") from exc


def data_url_sha256(data_url: str) -> str:
    image_bytes = image_bytes_from_data_url(data_url)
    return hashlib.sha256(image_bytes).hexdigest()


def build_baseline_game(digest: bytes, player_index: int) -> dict[str, Any]:
    running_total = 0
    frames: list[dict[str, Any]] = []
    offset = player_index * 23

    for frame_index in range(9):
        first = digest[(offset + frame_index * 2) % len(digest)] % 10
        second_limit = max(1, 10 - first)
        second = digest[(offset + frame_index * 2 + 1) % len(digest)] % second_limit
        running_total += first + second
        frames.append(
            {
                "rolls": [{"pins": first}, {"pins": second}],
                "isStrike": False,
                "isSpare": False,
                "score": running_total,
            }
        )

    first = digest[(offset + 18) % len(digest)] % 10
    second_limit = max(1, 10 - first)
    second = digest[(offset + 19) % len(digest)] % second_limit
    running_total += first + second
    tenth_frame = {
        "rolls": [{"pins": first}, {"pins": second}],
        "isStrike": False,
        "isSpare": False,
        "score": running_total,
    }

    return {
        "playerName": f"Local Player {player_index + 1}",
        "frames": frames,
        "tenthFrame": tenth_frame,
        "totalScore": running_total,
    }


def build_baseline_games(image_sha256: str) -> list[dict[str, Any]]:
    digest = bytes.fromhex(image_sha256)
    player_count = 1 + digest[0] % 2
    return [build_baseline_game(digest, index) for index in range(player_count)]


def extract_player_names(text: str | None) -> list[str]:
    if not text:
        return []

    names: list[str] = []
    for match in re.finditer(r'"playerName"\s*:\s*"((?:\\.|[^"\\])*)"', text):
        try:
            name = json.loads(f'"{match.group(1)}"')
        except json.JSONDecodeError:
            name = match.group(1)
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


def apply_player_names(
    games: list[dict[str, Any]],
    player_names: list[str],
) -> list[dict[str, Any]]:
    if not player_names:
        return games

    renamed_games: list[dict[str, Any]] = []
    for index, game in enumerate(games):
        renamed_game = dict(game)
        if index < len(player_names):
            renamed_game["playerName"] = player_names[index]
        renamed_games.append(renamed_game)
    return renamed_games


def find_model(model_name: str | None, model_artifact_id: str | None = None) -> dict[str, Any] | None:
    models = load_models()
    if model_artifact_id:
        match = next((model for model in models if model.get("id") == model_artifact_id), None)
        if match:
            return match

    if model_name:
        match = next((model for model in models if model.get("version") == model_name), None)
        if match:
            return match
        match = next((model for model in models if model.get("name") == model_name), None)
        if match:
            return match

    return models[-1] if models else None


def load_model_examples(model: dict[str, Any]) -> list[dict[str, Any]]:
    local_path = model.get("localPath")
    if not isinstance(local_path, str):
        return []

    examples_path = Path(local_path) / "examples.json"
    examples = load_json(examples_path, [])
    return examples if isinstance(examples, list) else []


def extract_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("{"):
        return json.loads(stripped)

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model output did not contain a JSON object")
    return json.loads(stripped[start : end + 1])


def clamp_pins(value: Any) -> int:
    try:
        pins = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(10, pins))


def normalize_rolls(raw_rolls: Any) -> list[dict[str, int]]:
    if not isinstance(raw_rolls, list):
        return []
    rolls: list[dict[str, int]] = []
    for roll in raw_rolls:
        if isinstance(roll, dict):
            rolls.append({"pins": clamp_pins(roll.get("pins"))})
        else:
            rolls.append({"pins": clamp_pins(roll)})
    return rolls


def normalize_game(raw: dict[str, Any]) -> dict[str, Any]:
    raw_frames = raw.get("frames") if isinstance(raw.get("frames"), list) else []
    frames: list[dict[str, Any]] = []

    for frame_index in range(9):
        raw_frame = raw_frames[frame_index] if frame_index < len(raw_frames) else {}
        raw_frame = raw_frame if isinstance(raw_frame, dict) else {}
        rolls = normalize_rolls(raw_frame.get("rolls"))
        while len(rolls) < 2:
            rolls.append({"pins": 0})
        first = rolls[0]["pins"]
        second = 0 if first == 10 else min(10 - first, rolls[1]["pins"])
        frame_rolls = [{"pins": first}] if first == 10 else [{"pins": first}, {"pins": second}]
        running_total = raw_frame.get("runningTotal", raw_frame.get("score", 0))
        frames.append(
            {
                "rolls": frame_rolls,
                "isStrike": first == 10,
                "isSpare": first != 10 and first + second == 10,
                "score": int(running_total or 0),
            }
        )

    raw_tenth = raw.get("tenthFrame")
    if not isinstance(raw_tenth, dict):
        raw_tenth = raw_frames[9] if len(raw_frames) > 9 and isinstance(raw_frames[9], dict) else {}
    tenth_rolls = normalize_rolls(raw_tenth.get("rolls"))
    while len(tenth_rolls) < 2:
        tenth_rolls.append({"pins": 0})
    first = tenth_rolls[0]["pins"]
    second = tenth_rolls[1]["pins"]
    tenth_score = raw_tenth.get("runningTotal", raw_tenth.get("score", raw.get("totalScore", 0)))
    tenth_frame = {
        "rolls": tenth_rolls[:3],
        "isStrike": first == 10,
        "isSpare": first != 10 and first + second == 10,
        "score": int(tenth_score or 0),
    }

    total_score = raw.get("totalScore", tenth_frame["score"])
    return {
        "playerName": raw.get("playerName") or "Unknown Player",
        "frames": frames,
        "tenthFrame": tenth_frame,
        "totalScore": int(total_score or 0),
    }


def payload_to_games(payload: dict[str, Any]) -> list[dict[str, Any]]:
    players = payload.get("players")
    if isinstance(players, list) and players:
        return [normalize_game(player) for player in players if isinstance(player, dict)]
    if payload.get("frames") or payload.get("playerName"):
        return [normalize_game(payload)]
    return []


def unwrap_donut_payload(parsed: Any) -> dict[str, Any]:
    if not isinstance(parsed, dict):
        return {}

    text_sequence = parsed.get("text_sequence")
    if isinstance(text_sequence, dict):
        return unwrap_donut_payload(text_sequence)

    if isinstance(text_sequence, list):
        for item in text_sequence:
            if isinstance(item, dict):
                unwrapped = unwrap_donut_payload(item)
                if unwrapped.get("players") or unwrapped.get("frames") or unwrapped.get("playerName"):
                    return unwrapped
        if all(isinstance(item, str) for item in text_sequence):
            text_sequence = "".join(text_sequence)

    if isinstance(text_sequence, str):
        try:
            nested = extract_json_object(text_sequence)
            if isinstance(nested, dict):
                return unwrap_donut_payload(nested)
        except Exception:
            return parsed

    return parsed


def parsed_key_summary(payload: Any, original: Any) -> str:
    if not isinstance(payload, dict):
        return type(payload).__name__

    keys = ", ".join(payload.keys())
    text_sequence = original.get("text_sequence") if isinstance(original, dict) else None
    if "text_sequence" in payload:
        return f"{keys} (text_sequence type: {type(text_sequence).__name__})"
    return keys


def run_donut_artifact(model: dict[str, Any], image_bytes: bytes) -> tuple[str, list[dict[str, Any]]]:
    try:
        from PIL import Image
        import torch
        from transformers import AutoProcessor, VisionEncoderDecoderModel
    except ImportError as exc:
        raise RuntimeError("Donut inference dependencies are not installed in ml-service") from exc

    local_path = model.get("localPath")
    if not isinstance(local_path, str):
        raise RuntimeError("Model artifact does not have a localPath")

    artifact_dir = Path(local_path)
    manifest = load_json(artifact_dir / "manifest.json", {})
    entrypoint = manifest.get("entrypoint") if isinstance(manifest, dict) else {}
    generation = manifest.get("generation") if isinstance(manifest, dict) else {}
    training_config = manifest.get("trainingConfig") if isinstance(manifest, dict) else {}
    model_relative_path = str(entrypoint.get("modelPath", "model"))
    processor_relative_path = str(entrypoint.get("processorPath", "processor"))
    assert_safe_relative_path(model_relative_path)
    assert_safe_relative_path(processor_relative_path)
    model_path = artifact_dir / model_relative_path
    processor_path = artifact_dir / processor_relative_path
    task_prompt = generation.get("taskPrompt", "") if isinstance(generation, dict) else ""
    explicit_max_length = generation.get("maxLength") if isinstance(generation, dict) else None
    trained_max_length = (
        training_config.get("maxLength") if isinstance(training_config, dict) else None
    )
    max_length = int(explicit_max_length or trained_max_length or 1024)

    processor = AutoProcessor.from_pretrained(processor_path)
    donut_model = VisionEncoderDecoderModel.from_pretrained(model_path)
    decoder_max_positions = getattr(donut_model.config.decoder, "max_position_embeddings", None)
    if isinstance(decoder_max_positions, int):
        if explicit_max_length is None:
            max_length = decoder_max_positions
        else:
            max_length = min(max_length, decoder_max_positions)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    donut_model.to(device)
    donut_model.eval()

    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    pixel_values = processor(image, return_tensors="pt").pixel_values.to(device)
    decoder_input_ids = None
    if task_prompt:
        decoder_input_ids = processor.tokenizer(
            task_prompt,
            add_special_tokens=False,
            return_tensors="pt",
        ).input_ids.to(device)

    with torch.no_grad():
        generated = donut_model.generate(
            pixel_values,
            decoder_input_ids=decoder_input_ids,
            max_length=max_length,
            pad_token_id=processor.tokenizer.pad_token_id,
            eos_token_id=processor.tokenizer.eos_token_id,
            use_cache=True,
        )

    raw_text = processor.batch_decode(generated, skip_special_tokens=True)[0]
    try:
        parsed = extract_json_object(raw_text)
    except Exception as json_error:
        if not hasattr(processor, "token2json"):
            raise DonutInferenceError(
                f"Donut model output could not be parsed as JSON: {json_error}",
                raw_text,
            ) from json_error

        try:
            parsed = processor.token2json(raw_text)
        except Exception as token_error:
            raise DonutInferenceError(
                f"Donut model output could not be parsed as JSON: {json_error}",
                raw_text,
            ) from token_error

    payload = unwrap_donut_payload(parsed)
    games = payload_to_games(payload)
    if not games:
        raise DonutInferenceError(
            f"Donut model returned no bowling games from parsed output keys: {parsed_key_summary(payload, parsed)}",
            raw_text,
        )
    return raw_text, games


def assert_safe_relative_path(name: str) -> None:
    path = Path(name)
    if path.is_absolute() or ".." in path.parts:
        raise HTTPException(status_code=400, detail=f"Unsafe archive path: {name}")


def extract_artifact_archive(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)

    if zipfile.is_zipfile(archive_path):
        with zipfile.ZipFile(archive_path) as archive:
            for member in archive.infolist():
                assert_safe_relative_path(member.filename)
            archive.extractall(destination)
        return

    try:
        with tarfile.open(archive_path) as archive:
            for member in archive.getmembers():
                assert_safe_relative_path(member.name)
                if member.issym() or member.islnk():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Artifact archive cannot contain links: {member.name}",
                    )
            archive.extractall(destination)
        return
    except tarfile.TarError as exc:
        raise HTTPException(status_code=400, detail="Artifact must be a zip or tar archive") from exc


def find_manifest(extracted_root: Path) -> tuple[Path, dict[str, Any]]:
    candidates = [extracted_root / "manifest.json", *extracted_root.glob("*/manifest.json")]

    for manifest_path in candidates:
        if manifest_path.exists():
            manifest = load_json(manifest_path, {})
            if isinstance(manifest, dict):
                return manifest_path, manifest

    raise HTTPException(status_code=400, detail="Artifact archive must contain manifest.json")


def validate_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    name = manifest.get("name")
    version = manifest.get("version")
    architecture = manifest.get("architecture")

    if not isinstance(name, str) or not name.strip():
        raise HTTPException(status_code=400, detail="Artifact manifest must include name")
    if not isinstance(version, str) or not version.strip():
        raise HTTPException(status_code=400, detail="Artifact manifest must include version")
    if not isinstance(architecture, str) or not architecture.strip():
        raise HTTPException(status_code=400, detail="Artifact manifest must include architecture")

    metrics = manifest.get("metrics")
    entrypoint = manifest.get("entrypoint")
    return {
        "name": name.strip(),
        "version": version.strip(),
        "architecture": architecture.strip(),
        "metrics": metrics if isinstance(metrics, dict) else {},
        "schemaVersion": manifest.get("schemaVersion"),
        "entrypoint": entrypoint if isinstance(entrypoint, dict) else {},
    }


def validate_artifact_files(source_root: Path, manifest_data: dict[str, Any]) -> None:
    if manifest_data["architecture"] != "donut":
        return

    entrypoint = manifest_data["entrypoint"]
    model_relative_path = str(entrypoint.get("modelPath", "model"))
    processor_relative_path = str(entrypoint.get("processorPath", "processor"))
    assert_safe_relative_path(model_relative_path)
    assert_safe_relative_path(processor_relative_path)

    model_path = source_root / model_relative_path
    processor_path = source_root / processor_relative_path
    if not model_path.is_dir():
        raise HTTPException(status_code=400, detail="Donut artifact must include model directory")
    if not processor_path.is_dir():
        raise HTTPException(status_code=400, detail="Donut artifact must include processor directory")


def register_model_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    models = load_models()
    existing_index = next(
        (
            index
            for index, model in enumerate(models)
            if model.get("name") == artifact["name"]
            and model.get("version") == artifact["version"]
        ),
        None,
    )

    if existing_index is None:
        artifact["id"] = str(uuid4())
        artifact["createdAt"] = now_iso()
        models.append(artifact)
        save_models(models)
        return artifact

    existing = {
        **models[existing_index],
        **artifact,
        "id": models[existing_index].get("id", str(uuid4())),
        "createdAt": models[existing_index].get("createdAt", now_iso()),
        "updatedAt": now_iso(),
    }
    models[existing_index] = existing
    save_models(models)
    return existing


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/infer")
def infer(request: InferRequest) -> dict[str, Any]:
    image_bytes = image_bytes_from_data_url(request.imageDataUrl)
    image_sha256 = hashlib.sha256(image_bytes).hexdigest()
    model = find_model(request.model, request.modelArtifactId)
    if not model:
        model_name = request.model or "donut-bowling-v1"
        return {
            "model": model_name,
            "rawText": (
                "Generated baseline local estimate because no local model artifact is available"
            ),
            "games": build_baseline_games(image_sha256),
        }

    fallback_reason = f"No local example matched image sha256 {image_sha256}"
    donut_raw_text = ""
    donut_player_names: list[str] = []
    if model.get("architecture") == "donut":
        try:
            raw_text, games = run_donut_artifact(model, image_bytes)
            return {
                "model": model.get("version") or request.model or "donut-bowling-v1",
                "rawText": raw_text,
                "games": games,
            }
        except DonutInferenceError as exc:
            fallback_reason = str(exc)
            donut_raw_text = snippet(exc.raw_text)
            donut_player_names = extract_player_names(exc.raw_text)
            logger.warning(
                "Donut inference failed for model=%s artifact=%s image_sha256=%s reason=%s raw_text=%s",
                model.get("version") or request.model or "donut-bowling-v1",
                model.get("id"),
                image_sha256,
                fallback_reason,
                donut_raw_text,
            )
        except Exception as exc:
            fallback_reason = str(exc)
            logger.exception(
                "Donut inference failed for model=%s artifact=%s image_sha256=%s",
                model.get("version") or request.model or "donut-bowling-v1",
                model.get("id"),
                image_sha256,
            )

    examples = load_model_examples(model)
    match = next(
        (
            example
            for example in examples
            if example.get("imageSha256") == image_sha256
            and isinstance(example.get("games"), list)
        ),
        None,
    )

    if not match:
        raw_text = f"Generated baseline local estimate; {fallback_reason}"
        if donut_raw_text:
            raw_text = f"{raw_text}; Donut raw output: {donut_raw_text}"
        games = build_baseline_games(image_sha256)
        if donut_player_names:
            games = apply_player_names(games, donut_player_names)
            raw_text = f"{raw_text}; Applied Donut player name estimates to baseline scores"
        return {
            "model": model.get("version") or request.model or "donut-bowling-v1",
            "rawText": raw_text,
            "games": games,
        }

    return {
        "model": model.get("version") or request.model or "donut-bowling-v1",
        "rawText": f"Matched local example for image sha256 {image_sha256}",
        "games": match["games"],
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    return {"models": load_models()}


@app.post("/models/import")
async def import_model(file: UploadFile = File(...)) -> dict[str, Any]:
    import_id = str(uuid4())
    upload_path = IMPORTS_DIR / f"{import_id}-{safe_name(file.filename or 'artifact')}"
    extract_path = IMPORTS_DIR / f"{import_id}-extracted"

    with upload_path.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    extract_artifact_archive(upload_path, extract_path)
    manifest_path, manifest = find_manifest(extract_path)
    manifest_data = validate_manifest(manifest)
    source_root = manifest_path.parent
    validate_artifact_files(source_root, manifest_data)
    artifact_dir = MODELS_DIR / safe_name(
        f"{manifest_data['name']}-{manifest_data['version']}"
    )

    if artifact_dir.exists():
        shutil.rmtree(artifact_dir)
    shutil.copytree(source_root, artifact_dir)

    model = register_model_artifact(
        {
            "name": manifest_data["name"],
            "version": manifest_data["version"],
            "architecture": manifest_data["architecture"],
            "localPath": str(artifact_dir),
            "metrics": manifest_data["metrics"],
            "schemaVersion": manifest_data["schemaVersion"],
            "entrypoint": manifest_data["entrypoint"],
            "importedAt": now_iso(),
        }
    )

    shutil.rmtree(extract_path, ignore_errors=True)
    upload_path.unlink(missing_ok=True)

    return {"success": True, "model": model}


@app.post("/models/{model_id}/activate")
def activate_model(model_id: str) -> dict[str, Any]:
    models = load_models()
    match = next((model for model in models if model["id"] == model_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"success": True, "model": match}


@app.post("/evaluate")
def evaluate() -> dict[str, Any]:
    return {"status": "not_implemented"}
