#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoProcessor,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
    VisionEncoderDecoderModel,
)


class BowlingDonutDataset(Dataset):
    def __init__(self, split_dir: Path, processor: Any, max_length: int) -> None:
        self.split_dir = split_dir
        self.processor = processor
        self.max_length = max_length
        metadata_path = split_dir / "metadata.jsonl"
        self.rows = [
            json.loads(line)
            for line in metadata_path.read_text("utf-8").splitlines()
            if line.strip()
        ]

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        row = self.rows[index]
        image = Image.open(self.split_dir / row["file_name"]).convert("RGB")
        pixel_values = self.processor(image, return_tensors="pt").pixel_values.squeeze(0)
        labels = self.processor.tokenizer(
            row["ground_truth"],
            add_special_tokens=True,
            max_length=self.max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        ).input_ids.squeeze(0)
        labels[labels == self.processor.tokenizer.pad_token_id] = -100
        return {"pixel_values": pixel_values, "labels": labels}


@dataclass
class DataCollator:
    def __call__(self, features: list[dict[str, torch.Tensor]]) -> dict[str, torch.Tensor]:
        return {
            "pixel_values": torch.stack([feature["pixel_values"] for feature in features]),
            "labels": torch.stack([feature["labels"] for feature in features]),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune Donut for bowling score JSON.")
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--base-model", default="naver-clova-ix/donut-base")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--learning-rate", type=float, default=5e-5)
    parser.add_argument("--max-length", type=int, default=1024)
    parser.add_argument("--save-steps", type=int, default=100)
    args = parser.parse_args()

    processor = AutoProcessor.from_pretrained(args.base_model)
    model = VisionEncoderDecoderModel.from_pretrained(args.base_model)

    if model.config.decoder_start_token_id is None:
        model.config.decoder_start_token_id = processor.tokenizer.bos_token_id
    if model.config.pad_token_id is None:
        model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.max_length = args.max_length

    train_dataset = BowlingDonutDataset(args.dataset / "train", processor, args.max_length)
    validation_path = args.dataset / "validation" / "metadata.jsonl"
    eval_dataset = (
        BowlingDonutDataset(args.dataset / "validation", processor, args.max_length)
        if validation_path.exists() and validation_path.read_text("utf-8").strip()
        else None
    )

    training_args = Seq2SeqTrainingArguments(
        output_dir=str(args.out / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        save_steps=args.save_steps,
        logging_steps=10,
        evaluation_strategy="steps" if eval_dataset else "no",
        eval_steps=args.save_steps if eval_dataset else None,
        predict_with_generate=False,
        remove_unused_columns=False,
        fp16=torch.cuda.is_available(),
        report_to=[],
    )

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=DataCollator(),
    )
    trainer.train()

    model_dir = args.out / "model"
    processor_dir = args.out / "processor"
    model_dir.mkdir(parents=True, exist_ok=True)
    processor_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(model_dir)
    processor.save_pretrained(processor_dir)

    dataset_summary = json.loads((args.dataset / "dataset-summary.json").read_text("utf-8"))
    metrics = {
        "datasetImageCount": dataset_summary.get("imageCount"),
        "datasetCorrectionCount": dataset_summary.get("correctionCount"),
        "trainCount": dataset_summary.get("trainCount"),
        "validationCount": dataset_summary.get("validationCount"),
        "baseModel": args.base_model,
    }
    (args.out / "metrics.json").write_text(json.dumps(metrics, indent=2), "utf-8")
    (args.out / "training-config.json").write_text(
        json.dumps(
            {
                "baseModel": args.base_model,
                "epochs": args.epochs,
                "batchSize": args.batch_size,
                "learningRate": args.learning_rate,
                "maxLength": args.max_length,
            },
            indent=2,
        ),
        "utf-8",
    )
    print(json.dumps({"run": str(args.out), "metrics": metrics}, indent=2))


if __name__ == "__main__":
    main()
