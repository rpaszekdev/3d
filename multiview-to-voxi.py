"""
multiview-to-voxi.py — Reconstruct 3D voxels from multi-view silhouettes.

Uses visual hull carving: a voxel exists only if it's inside the
silhouette in ALL provided views.

Usage:
    # Separate images per view:
    python multiview-to-voxi.py --front front.png --side side.png --back back.png --size 32

    # Single image with 3 views side by side (auto-split):
    python multiview-to-voxi.py --strip views.png --views front,side,back --size 32

    # Just front + side (2 views):
    python multiview-to-voxi.py --front front.png --side side.png --size 32
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    print("pip install Pillow")
    sys.exit(1)


def extract_silhouette(img, size, threshold=200, invert=False):
    """Convert image to binary silhouette (True = object, False = background).

    Assumes object is darker than background (typical reference sheet).
    Set invert=True if object is lighter than background.
    """
    # Resize to target voxel resolution
    img = img.resize((size, size), Image.LANCZOS)
    gray = img.convert('L')
    pixels = gray.load()

    silhouette = []
    for y in range(size):
        row = []
        for x in range(size):
            is_object = pixels[x, y] < threshold
            if invert:
                is_object = not is_object
            row.append(is_object)
        silhouette.append(row)

    return silhouette


def extract_color_map(img, size):
    """Get color at each pixel for coloring voxels."""
    img = img.resize((size, size), Image.LANCZOS)
    rgb = img.convert('RGB')
    pixels = rgb.load()

    colors = []
    for y in range(size):
        row = []
        for x in range(size):
            row.append(pixels[x, y])
        colors.append(row)
    return colors


def rgb_to_voxi_color(r, g, b):
    """Map RGB to nearest VOXI palette color."""
    palette = [
        (0x11, 0x11, 0x11, '0'),  # black
        (0xe5, 0x39, 0x35, '1'),  # red
        (0x43, 0xa0, 0x47, '2'),  # green
        (0x1e, 0x88, 0xe5, '3'),  # blue
        (0x00, 0xbc, 0xd4, '4'),  # cyan
        (0xab, 0x47, 0xbc, '5'),  # magenta
        (0xfd, 0xd8, 0x35, '6'),  # yellow
        (0xff, 0x98, 0x00, '7'),  # orange
        (0xee, 0xee, 0xee, '8'),  # white
        (0x9e, 0x9e, 0x9e, '9'),  # gray
        (0x8d, 0x6e, 0x4a, 'a'),  # brown
        (0xff, 0x9e, 0xb5, 'b'),  # pink
        (0x2e, 0x7d, 0x32, 'c'),  # dark-green
        (0xd4, 0xb8, 0x96, 'd'),  # tan
        (0x8b, 0x1a, 0x1a, 'e'),  # maroon
        (0x1a, 0x3a, 0x6b, 'f'),  # navy
    ]

    best_dist = float('inf')
    best_color = '9'
    for pr, pg, pb, code in palette:
        dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
        if dist < best_dist:
            best_dist = dist
            best_color = code
    return best_color


def carve_visual_hull(silhouettes, size):
    """Carve a 3D voxel grid from multiple view silhouettes.

    silhouettes is a dict: { 'front': 2D bool array, 'side': ..., 'back': ... }

    Coordinate mapping:
      front view (x, y) → voxel columns along Z
      back view (x, y) → voxel columns along Z (mirrored X)
      side/right view (z, y) → voxel columns along X
      left view (z, y) → voxel columns along X (mirrored Z)
      top view (x, z) → voxel columns along Y
    """
    grid = {}  # (x, y, z) → True

    for vx in range(size):
        for vy in range(size):
            for vz in range(size):
                # Image Y is top-down, voxel Y is bottom-up
                img_y = size - 1 - vy

                exists = True

                if 'front' in silhouettes:
                    if not silhouettes['front'][img_y][vx]:
                        exists = False

                if exists and 'back' in silhouettes:
                    # Back view is mirrored X
                    if not silhouettes['back'][img_y][size - 1 - vx]:
                        exists = False

                if exists and 'side' in silhouettes:
                    # Side/profile view: x-axis = depth (Z)
                    if not silhouettes['side'][img_y][vz]:
                        exists = False

                if exists and 'left' in silhouettes:
                    if not silhouettes['left'][img_y][size - 1 - vz]:
                        exists = False

                if exists and 'top' in silhouettes:
                    if not silhouettes['top'][vz][vx]:
                        exists = False

                if exists:
                    grid[(vx, vy, vz)] = True

    return grid


def color_voxels(grid, color_maps, size):
    """Assign colors to voxels based on the front view color map."""
    colored = {}

    front_colors = color_maps.get('front')
    side_colors = color_maps.get('side')

    for (vx, vy, vz) in grid:
        img_y = size - 1 - vy

        # Use front view color by default
        if front_colors and 0 <= vx < size and 0 <= img_y < size:
            r, g, b = front_colors[img_y][vx]
            colored[(vx, vy, vz)] = rgb_to_voxi_color(r, g, b)
        else:
            colored[(vx, vy, vz)] = '9'

    return colored


def grid_to_voxi(grid, colored, size):
    """Convert voxel grid to VOXI code with run-length encoding."""
    lines = [f"V {size} {size} {size}"]
    lines.append(f"-- Reconstructed from multi-view silhouettes ({len(grid)} voxels)")
    lines.append("")

    # Group by Y layer for run-length encoding along X
    for vy in range(size):
        layer_voxels = [(vx, vz) for (vx, vy2, vz) in grid if vy2 == vy]
        if not layer_voxels:
            continue

        # Group by Z for run-length encoding along X
        by_z = {}
        for vx, vz in layer_voxels:
            by_z.setdefault(vz, []).append(vx)

        for vz in sorted(by_z.keys()):
            xs = sorted(by_z[vz])
            # Run-length encode
            i = 0
            while i < len(xs):
                start = xs[i]
                color = colored.get((start, vy, vz), '9')
                run = 1
                while (i + run < len(xs) and
                       xs[i + run] == start + run and
                       colored.get((xs[i + run], vy, vz), '9') == color):
                    run += 1

                if run >= 2:
                    lines.append(f"B {start} {vy} {vz} {run} 1 1 {color}")
                else:
                    lines.append(f"P {start} {vy} {vz} {color}")
                i += run

    return "\n".join(lines)


def split_strip(img, num_views):
    """Split a horizontal strip image into individual view images."""
    w, h = img.size
    view_w = w // num_views
    views = []
    for i in range(num_views):
        box = (i * view_w, 0, (i + 1) * view_w, h)
        views.append(img.crop(box))
    return views


def main():
    parser = argparse.ArgumentParser(description='Multi-view silhouette to VOXI')
    parser.add_argument('--front', help='Front view image')
    parser.add_argument('--side', help='Side/profile view image')
    parser.add_argument('--back', help='Back view image')
    parser.add_argument('--left', help='Left view image')
    parser.add_argument('--top', help='Top view image')
    parser.add_argument('--strip', help='Single image with views side by side')
    parser.add_argument('--views', default='front,side,back',
                        help='View order in strip (comma-separated)')
    parser.add_argument('--size', type=int, default=32, help='Voxel grid size')
    parser.add_argument('--threshold', type=int, default=200,
                        help='Silhouette threshold (0-255, higher = more inclusive)')
    parser.add_argument('--no-color', action='store_true', help='Skip color mapping')
    parser.add_argument('--output', '-o', help='Output .voxi file')

    args = parser.parse_args()

    images = {}
    color_sources = {}

    if args.strip:
        strip = Image.open(args.strip).convert('RGB')
        view_names = args.views.split(',')
        view_imgs = split_strip(strip, len(view_names))
        for name, img in zip(view_names, view_imgs):
            images[name] = img
            color_sources[name] = img
    else:
        if args.front:
            images['front'] = Image.open(args.front).convert('RGB')
            color_sources['front'] = images['front']
        if args.side:
            images['side'] = Image.open(args.side).convert('RGB')
            color_sources['side'] = images['side']
        if args.back:
            images['back'] = Image.open(args.back).convert('RGB')
        if args.left:
            images['left'] = Image.open(args.left).convert('RGB')
        if args.top:
            images['top'] = Image.open(args.top).convert('RGB')

    if not images:
        print("Provide at least one view: --front, --side, --back, or --strip")
        sys.exit(1)

    print(f"Views: {', '.join(images.keys())}")
    print(f"Grid size: {args.size}x{args.size}x{args.size}")

    # Extract silhouettes
    silhouettes = {}
    for name, img in images.items():
        silhouettes[name] = extract_silhouette(img, args.size, args.threshold)
        filled = sum(sum(row) for row in silhouettes[name])
        total = args.size * args.size
        print(f"  {name}: {filled}/{total} pixels filled ({filled/total*100:.0f}%)")

    # Carve visual hull
    print("Carving visual hull...")
    grid = carve_visual_hull(silhouettes, args.size)
    print(f"  {len(grid)} voxels in hull")

    # Color mapping
    if not args.no_color and color_sources:
        print("Mapping colors...")
        color_maps = {}
        for name, img in color_sources.items():
            color_maps[name] = extract_color_map(img, args.size)
        colored = color_voxels(grid, color_maps, args.size)
    else:
        colored = {pos: '9' for pos in grid}

    # Generate VOXI
    voxi = grid_to_voxi(grid, colored, args.size)

    if args.output:
        Path(args.output).write_text(voxi)
        print(f"Written to {args.output} ({len(voxi.splitlines())} lines)")
    else:
        print(voxi)


if __name__ == '__main__':
    main()
