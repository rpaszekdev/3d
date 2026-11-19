#!/usr/bin/env python3
"""
image-to-v4.py — Convert any photograph to V4 voxel code.

Uses classical computer vision (OpenCV + NumPy + Pillow) to:
1. Remove background via GrabCut
2. Quantize colors to V4's 16-color palette
3. Estimate 3D depth from silhouette width profile
4. Output V4 voxel code with run-length-encoded boxes

Usage:
    python image-to-v4.py <image_path> [--size 32] [--depth-scale 0.6]
"""

import sys
import argparse
from dataclasses import dataclass
from typing import List, Tuple

import cv2
import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# V4 palette: 16 fixed colors mapped to RGB values
# ---------------------------------------------------------------------------
V4_PALETTE = {
    "0": (0, 0, 0),        # black
    "1": (255, 0, 0),      # red
    "2": (0, 180, 0),      # green
    "3": (0, 0, 255),      # blue
    "4": (0, 255, 255),    # cyan
    "5": (255, 0, 255),    # magenta
    "6": (255, 255, 0),    # yellow
    "7": (255, 140, 0),    # orange
    "8": (255, 255, 255),  # white
    "9": (128, 128, 128),  # gray
    "a": (139, 90, 43),    # brown
    "b": (255, 182, 193),  # pink
    "c": (0, 100, 0),      # dark-green
    "d": (210, 180, 140),  # tan
    "e": (128, 0, 0),      # maroon
    "f": (0, 0, 128),      # navy
}

PALETTE_KEYS = list(V4_PALETTE.keys())
PALETTE_RGB = np.array([V4_PALETTE[k] for k in PALETTE_KEYS], dtype=np.float32)


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Voxel:
    x: int
    y: int
    z: int
    color: str


@dataclass(frozen=True)
class Box:
    x: int
    y: int
    z: int
    w: int
    h: int
    d: int
    color: str

    def to_v4(self) -> str:
        return f"B {self.x} {self.y} {self.z} {self.w} {self.h} {self.d} {self.color}"


# ---------------------------------------------------------------------------
# Step 1: Load and resize image
# ---------------------------------------------------------------------------
def load_and_resize(path: str, target_size: int) -> np.ndarray:
    """Load image and resize so the longer side equals target_size."""
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        print(f"Error: Cannot read image '{path}'", file=sys.stderr)
        sys.exit(1)

    h, w = img.shape[:2]
    scale = target_size / max(h, w)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


# ---------------------------------------------------------------------------
# Step 2: Background removal via GrabCut
# ---------------------------------------------------------------------------
def remove_background(img_bgr: np.ndarray) -> np.ndarray:
    """
    Remove background using GrabCut with automatic rectangle initialization.
    Returns a binary mask (255 = foreground, 0 = background).
    """
    h, w = img_bgr.shape[:2]

    # Initialize with a rectangle that excludes the outer border
    # (assumes the subject is roughly centered).
    margin_x = max(1, w // 8)
    margin_y = max(1, h // 8)
    rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)

    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    cv2.grabCut(img_bgr, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)

    # Refine: also mark the very center as definite foreground and re-run
    center_margin_x = max(1, w // 4)
    center_margin_y = max(1, h // 4)
    mask[center_margin_y:h - center_margin_y, center_margin_x:w - center_margin_x] = cv2.GC_PR_FGD
    cv2.grabCut(img_bgr, mask, rect, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_MASK)

    # Convert GrabCut mask to binary: FGD or PR_FGD => foreground
    fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Clean up with morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # Keep only the largest connected component (the main subject)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(fg_mask, connectivity=8)
    if num_labels > 1:
        # Label 0 is background; find largest foreground component
        largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        fg_mask = np.where(labels == largest_label, 255, 0).astype(np.uint8)

    return fg_mask


# ---------------------------------------------------------------------------
# Step 3: Color quantization to V4 palette
# ---------------------------------------------------------------------------
def quantize_to_v4_palette(img_rgb: np.ndarray) -> np.ndarray:
    """
    Map each pixel to the nearest V4 palette color.
    Returns an array of palette indices (same shape as img_rgb[:,:,0]).
    """
    h, w = img_rgb.shape[:2]
    pixels = img_rgb.reshape(-1, 3).astype(np.float32)

    # Compute squared Euclidean distance to each palette color
    # pixels: (N, 3), PALETTE_RGB: (16, 3)
    diffs = pixels[:, np.newaxis, :] - PALETTE_RGB[np.newaxis, :, :]  # (N, 16, 3)
    dists = np.sum(diffs ** 2, axis=2)  # (N, 16)
    indices = np.argmin(dists, axis=1)  # (N,)

    return indices.reshape(h, w)


# ---------------------------------------------------------------------------
# Step 4: Estimate depth from silhouette width profile
# ---------------------------------------------------------------------------
def estimate_depth_map(fg_mask: np.ndarray, depth_scale: float) -> np.ndarray:
    """
    For each foreground pixel, estimate a depth (z-thickness) based on
    the silhouette width at that scanline and the pixel's distance from
    the silhouette edge.

    The idea: treat the silhouette as a cross-section of a roughly convex
    3D object. Wider parts are thicker. Pixels near the center of the
    silhouette at that row get more depth (elliptical cross-section).

    Returns a float array with depth values (0..max_depth).
    """
    h, w = fg_mask.shape
    depth = np.zeros((h, w), dtype=np.float32)

    # Compute distance transform: distance of each foreground pixel to
    # the nearest background pixel. This gives a natural "how interior" measure.
    dist_transform = cv2.distanceTransform(fg_mask, cv2.DIST_L2, 5)

    # Normalize per-row by the row's max width, producing an elliptical profile
    for row in range(h):
        fg_cols = np.where(fg_mask[row] > 0)[0]
        if len(fg_cols) == 0:
            continue
        row_width = fg_cols[-1] - fg_cols[0] + 1
        max_dist_in_row = dist_transform[row, fg_cols].max()
        if max_dist_in_row > 0:
            # Normalize distance to [0, 1] and scale by row width
            row_depth = (dist_transform[row] / max_dist_in_row) * row_width * depth_scale
            depth[row] = row_depth

    # Smooth the depth map
    depth = cv2.GaussianBlur(depth, (3, 3), 0)

    return depth


# ---------------------------------------------------------------------------
# Step 5: Generate voxels from the 2D image + depth map
# ---------------------------------------------------------------------------
def generate_voxels(
    palette_indices: np.ndarray,
    fg_mask: np.ndarray,
    depth_map: np.ndarray,
    max_depth: int,
) -> List[Voxel]:
    """
    For each foreground pixel, create a column of voxels along the Z axis.
    The column depth is determined by the depth map.

    The image Y axis maps to V4 Y axis (inverted: image top = high Y in V4).
    The image X axis maps to V4 X axis.
    Depth goes along V4 Z axis, centered.
    """
    h, w = fg_mask.shape
    voxels = []

    # Normalize depth map to [1, max_depth]
    max_raw_depth = depth_map.max()
    if max_raw_depth <= 0:
        max_raw_depth = 1.0

    for row in range(h):
        for col in range(w):
            if fg_mask[row, col] == 0:
                continue

            color_key = PALETTE_KEYS[palette_indices[row, col]]
            raw_depth = depth_map[row, col]

            # Map depth to integer voxel count
            voxel_depth = max(1, int(round((raw_depth / max_raw_depth) * max_depth)))

            # V4 Y: invert so image bottom = Y=0 (ground), image top = high Y
            vy = (h - 1) - row
            vx = col

            # Center the depth column around the midpoint of the Z range
            z_start = max(0, (max_depth - voxel_depth) // 2)

            for dz in range(voxel_depth):
                vz = z_start + dz
                voxels.append(Voxel(x=vx, y=vy, z=vz, color=color_key))

    return voxels


# ---------------------------------------------------------------------------
# Step 6: Merge voxels into boxes via greedy run-length encoding
# ---------------------------------------------------------------------------
def merge_voxels_to_boxes(voxels: List[Voxel], grid_w: int, grid_h: int, grid_d: int) -> List[Box]:
    """
    Greedy merge: first merge along Z (depth), then along X, then along Y.
    This produces far fewer boxes than one-per-voxel.
    """
    if not voxels:
        return []

    # Build a 3D grid: color at each position (None if empty)
    grid = {}
    for v in voxels:
        grid[(v.x, v.y, v.z)] = v.color

    used = set()
    boxes = []

    # Sort voxels for consistent traversal: Y descending, X ascending, Z ascending
    sorted_keys = sorted(grid.keys(), key=lambda k: (-k[1], k[0], k[2]))

    for key in sorted_keys:
        if key in used:
            continue
        x, y, z = key
        color = grid[key]

        # Extend along Z
        dz = 1
        while (x, y, z + dz) in grid and grid[(x, y, z + dz)] == color and (x, y, z + dz) not in used:
            dz += 1

        # Extend along X
        dx = 1
        while True:
            can_extend = True
            for zz in range(z, z + dz):
                if (x + dx, y, zz) not in grid or grid[(x + dx, y, zz)] != color or (x + dx, y, zz) in used:
                    can_extend = False
                    break
            if not can_extend:
                break
            dx += 1

        # Extend along Y (downward in V4 space, but we try both directions)
        dy = 1
        while True:
            can_extend = True
            for xx in range(x, x + dx):
                for zz in range(z, z + dz):
                    if (xx, y - dy, zz) not in grid or grid[(xx, y - dy, zz)] != color or (xx, y - dy, zz) in used:
                        can_extend = False
                        break
                if not can_extend:
                    break
            if not can_extend:
                break
            dy += 1

        # Mark all cells as used
        for xx in range(x, x + dx):
            for yy in range(y, y - dy, -1):
                for zz in range(z, z + dz):
                    used.add((xx, yy, zz))

        # Box position is the minimum corner
        box_y = y - dy + 1
        boxes.append(Box(x=x, y=box_y, z=z, w=dx, h=dy, d=dz, color=color))

    return boxes


# ---------------------------------------------------------------------------
# Step 7: Output V4 code
# ---------------------------------------------------------------------------
def output_v4(boxes: List[Box], grid_w: int, grid_h: int, grid_d: int) -> str:
    lines = [f"V {grid_w} {grid_h} {grid_d}"]
    for box in boxes:
        lines.append(box.to_v4())
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def convert_image_to_v4(image_path: str, target_size: int, depth_scale: float) -> str:
    """Full pipeline: image -> V4 code string."""

    # 1. Load and resize
    img_bgr = load_and_resize(image_path, target_size)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_bgr.shape[:2]

    print(f"# Image resized to {w}x{h}", file=sys.stderr)

    # 2. Background removal
    print("# Removing background (GrabCut)...", file=sys.stderr)
    fg_mask = remove_background(img_bgr)

    fg_pixel_count = np.count_nonzero(fg_mask)
    total_pixels = h * w
    fg_ratio = fg_pixel_count / total_pixels

    # If GrabCut fails (too little or too much foreground), fall back to
    # Otsu thresholding on the grayscale image
    if fg_ratio < 0.05 or fg_ratio > 0.95:
        print("# GrabCut produced poor mask, falling back to Otsu thresholding...", file=sys.stderr)
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        _, fg_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # Clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    fg_pixel_count = np.count_nonzero(fg_mask)
    print(f"# Foreground pixels: {fg_pixel_count}/{total_pixels} ({100*fg_pixel_count/total_pixels:.1f}%)", file=sys.stderr)

    # 3. Color quantization
    print("# Quantizing colors to V4 palette...", file=sys.stderr)
    palette_indices = quantize_to_v4_palette(img_rgb)

    # 4. Depth estimation
    print("# Estimating depth from silhouette...", file=sys.stderr)
    depth_map = estimate_depth_map(fg_mask, depth_scale)

    # Max depth in voxels: proportional to the image width
    max_depth = max(4, w // 2)

    # 5. Generate voxels
    print("# Generating voxels...", file=sys.stderr)
    voxels = generate_voxels(palette_indices, fg_mask, depth_map, max_depth)
    print(f"# Raw voxels: {len(voxels)}", file=sys.stderr)

    if not voxels:
        print("Error: No foreground voxels generated.", file=sys.stderr)
        sys.exit(1)

    # Compute grid bounds
    grid_w = max(v.x for v in voxels) + 1
    grid_h = max(v.y for v in voxels) + 1
    grid_d = max(v.z for v in voxels) + 1

    # 6. Merge into boxes
    print("# Merging voxels into boxes...", file=sys.stderr)
    boxes = merge_voxels_to_boxes(voxels, grid_w, grid_h, grid_d)
    print(f"# Boxes: {len(boxes)} (from {len(voxels)} voxels)", file=sys.stderr)

    # 7. Output
    return output_v4(boxes, grid_w, grid_h, grid_d)


def main():
    parser = argparse.ArgumentParser(
        description="Convert a photograph to V4 voxel code using classical computer vision."
    )
    parser.add_argument("image", help="Path to input image")
    parser.add_argument(
        "--size", type=int, default=32,
        help="Target grid size (longest side). Default: 32"
    )
    parser.add_argument(
        "--depth-scale", type=float, default=0.6,
        help="Depth extrusion scale factor (0.1-1.0). Default: 0.6"
    )
    args = parser.parse_args()

    if args.size < 8 or args.size > 128:
        print("Error: --size must be between 8 and 128", file=sys.stderr)
        sys.exit(1)

    if args.depth_scale <= 0 or args.depth_scale > 2.0:
        print("Error: --depth-scale must be between 0.01 and 2.0", file=sys.stderr)
        sys.exit(1)

    v4_code = convert_image_to_v4(args.image, args.size, args.depth_scale)
    print(v4_code)


if __name__ == "__main__":
    main()
