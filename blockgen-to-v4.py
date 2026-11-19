#!/usr/bin/env python3
"""Convert blockgen-3d HuggingFace dataset → V4 voxel training data.

Usage: python3 blockgen-to-v4.py [--limit 500] [--min-voxels 100]
"""

import os
import sys
import json
import numpy as np
from datasets import load_dataset

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "blockgen-v4")
os.makedirs(OUT_DIR, exist_ok=True)

limit = 500
min_voxels = 100
for i, arg in enumerate(sys.argv[1:], 1):
    if arg == "--limit" and i < len(sys.argv) - 1:
        limit = int(sys.argv[i + 1])
    if arg == "--min-voxels" and i < len(sys.argv) - 1:
        min_voxels = int(sys.argv[i + 1])

# V4 color palette (RGB targets)
PALETTE = [
    (0, 0, 0),       # 0 = black
    (255, 50, 50),    # 1 = red
    (50, 200, 50),    # 2 = green
    (50, 100, 255),   # 3 = blue
    (0, 200, 200),    # 4 = cyan
    (200, 50, 200),   # 5 = magenta
    (255, 200, 0),    # 6 = yellow
    (255, 130, 0),    # 7 = orange
    (240, 240, 240),  # 8 = white
    (130, 130, 130),  # 9 = gray
]

def rgb_to_palette(r, g, b):
    """Map RGB to closest V4 color index 0-9."""
    best, best_dist = 9, float('inf')
    for idx, (pr, pg, pb) in enumerate(PALETTE):
        dist = (r - pr)**2 + (g - pg)**2 + (b - pb)**2
        if dist < best_dist:
            best, best_dist = idx, dist
    return best

def voxels_to_v4(occupancy, colors, resolution=32):
    """Convert occupancy grid + RGB colors → V4 code with greedy box compression."""
    # Build colored voxel grid: -1 = empty, 0-9 = color
    grid = np.full((resolution, resolution, resolution), -1, dtype=np.int8)

    # occupancy: (32,32,32), colors: (3,32,32,32)
    for x in range(resolution):
        for y in range(resolution):
            for z in range(resolution):
                if occupancy[x, y, z] > 0.5:
                    r = int(colors[0, x, y, z] * 255)
                    g = int(colors[1, x, y, z] * 255)
                    b = int(colors[2, x, y, z] * 255)
                    grid[x, y, z] = rgb_to_palette(r, g, b)

    # Greedy box compression (per color)
    used = np.zeros_like(grid, dtype=bool)
    boxes = []

    for y in range(resolution):
        for z in range(resolution):
            for x in range(resolution):
                if grid[x, y, z] < 0 or used[x, y, z]:
                    continue
                c = grid[x, y, z]
                # Grow along X
                ex = x
                while ex + 1 < resolution and grid[ex + 1, y, z] == c and not used[ex + 1, y, z]:
                    ex += 1
                # Grow along Z
                ez = z
                grow_z = True
                while grow_z and ez + 1 < resolution:
                    for xx in range(x, ex + 1):
                        if grid[xx, y, ez + 1] != c or used[xx, y, ez + 1]:
                            grow_z = False
                            break
                    if grow_z:
                        ez += 1
                # Grow along Y
                ey = y
                grow_y = True
                while grow_y and ey + 1 < resolution:
                    for xx in range(x, ex + 1):
                        for zz in range(z, ez + 1):
                            if grid[xx, ey + 1, zz] != c or used[xx, ey + 1, zz]:
                                grow_y = False
                                break
                        if not grow_y:
                            break
                    if grow_y:
                        ey += 1
                # Mark used
                used[x:ex+1, y:ey+1, z:ez+1] = True
                boxes.append((x, y, z, ex - x + 1, ey - y + 1, ez - z + 1, int(c)))

    # Generate V4 code
    lines = [f"V {resolution} {resolution} {resolution}"]
    for bx, by, bz, bw, bh, bd, bc in boxes:
        lines.append(f"B {bx} {by} {bz} {bw} {bh} {bd} {bc}")

    return "\n".join(lines), len(boxes)

# Stream dataset
print(f"Streaming blockgen-3d (limit={limit}, min_voxels={min_voxels})...")
ds = load_dataset("PeterAM4/blockgen-3d", split="train", streaming=True)

converted = 0
skipped = 0
pairs = []

for i, sample in enumerate(ds):
    if converted >= limit:
        break

    occ = np.array(sample["voxels_occupancy"]).squeeze()  # (1,32,32,32) → (32,32,32)
    filled = int(occ.sum())

    if filled < min_voxels:
        skipped += 1
        continue

    name = sample.get("name", f"model_{i}")
    cats = sample.get("categories", [])
    colors = np.nan_to_num(np.array(sample["voxels_colors"]), nan=0.5)

    code, num_boxes = voxels_to_v4(occ, colors)

    # Save V4 file
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in name)[:50].strip()
    fname = f"{converted:04d}_{safe_name}.v4"
    with open(os.path.join(OUT_DIR, fname), "w") as f:
        f.write(f"-- {name}\n{code}")

    # Build training pair
    cat_str = cats[0] if cats else "3d model"
    pairs.append({"instruction": f"Generate a V4 voxel model of: {name}", "output": code})
    pairs.append({"instruction": f"Create a 3D voxel {cat_str}: {name}", "output": code})
    pairs.append({"instruction": f"V4 code for: {name}", "output": code})

    converted += 1
    if converted % 50 == 0:
        print(f"  {converted}/{limit} converted ({skipped} skipped)...")

# Save training data
train_path = os.path.join(SCRIPT_DIR, "train-blockgen.jsonl")
with open(train_path, "w") as f:
    for p in pairs:
        f.write(json.dumps(p) + "\n")

print(f"\nDone! {converted} models converted, {skipped} skipped (too small)")
print(f"V4 files: {OUT_DIR}/")
print(f"Training data: {train_path} ({len(pairs)} pairs)")

# Stats
total_lines = sum(len(p["output"].split("\n")) for p in pairs) // 3
avg_lines = total_lines // max(converted, 1)
print(f"Avg lines per model: {avg_lines}")
