"""
img-to-voxi.py — Convert a floor plan image to VOXI voxel code.

Dark pixels become walls (gray voxels), light pixels become empty space.
Optionally detects colored regions as different room types.

Usage:
    python img-to-voxi.py floorplan.png --width 50 --height 40 --wall-height 6
    python img-to-voxi.py floorplan.png --width 50 --height 40 --edges
    python img-to-voxi.py floorplan.png --width 50 --height 40 --colors
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    print("pip install Pillow")
    sys.exit(1)


def load_and_resize(path, target_w, target_h):
    """Load image and resize to target voxel grid dimensions."""
    img = Image.open(path).convert('RGB')
    img = img.resize((target_w, target_h), Image.LANCZOS)
    return img


def image_to_walls(img, threshold=128):
    """Convert image to wall map. Dark pixels = walls."""
    gray = img.convert('L')
    pixels = gray.load()
    w, h = gray.size
    walls = []
    for y in range(h):
        row = []
        for x in range(w):
            row.append(pixels[x, y] < threshold)
        walls.append(row)
    return walls


def image_to_edges(img):
    """Use edge detection to find wall outlines only."""
    gray = img.convert('L')
    edges = gray.filter(ImageFilter.FIND_EDGES)
    # Threshold the edges
    pixels = edges.load()
    w, h = edges.size
    walls = []
    for y in range(h):
        row = []
        for x in range(w):
            row.append(pixels[x, y] > 40)
        walls.append(row)
    return walls


def detect_rooms(img, walls):
    """Detect colored regions as different room types."""
    pixels = img.load()
    w, h = img.size

    # Map pixel colors to VOXI colors based on hue
    def classify_color(r, g, b):
        brightness = (r + g + b) / 3
        if brightness < 80:
            return None  # wall, skip
        if brightness > 220:
            return '.'   # white/empty
        # Detect hue
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        if max_c - min_c < 30:
            return '.'  # gray = empty
        if r > g and r > b:
            return '1'  # red
        if g > r and g > b:
            return '2'  # green
        if b > r and b > g:
            return '3'  # blue
        if r > 200 and g > 200:
            return '6'  # yellow
        if r > 200 and g > 100:
            return '7'  # orange
        return '.'

    room_map = []
    for y in range(h):
        row = []
        for x in range(w):
            if walls[y][x]:
                row.append('9')
            else:
                r, g, b = pixels[x, y]
                c = classify_color(r, g, b)
                row.append(c if c else '9')
        room_map.append(row)
    return room_map


def walls_to_voxi(walls, grid_w, grid_h, grid_d, wall_height=6, room_map=None):
    """Convert wall grid to VOXI code."""
    lines = [f"V {grid_w} {wall_height + 2} {grid_d}"]
    lines.append(f"-- Generated from image ({grid_w}x{grid_d})")
    lines.append("")

    # Floor
    lines.append("-- Floor")
    lines.append(f"B 0 0 0 {grid_w} 1 {grid_d} 9")
    lines.append("")

    # If we have room colors, place floor tiles
    if room_map:
        lines.append("-- Room floors (y=0)")
        for z in range(grid_d):
            for x in range(grid_w):
                c = room_map[z][x]
                if c != '9' and c != '.':
                    lines.append(f"P {x} 0 {grid_d - 1 - z} {c}")
        lines.append("")

    # Walls — use run-length encoding along X for efficiency
    lines.append("-- Walls")
    for z in range(grid_d):
        x = 0
        while x < grid_w:
            if walls[z][x]:
                # Start of a wall run
                run_start = x
                while x < grid_w and walls[z][x]:
                    x += 1
                run_len = x - run_start
                vz = grid_d - 1 - z  # flip Z so image top = high Z
                lines.append(f"B {run_start} 1 {vz} {run_len} {wall_height} 1 9")
            else:
                x += 1

    return "\n".join(lines)


def walls_to_voxi_points(walls, grid_w, grid_d, wall_height=6):
    """Simpler version: one P command per wall voxel per height level."""
    lines = [f"V {grid_w} {wall_height + 2} {grid_d}"]
    lines.append("-- Floor")
    lines.append(f"B 0 0 0 {grid_w} 1 {grid_d} 9")
    lines.append("")
    lines.append("-- Walls (edge-detected)")

    for z in range(grid_d):
        for x in range(grid_w):
            if walls[z][x]:
                vz = grid_d - 1 - z
                lines.append(f"B {x} 1 {vz} 1 {wall_height} 1 9")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description='Convert floor plan image to VOXI')
    parser.add_argument('image', help='Path to floor plan image')
    parser.add_argument('--width', type=int, default=50, help='Target voxel grid width (X)')
    parser.add_argument('--height', type=int, default=40, help='Target voxel grid depth (Z)')
    parser.add_argument('--wall-height', type=int, default=6, help='Wall height in voxels')
    parser.add_argument('--threshold', type=int, default=128, help='Dark pixel threshold (0-255)')
    parser.add_argument('--edges', action='store_true', help='Use edge detection instead of threshold')
    parser.add_argument('--colors', action='store_true', help='Detect room colors')
    parser.add_argument('--output', '-o', help='Output .voxi file (default: stdout)')

    args = parser.parse_args()

    img = load_and_resize(args.image, args.width, args.height)

    if args.edges:
        walls = image_to_edges(img)
    else:
        walls = image_to_walls(img, args.threshold)

    room_map = detect_rooms(img, walls) if args.colors else None

    voxi = walls_to_voxi(walls, args.width, args.wall_height + 2, args.height,
                          args.wall_height, room_map)

    if args.output:
        Path(args.output).write_text(voxi)
        print(f"Written to {args.output} ({len(voxi.splitlines())} lines)")
    else:
        print(voxi)


if __name__ == '__main__':
    main()
