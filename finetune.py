#!/usr/bin/env python3
"""Fine-tune a small model on V4 voxel code.

Usage: python3 finetune.py [--model MODEL] [--epochs 3]

Models (by size):
  SmolLM2-135M   ~270MB  (fastest, least capable)
  SmolLM2-360M   ~720MB  (good balance)
  Qwen2.5-0.5B   ~1GB   (best for code)
"""

import os
import sys
import json
import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model, TaskType

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Parse args
model_name = "HuggingFaceTB/SmolLM2-360M"
epochs = 3
for i, arg in enumerate(sys.argv[1:], 1):
    if arg == "--model" and i < len(sys.argv) - 1:
        model_name = sys.argv[i + 1]
    if arg == "--epochs" and i < len(sys.argv) - 1:
        epochs = int(sys.argv[i + 1])

# Auto-detect device
if torch.cuda.is_available():
    device = "cuda"
    dtype = torch.bfloat16
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    device = "mps"
    dtype = torch.float32
else:
    device = "cpu"
    dtype = torch.float32

print(f"Model: {model_name}")
print(f"Epochs: {epochs}")
print(f"Device: {device}")

# Load training data
train_file = os.path.join(SCRIPT_DIR, "train.jsonl")
samples = []
with open(train_file) as f:
    for line in f:
        samples.append(json.loads(line))

print(f"Training samples: {len(samples)}")

# Load tokenizer and model
print(f"\nLoading {model_name}...")
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=dtype,
    trust_remote_code=True,
)

# Apply LoRA
print("Applying LoRA...")
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Format data as instruction-following
SYSTEM_PROMPT = """You are a V4 voxel model generator. Output ONLY valid V4 code.
V4 primitives: V (grid size), B (box), S (sphere), C (cylinder), K (cone), P (point), E (ellipsoid).
Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray"""

def format_sample(sample):
    text = f"### System:\n{SYSTEM_PROMPT}\n\n### User:\n{sample['instruction']}\n\n### Assistant:\n{sample['output']}{tokenizer.eos_token}"
    return text

# Tokenize
def tokenize(examples):
    texts = [format_sample({"instruction": i, "output": o})
             for i, o in zip(examples["instruction"], examples["output"])]
    tokenized = tokenizer(
        texts,
        truncation=True,
        max_length=512,
        padding="max_length",
    )
    tokenized["labels"] = tokenized["input_ids"].copy()
    return tokenized

dataset = Dataset.from_list(samples)
tokenized_dataset = dataset.map(tokenize, batched=True, remove_columns=dataset.column_names)

print(f"Tokenized samples: {len(tokenized_dataset)}")

# Training args — adapt to device
batch_size = 4 if device == "cuda" else 1
grad_accum = 2 if device == "cuda" else 8
use_bf16 = device == "cuda"

output_dir = os.path.join(SCRIPT_DIR, "v4-model")

training_args = TrainingArguments(
    output_dir=output_dir,
    num_train_epochs=epochs,
    per_device_train_batch_size=batch_size,
    gradient_accumulation_steps=grad_accum,
    learning_rate=2e-4,
    warmup_steps=10,
    logging_steps=10,
    save_steps=50,
    save_total_limit=2,
    fp16=False,
    bf16=use_bf16,
    dataloader_pin_memory=(device == "cuda"),
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
)

print(f"\nStarting training on {device}...")
trainer.train()

# Save
model.save_pretrained(output_dir)
tokenizer.save_pretrained(output_dir)
print(f"\nModel saved to {output_dir}")
print(f"Size: {sum(os.path.getsize(os.path.join(output_dir, f)) for f in os.listdir(output_dir)) / 1024 / 1024:.1f}MB")
