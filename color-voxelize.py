#!/usr/bin/env python3
"""Voxelize GLB meshes WITH colors → V4 code.

Usage: python3 color-voxelize.py [--resolution 48] [--limit 150]
"""

import os
import sys
import json
import glob
import numpy as np
import trimesh

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GLB_DIR = os.path.expanduser("~/.objaverse/hf-objaverse-v1/glbs")
V4_DIR = os.path.join(SCRIPT_DIR, "objaverse-v4-color")
os.makedirs(V4_DIR, exist_ok=True)

resolution = 48
limit = 150
for i, arg in enumerate(sys.argv[1:], 1):
    if arg == "--resolution" and i < len(sys.argv) - 1:
        resolution = int(sys.argv[i + 1])
    if arg == "--limit" and i < len(sys.argv) - 1:
        limit = int(sys.argv[i + 1])

# V4 palette (0-9 + a-f)
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

def rgb_to_palette(r, g, b):
    diff = PALETTE - np.array([r, g, b], dtype=np.float32)
    return int(np.argmin(np.sum(diff**2, axis=1)))

def resolve_scene_colors(scene):
    """Convert each geometry's textures to vertex colors, then concatenate."""
    meshes = []
    for name, geom in scene.geometry.items():
        try:
            if hasattr(geom.visual, 'to_color'):
                color_vis = geom.visual.to_color()
                geom.visual = color_vis
        except Exception:
            # If texture resolution fails, assign gray
            n_verts = len(geom.vertices)
            geom.visual = trimesh.visual.ColorVisuals(
                vertex_colors=np.full((n_verts, 4), [130, 130, 130, 255], dtype=np.uint8)
            )
        meshes.append(geom)

    if len(meshes) == 1:
        return meshes[0]

    return trimesh.util.concatenate(meshes)

def voxelize_colored(glb_path, resolution):
    """Load GLB, resolve colors, voxelize with color sampling."""
    scene = trimesh.load(glb_path, force='scene')
    if not isinstance(scene, trimesh.Scene):
        mesh = scene
    else:
        mesh = resolve_scene_colors(scene)

    if not hasattr(mesh, 'vertices') or len(mesh.vertices) == 0:
        return None, 0, 0

    # Get vertex colors (now resolved from textures)
    vc = None
    if hasattr(mesh.visual, 'vertex_colors') and mesh.visual.vertex_colors is not None:
        vc = mesh.visual.vertex_colors[:, :3].astype(np.float32)

    # Compute bounds and scale
    bounds = mesh.bounds
    extent = bounds[1] - bounds[0]
    max_dim = extent.max()
    if max_dim == 0:
        return None, 0, 0
    scale = (resolution - 2) / max_dim

    # Auto-detect orientation: if Z extent > Y extent, model is Z-up → swap
    swap_yz = extent[2] > extent[1]

    # Sample surface points with face indices
    n_samples = max(resolution**2 * 4, 50000)
    points, face_indices = trimesh.sample.sample_surface(mesh, count=n_samples)

    # Build colored voxel grid
    grid = np.full((resolution, resolution, resolution), -1, dtype=np.int8)
    # Also accumulate RGB for averaging
    color_sum = np.zeros((resolution, resolution, resolution, 3), dtype=np.float64)
    color_count = np.zeros((resolution, resolution, resolution), dtype=np.int32)

    for j in range(len(points)):
        pt = points[j]
        # Auto-detect Z-up vs Y-up based on bounding box
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
                # Average the 3 vertex colors of this face
                v_ids = mesh.faces[fi]
                v_ids = v_ids[v_ids < len(vc)]  # bounds check
                if len(v_ids) == 0:
                    r, g, b = 130, 130, 130
                else:
                    r = vc[v_ids, 0].mean()
                    g = vc[v_ids, 1].mean()
                    b = vc[v_ids, 2].mean()
            else:
                r, g, b = 130, 130, 130

            color_sum[gx, gy, gz] += [r, g, b]
            color_count[gx, gy, gz] += 1
            grid[gx, gy, gz] = 0  # mark as filled, assign color later

    # Fill interior via flood fill
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

    # Interior = not exterior and not surface
    interior_count = 0
    for x in range(resolution):
        for y in range(resolution):
            for z in range(resolution):
                if grid[x, y, z] < 0 and not exterior[x, y, z]:
                    grid[x, y, z] = 0
                    interior_count += 1

    # Assign palette colors based on averaged RGB
    filled_count = 0
    for x in range(resolution):
        for y in range(resolution):
            for z in range(resolution):
                if grid[x, y, z] >= 0:
                    if color_count[x, y, z] > 0:
                        avg = color_sum[x, y, z] / color_count[x, y, z]
                        grid[x, y, z] = rgb_to_palette(avg[0], avg[1], avg[2])
                    else:
                        # Interior voxel — find nearest surface color
                        grid[x, y, z] = 9  # gray for interior
                    filled_count += 1

    return grid, filled_count, interior_count

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

# Load UID → name mapping
uid_names = {}
td_path = os.path.join(SCRIPT_DIR, "training-data.json")
if os.path.exists(td_path):
    with open(td_path) as f:
        for item in json.load(f):
            uid_names[item["uid"]] = {"name": item["name"], "categories": item["categories"]}

# Process
glb_files = glob.glob(os.path.join(GLB_DIR, "**/*.glb"), recursive=True)
print(f"Found {len(glb_files)} GLBs | Resolution: {resolution} | Limit: {limit}")

converted = failed = colorful = 0

for glb_path in glb_files[:limit]:
    uid = os.path.splitext(os.path.basename(glb_path))[0]
    v4_path = os.path.join(V4_DIR, f"{uid}.v4")

    try:
        grid, filled, interior = voxelize_colored(glb_path, resolution)
        if grid is None or filled < 50:
            failed += 1; continue

        boxes = greedy_compress(grid, resolution)
        unique_colors = len(set(b[6] for b in boxes))
        if unique_colors > 1: colorful += 1

        meta = uid_names.get(uid, {"name": uid[:20]})
        name = meta.get("name", uid[:20])
        lines = [f"-- {name}", f"V {resolution} {resolution} {resolution}"]
        for bx, by, bz, bw, bh, bd, bc in boxes:
            cc = COLOR_KEYS[bc] if bc < len(COLOR_KEYS) else str(bc)
            lines.append(f"B {bx} {by} {bz} {bw} {bh} {bd} {cc}")

        with open(v4_path, "w") as f:
            f.write("\n".join(lines))

        converted += 1
        color_str = ",".join(COLOR_KEYS[c] for c in sorted(set(b[6] for b in boxes)))
        print(f"  OK {name[:30]:30s} → {len(boxes)} boxes, colors=[{color_str}]")

    except Exception as e:
        print(f"  FAIL {uid[:12]}... {str(e)[:60]}")
        failed += 1

print(f"\nDone! Converted: {converted}, Failed: {failed}, Colorful: {colorful}/{converted}")
