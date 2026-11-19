#!/usr/bin/env python3
"""Generate V4 voxel code using the fine-tuned model.

Usage: python3 generate-v4.py "a warrior standing"
       python3 generate-v4.py "a dancing robot" --model v4-model
"""

import os
import sys
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

prompt = sys.argv[1] if len(sys.argv) > 1 else "a person standing"
model_dir = os.path.join(SCRIPT_DIR, "v4-model")

for i, arg in enumerate(sys.argv[1:], 1):
    if arg == "--model" and i < len(sys.argv) - 1:
        model_dir = sys.argv[i + 1]

print(f"Prompt: {prompt}")
print(f"Model: {model_dir}")

# Load
config_path = os.path.join(model_dir, "adapter_config.json")
import json
with open(config_path) as f:
    config = json.load(f)
base_model_name = config["base_model_name_or_path"]

print(f"Loading base model: {base_model_name}")
tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
base_model = AutoModelForCausalLM.from_pretrained(
    base_model_name,
    torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
    trust_remote_code=True,
)
model = PeftModel.from_pretrained(base_model, model_dir)
model.eval()

if torch.cuda.is_available():
    device = "cuda"
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    device = "mps"
else:
    device = "cpu"
model = model.to(device)

# Generate
SYSTEM_PROMPT = """You are a V4 voxel model generator. Output ONLY valid V4 code.
V4 primitives: V (grid size), B (box), S (sphere), C (cylinder), K (cone), P (point), E (ellipsoid).
Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray"""

input_text = f"### System:\n{SYSTEM_PROMPT}\n\n### User:\nGenerate a V4 voxel model of: {prompt}\n\n### Assistant:\n"

inputs = tokenizer(input_text, return_tensors="pt").to(device)

print("Generating...")
with torch.no_grad():
    outputs = model.generate(
        **inputs,
        max_new_tokens=512,
        temperature=0.7,
        top_p=0.9,
        do_sample=True,
        repetition_penalty=1.1,
    )

result = tokenizer.decode(outputs[0], skip_special_tokens=True)
# Extract just the assistant's response
if "### Assistant:" in result:
    code = result.split("### Assistant:")[-1].strip()
else:
    code = result[len(input_text):].strip()

print(f"\n--- Generated V4 Code ({len(code.splitlines())} lines) ---")
print(code)

# Also save to file
out_path = os.path.join(SCRIPT_DIR, "generated.v4")
with open(out_path, "w") as f:
    f.write(code)
print(f"\nSaved to {out_path}")
