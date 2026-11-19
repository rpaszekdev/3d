#!/usr/bin/env python3
"""End-to-end V4 fine-tuning pipeline for RunPod.

Run on RunPod with A40/A100:
  pip install unsloth objaverse trimesh Pillow
  python3 runpod-train.py

Steps:
  1. Download colorful Objaverse models (LVIS-filtered)
  2. Voxelize with colors at 48³
  3. Build ChatML training data
  4. Fine-tune Qwen3.5-27B with QLoRA via Unsloth
  5. Test generation
"""

import os
import sys
import json
import glob
import random
import numpy as np

# ============================================================
# CONFIG
# ============================================================
MODEL_NAME = "Qwen/Qwen3.5-27B"
RESOLUTION = 48
MAX_MODELS = 2000
MIN_VOXELS = 100
MAX_SEQ_LEN = 2048
EPOCHS = 3
LORA_RANK = 32
LORA_ALPHA = 64
LEARNING_RATE = 2e-4
BATCH_SIZE = 1
GRAD_ACCUM = 16
OUTPUT_DIR = "/workspace/v4-model-qwen"
V4_DIR = "/workspace/v4-data"
TRAIN_FILE = "/workspace/train.jsonl"
VAL_FILE = "/workspace/val.jsonl"

# Colorful LVIS categories (skip statues, sculptures, gray things)
COLORFUL_CATEGORIES = [
    'car_(automobile)', 'airplane', 'helicopter', 'motorcycle', 'bicycle',
    'truck', 'bus_(vehicle)', 'boat', 'train_(railroad_vehicle)',
    'bird', 'cat', 'dog', 'fish', 'frog', 'turtle', 'rabbit',
    'elephant', 'giraffe', 'lion', 'tiger', 'bear', 'monkey',
    'butterfly', 'dragon', 'dinosaur', 'horse', 'cow', 'sheep',
    'chicken_(animal)', 'duck', 'penguin', 'parrot', 'eagle',
    'flower_arrangement', 'sunflower', 'mushroom', 'pumpkin',
    'apple', 'banana', 'strawberry', 'watermelon', 'cherry',
    'hamburger', 'pizza', 'cake', 'cupcake', 'icecream', 'doughnut',
    'chair', 'sofa', 'bed', 'table', 'lamp', 'bookcase', 'dresser',
    'guitar', 'piano', 'drum_(musical_instrument)', 'violin',
    'teddy_bear', 'toy', 'doll', 'robot', 'puppet',
    'shoe', 'boot', 'hat', 'crown', 'helmet',
    'sword', 'shield', 'gun', 'rifle',
    'fire_engine', 'ambulance', 'tractor_(farm_equipment)',
    'Christmas_tree', 'snowman', 'jack-o-lantern',
    'robot', 'rocket', 'spacecraft',
    'teapot', 'cup', 'vase', 'bottle', 'mug',
    'basketball', 'soccer_ball', 'football_(American)',
    'race_car', 'convertible_(automobile)', 'jeep',
    'owl', 'flamingo', 'dolphin', 'shark', 'octopus_(animal)',
    'spider', 'snake', 'lizard', 'gorilla', 'zebra',
    'pineapple', 'orange_(fruit)', 'lemon', 'grape',
    'hotdog', 'taco', 'burrito', 'sandwich',
    'fire_extinguisher', 'traffic_light', 'stop_sign',
    'windmill', 'lighthouse', 'castle',
]

# V4 16-color palette
PALETTE = np.array([
    [0, 0, 0],         # 0 black
    [255, 50, 50],      # 1 red
    [50, 200, 50],      # 2 green
    [50, 100, 255],     # 3 blue
    [0, 200, 200],      # 4 cyan
    [200, 50, 200],     # 5 magenta
    [255, 200, 0],      # 6 yellow
    [255, 130, 0],      # 7 orange
    [240, 240, 240],    # 8 white
    [130, 130, 130],    # 9 gray
    [141, 110, 74],     # a brown
    [255, 158, 181],    # b pink
    [46, 125, 50],      # c dark green
    [212, 184, 150],    # d tan/beige
    [139, 26, 26],      # e maroon
    [26, 58, 107],      # f navy
], dtype=np.float32)
COLOR_KEYS = '0123456789abcdef'

SYSTEM_PROMPT = """You are a V4 voxel 3D model generator. Output ONLY valid V4 code — no explanation, no markdown.

PRIMITIVES:
V W H D          -- grid size (always V 48 48 48)
B X Y Z W H D C  -- box at position (X,Y,Z) with size (W,H,D) and color C
S X Y Z R C      -- sphere at center (X,Y,Z) with radius R and color C
C X Y Z R H C    -- cylinder at (X,Y,Z) with radius R, height H, color C
K X Y Z R H C    -- cone at base (X,Y,Z) with radius R, height H, color C
E X Y Z RX RY RZ C -- ellipsoid with radii (RX,RY,RZ) and color C
G name / /G      -- define named group
@ name X Y Z     -- place group copy at offset

COLORS: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray a=brown b=pink c=dark_green d=tan e=maroon f=navy

Y is up. Y=0 is the ground. Center objects around X=24, Z=24."""

# ============================================================
# STEP 1: Download Objaverse models
# ============================================================
def step1_download():
    import objaverse

    print("\n" + "="*60)
    print("STEP 1: Downloading colorful Objaverse models")
    print("="*60)

    print("Loading LVIS annotations...")
    lvis = objaverse.load_lvis_annotations()

    # Collect UIDs from colorful categories
    uids = []
    uid_to_cat = {}
    for cat in COLORFUL_CATEGORIES:
        if cat in lvis:
            for uid in lvis[cat]:
                if uid not in uid_to_cat:
                    uid_to_cat[uid] = cat
                    uids.append(uid)

    print(f"Found {len(uids)} models in {len(COLORFUL_CATEGORIES)} categories")

    # Shuffle and limit
    random.seed(42)
    random.shuffle(uids)
    uids = uids[:MAX_MODELS]
    print(f"Downloading {len(uids)} models...")

    # Load annotations for names
    print("Loading full annotations for names...")
    annotations = objaverse.load_annotations()

    # Download
    objects = objaverse.load_objects(uids=uids, download_processes=4)
    print(f"Downloaded: {len(objects)} models")

    # Save metadata
    meta = {}
    for uid, path in objects.items():
        name = annotations.get(uid, {}).get("name", uid[:20])
        cat = uid_to_cat.get(uid, "unknown")
        meta[uid] = {"name": name, "category": cat, "path": path}

    with open("/workspace/model_meta.json", "w") as f:
        json.dump(meta, f)

    return meta

# ============================================================
# STEP 2: Voxelize with colors
# ============================================================
def rgb_to_palette(r, g, b):
    diff = PALETTE - np.array([r, g, b], dtype=np.float32)
    return int(np.argmin(np.sum(diff**2, axis=1)))

def resolve_scene_colors(scene):
    import trimesh
    meshes = []
    for name, geom in scene.geometry.items():
        try:
            if hasattr(geom.visual, 'to_color'):
                geom.visual = geom.visual.to_color()
        except Exception:
            n_verts = len(geom.vertices)
            geom.visual = trimesh.visual.ColorVisuals(
                vertex_colors=np.full((n_verts, 4), [130, 130, 130, 255], dtype=np.uint8)
            )
        meshes.append(geom)
    if len(meshes) == 1:
        return meshes[0]
    return trimesh.util.concatenate(meshes)

def voxelize_one(glb_path, resolution):
    import trimesh

    scene = trimesh.load(glb_path, force='scene')
    mesh = resolve_scene_colors(scene) if isinstance(scene, trimesh.Scene) else scene

    if not hasattr(mesh, 'vertices') or len(mesh.vertices) == 0:
        return None

    vc = None
    if hasattr(mesh.visual, 'vertex_colors') and mesh.visual.vertex_colors is not None:
        vc = mesh.visual.vertex_colors[:, :3].astype(np.float32)

    bounds = mesh.bounds
    extent = bounds[1] - bounds[0]
    max_dim = extent.max()
    if max_dim == 0:
        return None
    scale = (resolution - 2) / max_dim

    # Auto-detect Y/Z swap
    swap_yz = extent[2] > extent[1]

    n_samples = max(resolution**2 * 4, 50000)
    points, face_indices = trimesh.sample.sample_surface(mesh, count=n_samples)

    grid = np.full((resolution, resolution, resolution), -1, dtype=np.int8)
    color_sum = np.zeros((resolution, resolution, resolution, 3), dtype=np.float64)
    color_count = np.zeros((resolution, resolution, resolution), dtype=np.int32)

    for j in range(len(points)):
        pt = points[j]
        gx = int(round((pt[0] - bounds[0][0]) * scale + 1))
        if swap_yz:
            gy = int(round((pt[2] - bounds[0][2]) * scale + 1))
            gz = int(round((pt[1] - bounds[0][1]) * scale + 1))
        else:
            gy = int(round((pt[1] - bounds[0][1]) * scale + 1))
            gz = int(round((pt[2] - bounds[0][2]) * scale + 1))

        if 0 <= gx < resolution and 0 <= gy < resolution and 0 <= gz < resolution:
            fi = face_indices[j]
            if vc is not None and fi < len(mesh.faces):
                v_ids = mesh.faces[fi]
                v_ids = v_ids[v_ids < len(vc)]
                if len(v_ids) > 0:
                    r = vc[v_ids, 0].mean()
                    g = vc[v_ids, 1].mean()
                    b = vc[v_ids, 2].mean()
                else:
                    r, g, b = 130, 130, 130
            else:
                r, g, b = 130, 130, 130

            color_sum[gx, gy, gz] += [r, g, b]
            color_count[gx, gy, gz] += 1
            grid[gx, gy, gz] = 0

    # Flood fill exterior
    exterior = np.zeros_like(grid, dtype=bool)
    queue = [(0, 0, 0)]
    exterior[0, 0, 0] = True
    dirs = [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    while queue:
        cx, cy, cz = queue.pop()
        for dx, dy, dz in dirs:
            nx, ny, nz = cx+dx, cy+dy, cz+dz
            if 0 <= nx < resolution and 0 <= ny < resolution and 0 <= nz < resolution:
                if not exterior[nx, ny, nz] and grid[nx, ny, nz] < 0:
                    exterior[nx, ny, nz] = True
                    queue.append((nx, ny, nz))

    # Fill interior
    for x in range(resolution):
        for y in range(resolution):
            for z in range(resolution):
                if grid[x, y, z] < 0 and not exterior[x, y, z]:
                    grid[x, y, z] = 0

    # Assign palette colors
    for x in range(resolution):
        for y in range(resolution):
            for z in range(resolution):
                if grid[x, y, z] >= 0:
                    if color_count[x, y, z] > 0:
                        avg = color_sum[x, y, z] / color_count[x, y, z]
                        grid[x, y, z] = rgb_to_palette(avg[0], avg[1], avg[2])
                    else:
                        grid[x, y, z] = 9

    return grid

def greedy_compress(grid, resolution):
    used = np.zeros_like(grid, dtype=bool)
    boxes = []
    for y in range(resolution):
        for z in range(resolution):
            for x in range(resolution):
                c = grid[x, y, z]
                if c < 0 or used[x, y, z]:
                    continue
                ex = x
                while ex+1 < resolution and grid[ex+1,y,z] == c and not used[ex+1,y,z]: ex += 1
                ez = z
                ok = True
                while ok and ez+1 < resolution:
                    for xx in range(x, ex+1):
                        if grid[xx,y,ez+1] != c or used[xx,y,ez+1]: ok = False; break
                    if ok: ez += 1
                ey = y
                ok = True
                while ok and ey+1 < resolution:
                    for xx in range(x, ex+1):
                        for zz in range(z, ez+1):
                            if grid[xx,ey+1,zz] != c or used[xx,ey+1,zz]: ok = False; break
                        if not ok: break
                    if ok: ey += 1
                used[x:ex+1, y:ey+1, z:ez+1] = True
                boxes.append((x, y, z, ex-x+1, ey-y+1, ez-z+1, int(c)))
    return boxes

def step2_voxelize(meta):
    print("\n" + "="*60)
    print("STEP 2: Voxelizing with colors")
    print("="*60)

    os.makedirs(V4_DIR, exist_ok=True)
    converted = failed = colorful = 0

    for uid, info in meta.items():
        path = info["path"]
        v4_path = os.path.join(V4_DIR, f"{uid}.v4")

        if os.path.exists(v4_path):
            converted += 1
            continue

        try:
            grid = voxelize_one(path, RESOLUTION)
            if grid is None or int((grid >= 0).sum()) < MIN_VOXELS:
                failed += 1
                continue

            boxes = greedy_compress(grid, RESOLUTION)
            unique_colors = len(set(b[6] for b in boxes))
            if unique_colors > 1:
                colorful += 1

            lines = [f"-- {info['name']}", f"V {RESOLUTION} {RESOLUTION} {RESOLUTION}"]
            for bx, by, bz, bw, bh, bd, bc in boxes:
                cc = COLOR_KEYS[bc] if bc < len(COLOR_KEYS) else str(bc)
                lines.append(f"B {bx} {by} {bz} {bw} {bh} {bd} {cc}")

            with open(v4_path, "w") as f:
                f.write("\n".join(lines))

            converted += 1
            if converted % 100 == 0:
                print(f"  {converted} converted, {failed} failed, {colorful} colorful...")

        except Exception as e:
            failed += 1

    print(f"Done! Converted: {converted}, Failed: {failed}, Colorful: {colorful}/{converted}")
    return converted

# ============================================================
# STEP 3: Build ChatML training data
# ============================================================
def step3_build_data(meta):
    print("\n" + "="*60)
    print("STEP 3: Building ChatML training data")
    print("="*60)

    samples = []

    for uid, info in meta.items():
        v4_path = os.path.join(V4_DIR, f"{uid}.v4")
        if not os.path.exists(v4_path):
            continue

        with open(v4_path) as f:
            code = f.read().strip()

        # Skip the comment line for training output
        code_lines = [l for l in code.split("\n") if not l.startswith("--")]
        clean_code = "\n".join(code_lines)

        name = info["name"]
        cat = info["category"].replace("_", " ").replace("(", "").replace(")", "")

        # 3 prompt variations per model
        prompts = [
            f"Generate a V4 voxel model of: {name}",
            f"Create a 3D voxel {cat}: {name}",
            f"V4 code for a {cat} called {name}",
        ]

        for prompt in prompts:
            samples.append({
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": clean_code}
                ]
            })

    # Shuffle and split train/val (90/10)
    random.seed(42)
    random.shuffle(samples)
    split = int(len(samples) * 0.9)
    train_samples = samples[:split]
    val_samples = samples[split:]

    with open(TRAIN_FILE, "w") as f:
        for s in train_samples:
            f.write(json.dumps(s) + "\n")

    with open(VAL_FILE, "w") as f:
        for s in val_samples:
            f.write(json.dumps(s) + "\n")

    print(f"Train: {len(train_samples)} samples → {TRAIN_FILE}")
    print(f"Val: {len(val_samples)} samples → {VAL_FILE}")

    # Stats
    avg_output_len = sum(len(s["messages"][2]["content"]) for s in samples) // len(samples)
    print(f"Avg output length: {avg_output_len} chars")

    return len(train_samples)

# ============================================================
# STEP 4: Fine-tune with Unsloth
# ============================================================
def step4_train():
    print("\n" + "="*60)
    print("STEP 4: Fine-tuning Qwen3.5-27B with QLoRA")
    print("="*60)

    from unsloth import FastLanguageModel
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from datasets import load_dataset

    # Load model with 4-bit quantization
    print(f"Loading {MODEL_NAME} in 4-bit...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ_LEN,
        load_in_4bit=True,
        dtype=None,  # auto-detect
    )

    # Apply LoRA to ALL linear layers
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        lora_alpha=LORA_ALPHA,
        lora_dropout=0,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        use_gradient_checkpointing="unsloth",
    )

    model.print_trainable_parameters()

    # Load dataset
    dataset = load_dataset("json", data_files={"train": TRAIN_FILE, "val": VAL_FILE})

    # Apply chat template
    def format_chat(example):
        text = tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )
        return {"text": text}

    train_dataset = dataset["train"].map(format_chat)
    val_dataset = dataset["val"].map(format_chat)

    print(f"Train samples: {len(train_dataset)}")
    print(f"Val samples: {len(val_dataset)}")

    # Training args
    total_steps = (len(train_dataset) // (BATCH_SIZE * GRAD_ACCUM)) * EPOCHS
    warmup_steps = max(10, int(total_steps * 0.1))

    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        learning_rate=LEARNING_RATE,
        lr_scheduler_type="cosine",
        warmup_steps=warmup_steps,
        weight_decay=0.01,
        logging_steps=10,
        save_steps=100,
        save_total_limit=2,
        eval_strategy="steps",
        eval_steps=100,
        bf16=True,
        optim="paged_adamw_8bit",
        report_to="none",
        seed=42,
    )

    # Trainer
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        tokenizer=tokenizer,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LEN,
        packing=True,  # pack short sequences together for efficiency
    )

    print(f"\nStarting training...")
    print(f"  Total steps: {total_steps}")
    print(f"  Warmup: {warmup_steps}")
    print(f"  Effective batch size: {BATCH_SIZE * GRAD_ACCUM}")
    print(f"  Max seq length: {MAX_SEQ_LEN}")

    trainer.train()

    # Save
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"\nModel saved to {OUTPUT_DIR}")

# ============================================================
# STEP 5: Test generation
# ============================================================
def step5_test():
    print("\n" + "="*60)
    print("STEP 5: Testing generation")
    print("="*60)

    from unsloth import FastLanguageModel

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=OUTPUT_DIR,
        max_seq_length=MAX_SEQ_LEN,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

    test_prompts = [
        "Generate a V4 voxel model of: a red sports car",
        "Create a 3D voxel animal: a colorful parrot",
        "V4 code for: a snowman with a hat",
        "Generate a V4 voxel model of: a green frog sitting on a lily pad",
        "Create a 3D voxel furniture: a wooden chair",
    ]

    for prompt in test_prompts:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        input_ids = tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            return_tensors="pt",
        ).to(model.device)

        output = model.generate(
            input_ids,
            max_new_tokens=1024,
            temperature=0.7,
            top_p=0.8,
            top_k=20,
            do_sample=True,
        )

        response = tokenizer.decode(output[0][input_ids.shape[-1]:], skip_special_tokens=True)
        lines = response.strip().split("\n")
        v4_lines = [l for l in lines if l.strip() and not l.startswith("```")]

        print(f"\n--- {prompt} ---")
        print(f"Output: {len(v4_lines)} lines")
        print("\n".join(v4_lines[:10]))
        if len(v4_lines) > 10:
            print(f"... ({len(v4_lines) - 10} more lines)")

        # Save each test output
        safe = prompt.replace(" ", "_")[:40]
        with open(f"/workspace/test_{safe}.v4", "w") as f:
            f.write("\n".join(v4_lines))

    print("\n\nDone! Test outputs saved to /workspace/test_*.v4")

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    skip_to = sys.argv[1] if len(sys.argv) > 1 else None

    if skip_to != "train" and skip_to != "test":
        meta = step1_download()
        step2_voxelize(meta)
        step3_build_data(meta)
    elif skip_to == "train":
        # Load existing meta
        with open("/workspace/model_meta.json") as f:
            meta = json.load(f)

    if skip_to != "test":
        step4_train()

    step5_test()

    print("\n" + "="*60)
    print("PIPELINE COMPLETE!")
    print(f"Model saved to: {OUTPUT_DIR}")
    print("Download the adapter with: scp -r runpod:{OUTPUT_DIR} ./v4-model-qwen/")
    print("="*60)
