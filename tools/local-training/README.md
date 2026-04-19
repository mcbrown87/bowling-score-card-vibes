# Local Training Workflow

This directory contains the offline workflow for training a local scorecard model from the
admin dataset export.

## Inputs

Download the training dataset from the deployed admin console:

```text
/admin -> Download training dataset
```

The export is a zip file with normalized scorecard images and corrected target JSON.

```text
bowling-validated-scores.zip
  manifest.json
  examples.jsonl
  images/*.jpg
  labels/*.json
```

## Prepare a Hugging Face style dataset

```bash
python3 tools/local-training/prepare_dataset.py \
  --export ./bowling-validated-scores.zip \
  --out ./.local-models/dataset
```

This writes:

```text
.local-models/dataset/
  train/
    images/*.jpg
    metadata.jsonl
  validation/
    images/*.jpg
    metadata.jsonl
  dataset-summary.json
```

Each metadata row contains `file_name` and `ground_truth`.

## Install training dependencies

Use a Python environment outside the app container. GPU is strongly preferred.

```bash
python3 -m venv .venv-local-training
source .venv-local-training/bin/activate
pip install -r tools/local-training/requirements.txt
```

On Intel macOS, PyTorch's pip index currently tops out at the `2.2.x` wheel series, so the
requirements file uses that compatible wheel on `Darwin x86_64`, pins NumPy below 2 for that
wheel family, and keeps Transformers on a version that still accepts Torch 2.2.

## Train

```bash
python3 tools/local-training/train_donut.py \
  --dataset ./.local-models/dataset \
  --base-model naver-clova-ix/donut-base \
  --out ./.local-models/runs/bowling-donut-001 \
  --epochs 5 \
  --batch-size 1
```

The first few runs may be inaccurate. The point is to produce a loadable image-to-JSON model
that can improve as the correction dataset grows.

## Package for upload

```bash
python3 tools/local-training/package_artifact.py \
  --run ./.local-models/runs/bowling-donut-001 \
  --name bowling-donut \
  --version 2026-04-12-001 \
  --out ./.local-models/artifacts/bowling-donut-2026-04-12-001.model.zip
```

Upload the archive in `/admin` using **Import trained artifact**, then activate it under
**Imported model artifacts**.

## Enable Donut Inference In The Deployed ML Service

The default development ML service image stays lightweight and will fall back to baseline local
estimates if Donut runtime dependencies are not installed. For a deployed system that should run
uploaded Donut artifacts, build the ML service with:

```bash
INSTALL_DONUT_DEPS=true docker compose build ml-service
```

That installs the heavier Torch/Transformers runtime from `ml-service/requirements-donut.txt`.

## Artifact Contract

The archive must include:

```text
manifest.json
model/
processor/
metrics.json
training-config.json
```

Minimum manifest:

```json
{
  "schemaVersion": "bowling-local-model-artifact-v1",
  "name": "bowling-donut",
  "version": "2026-04-12-001",
  "architecture": "donut",
  "framework": "transformers",
  "task": "image-to-bowling-json",
  "entrypoint": {
    "modelPath": "model",
    "processorPath": "processor"
  },
  "metrics": {
    "datasetImageCount": 100,
    "datasetCorrectionCount": 240
  }
}
```
