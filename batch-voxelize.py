#!/usr/bin/env python3
"""Convert downloaded Objaverse GLB files → OBJ → V4 voxel code.

Usage: python3 batch-voxelize.py [--resolution 32] [--limit 100]
"""

import os
import sys
import json
import glob
import subprocess
import trimesh

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GLB_DIR = os.path.expanduser("~/.objaverse/hf-objaverse-v1/glbs")
OBJ_DIR = os.path.join(SCRIPT_DIR, "objaverse-obj")
V4_DIR = os.path.join(SCRIPT_DIR, "objaverse-v4")
VOXELIZER = os.path.join(SCRIPT_DIR, "voxelize.mjs")

# Parse args
resolution = 24  # smaller = faster, more compact V4
limit = 150

for i, arg in enumerate(sys.argv[1:], 1):
    if arg == "--resolution" and i < len(sys.argv) - 1:
        resolution = int(sys.argv[i + 1])
    if arg == "--limit" and i < len(sys.argv) - 1:
        limit = int(sys.argv[i + 1])

os.makedirs(OBJ_DIR, exist_ok=True)
os.makedirs(V4_DIR, exist_ok=True)

# Find all GLB files
glb_files = glob.glob(os.path.join(GLB_DIR, "**/*.glb"), recursive=True)
print(f"Found {len(glb_files)} GLB files")
print(f"Resolution: {resolution}, Limit: {limit}")

converted = 0
failed = 0
skipped = 0

for glb_path in glb_files[:limit]:
    uid = os.path.splitext(os.path.basename(glb_path))[0]
    obj_path = os.path.join(OBJ_DIR, f"{uid}.obj")
    v4_path = os.path.join(V4_DIR, f"{uid}.v4")

    # Skip if V4 already exists
    if os.path.exists(v4_path):
        skipped += 1
        continue

    # Step 1: GLB → OBJ via trimesh
    try:
        scene = trimesh.load(glb_path, force='scene')
        if isinstance(scene, trimesh.Scene):
            mesh = scene.dump(concatenate=True)
        else:
            mesh = scene

        if not hasattr(mesh, 'vertices') or len(mesh.vertices) == 0:
            print(f"  SKIP {uid[:12]}... (empty mesh)")
            failed += 1
            continue

        mesh.export(obj_path)
    except Exception as e:
        print(f"  FAIL GLB→OBJ {uid[:12]}... ({str(e)[:60]})")
        failed += 1
        continue

    # Step 2: OBJ → V4 via voxelize.mjs
    try:
        result = subprocess.run(
            ["node", VOXELIZER, obj_path, str(resolution), v4_path],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and os.path.exists(v4_path):
            # Check line count
            with open(v4_path) as f:
                lines = len(f.readlines())
            converted += 1
            print(f"  OK {uid[:12]}... → {lines} lines")
        else:
            print(f"  FAIL voxelize {uid[:12]}... ({result.stderr[:60]})")
            failed += 1
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT {uid[:12]}...")
        failed += 1
    except Exception as e:
        print(f"  FAIL {uid[:12]}... ({str(e)[:60]})")
        failed += 1

    # Clean up OBJ to save space
    if os.path.exists(obj_path):
        os.remove(obj_path)

print(f"\nDone! Converted: {converted}, Failed: {failed}, Skipped: {skipped}")
print(f"V4 files in: {V4_DIR}")

# List what we got
v4_files = glob.glob(os.path.join(V4_DIR, "*.v4"))
total_lines = 0
for f in v4_files:
    with open(f) as fh:
        total_lines += len(fh.readlines())
print(f"Total: {len(v4_files)} V4 files, {total_lines} lines of training data")
