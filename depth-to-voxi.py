"""
depth-to-voxi.py — Reconstruct 3D voxels from multi-view images using
depth estimation + background removal + voxel consensus.

Pipeline per view:
  1. Remove background (rembg)
  2. Estimate depth (Depth Anything v2 or MiDaS)
  3. Project into shared voxel grid
  4. Merge by consensus (2+ votes = real voxel)

Usage:
    # Multi-view images:
    python depth-to-voxi.py --front front.png --side side.png --back back.png --size 32

    # Strip image (3 views side by side):
    python depth-to-voxi.py --strip views.png --views front,side,back --size 32

    # Single image (just front depth):
    python depth-to-voxi.py --front penguin.png --size 32
"""

import argparse
import sys
import numpy as np
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("pip install Pillow"); sys.exit(1)

try:
    from rembg import remove as remove_bg
except ImportError:
    print("pip install rembg"); sys.exit(1)


def load_image(path):
    return Image.open(path).convert('RGB')


def strip_background(img):
    """Remove background using rembg, return RGBA with alpha mask."""
    print("  Removing background...")
    result = remove_bg(img)
    return result.convert('RGBA')


def estimate_depth_simple(img_rgba, size):
    """Simple depth estimation using brightness as proxy.
    For better results, replace with Depth Anything / MiDaS.
    Darker = closer assumption for many objects."""
    img = img_rgba.convert('RGB').resize((size, size), Image.LANCZOS)
    alpha = img_rgba.resize((size, size), Image.LANCZOS).split()[3]

    pixels = np.array(img).astype(float)
    alpha_arr = np.array(alpha).astype(float) / 255.0

    # Convert to grayscale
    gray = 0.299 * pixels[:,:,0] + 0.587 * pixels[:,:,1] + 0.114 * pixels[:,:,2]

    # Normalize to 0-1 depth (bright = far, dark = close for typical objects)
    # Invert so brighter areas are shallower depth
    depth = gray / 255.0

    return depth, alpha_arr, np.array(img)


def try_depth_anything(img_rgba, size):
    """Try to use Depth Anything v2 for real depth estimation."""
    try:
        from transformers import pipeline
        print("  Running Depth Anything v2...")
        pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf",
                        device="mps" if __import__('torch').backends.mps.is_available() else "cpu")

        img_rgb = img_rgba.convert('RGB')
        result = pipe(img_rgb)
        depth_img = result["depth"]

        # Resize depth to target
        depth_img = depth_img.resize((size, size), Image.LANCZOS)
        depth = np.array(depth_img).astype(float)
        depth = depth / depth.max() if depth.max() > 0 else depth

        # Get alpha mask
        alpha = img_rgba.resize((size, size), Image.LANCZOS).split()[3]
        alpha_arr = np.array(alpha).astype(float) / 255.0

        # Get colors
        img_rgb_resized = img_rgba.convert('RGB').resize((size, size), Image.LANCZOS)
        colors = np.array(img_rgb_resized)

        return depth, alpha_arr, colors
    except Exception as e:
        print(f"  Depth Anything failed ({e}), using brightness fallback")
        return None


def project_view_to_grid(depth, alpha, colors, view, size, depth_scale=0.8):
    """Project a depth map into a 3D voxel grid from a given viewpoint.

    Returns dict of (x,y,z) -> (r,g,b) for filled voxels.
    """
    voxels = {}
    max_depth = int(size * depth_scale)

    for row in range(size):
        for col in range(size):
            if alpha[row, col] < 0.5:
                continue  # background

            d = depth[row, col]
            # Map depth 0-1 to voxel depth 0-max_depth
            vz = int(d * max_depth)
            vz = min(vz, max_depth - 1)

            r, g, b = int(colors[row, col, 0]), int(colors[row, col, 1]), int(colors[row, col, 2])

            # Image coords: row=0 is top, col=0 is left
            # Voxel coords: y=0 is bottom, x=0 is left
            img_x = col
            img_y = size - 1 - row

            # Map view direction to 3D coordinates
            if view == 'front':
                # Looking along +Z
                vx, vy = img_x, img_y
                vz_3d = vz
            elif view == 'back':
                # Looking along -Z
                vx, vy = size - 1 - img_x, img_y
                vz_3d = size - 1 - vz
            elif view in ('right', 'side'):
                # Looking along -X (profile view)
                vy = img_y
                vx = size - 1 - vz
                vz_3d = img_x
            elif view == 'left':
                # Looking along +X
                vy = img_y
                vx = vz
                vz_3d = size - 1 - img_x
            else:
                continue

            if 0 <= vx < size and 0 <= vy < size and 0 <= vz_3d < size:
                key = (vx, vy, vz_3d)
                if key not in voxels:
                    voxels[key] = []
                voxels[key].append((r, g, b))

                # Also fill a few voxels behind the surface for thickness
                for fill in range(1, 3):
                    if view == 'front':
                        fk = (vx, vy, vz_3d + fill)
                    elif view == 'back':
                        fk = (vx, vy, vz_3d - fill)
                    elif view in ('right', 'side'):
                        fk = (vx - fill, vy, vz_3d)
                    elif view == 'left':
                        fk = (vx + fill, vy, vz_3d)
                    else:
                        continue
                    if 0 <= fk[0] < size and 0 <= fk[1] < size and 0 <= fk[2] < size:
                        if fk not in voxels:
                            voxels[fk] = []
                        voxels[fk].append((r, g, b))

    return voxels


VOXI_PALETTE = [
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


def rgb_to_voxi(r, g, b):
    best_dist = float('inf')
    best = '9'
    for pr, pg, pb, code in VOXI_PALETTE:
        dist = (r - pr)**2 + (g - pg)**2 + (b - pb)**2
        if dist < best_dist:
            best_dist = dist
            best = code
    return best


def merge_and_export(all_voxels, size, min_votes=1):
    """Merge voxel clouds from multiple views by consensus voting."""
    # Count votes per position
    vote_count = {}
    color_accum = {}

    for view_voxels in all_voxels:
        seen = set()  # one vote per view per position
        for pos, colors in view_voxels.items():
            if pos not in seen:
                vote_count[pos] = vote_count.get(pos, 0) + 1
                seen.add(pos)
            if pos not in color_accum:
                color_accum[pos] = []
            color_accum[pos].extend(colors)

    # Filter by minimum votes
    final = {}
    for pos, votes in vote_count.items():
        if votes >= min_votes:
            colors = color_accum[pos]
            avg_r = int(sum(c[0] for c in colors) / len(colors))
            avg_g = int(sum(c[1] for c in colors) / len(colors))
            avg_b = int(sum(c[2] for c in colors) / len(colors))
            final[pos] = rgb_to_voxi(avg_r, avg_g, avg_b)

    # Generate VOXI with run-length encoding
    lines = [f"V {size} {size} {size}"]
    lines.append(f"-- Depth-reconstructed ({len(final)} voxels, {len(all_voxels)} views)")
    lines.append("")

    for vy in range(size):
        layer = {(vx, vz): c for (vx, vy2, vz), c in final.items() if vy2 == vy}
        if not layer:
            continue

        by_z = {}
        for (vx, vz), c in layer.items():
            by_z.setdefault(vz, []).append((vx, c))

        for vz in sorted(by_z.keys()):
            row = sorted(by_z[vz])
            i = 0
            while i < len(row):
                start_x, color = row[i]
                run = 1
                while (i + run < len(row) and
                       row[i + run][0] == start_x + run and
                       row[i + run][1] == color):
                    run += 1
                if run >= 2:
                    lines.append(f"B {start_x} {vy} {vz} {run} 1 1 {color}")
                else:
                    lines.append(f"P {start_x} {vy} {vz} {color}")
                i += run

    return "\n".join(lines)


def split_strip(img, num_views):
    w, h = img.size
    view_w = w // num_views
    views = []
    for i in range(num_views):
        box = (i * view_w, 0, (i + 1) * view_w, h)
        views.append(img.crop(box))
    return views


def main():
    parser = argparse.ArgumentParser(description='Depth-based 3D reconstruction to VOXI')
    parser.add_argument('--front', help='Front view image')
    parser.add_argument('--side', help='Side/right view image')
    parser.add_argument('--back', help='Back view image')
    parser.add_argument('--left', help='Left view image')
    parser.add_argument('--strip', help='Single image with views side by side')
    parser.add_argument('--views', default='front,side,back',
                        help='View order in strip (comma-separated)')
    parser.add_argument('--size', type=int, default=32, help='Voxel grid size')
    parser.add_argument('--min-votes', type=int, default=1,
                        help='Minimum view votes for a voxel to be kept')
    parser.add_argument('--no-rembg', action='store_true', help='Skip background removal')
    parser.add_argument('--simple-depth', action='store_true',
                        help='Use simple brightness-based depth instead of AI model')
    parser.add_argument('--output', '-o', help='Output .voxi file')

    args = parser.parse_args()

    # Collect images
    images = {}
    if args.strip:
        strip = load_image(args.strip)
        view_names = args.views.split(',')
        view_imgs = split_strip(strip, len(view_names))
        for name, img in zip(view_names, view_imgs):
            images[name] = img
    else:
        if args.front: images['front'] = load_image(args.front)
        if args.side: images['side'] = load_image(args.side)
        if args.back: images['back'] = load_image(args.back)
        if args.left: images['left'] = load_image(args.left)

    if not images:
        print("Provide at least one view"); sys.exit(1)

    print(f"Views: {', '.join(images.keys())}")
    print(f"Grid: {args.size}x{args.size}x{args.size}")

    all_voxels = []

    for name, img in images.items():
        print(f"\nProcessing {name} view...")

        # Step 1: Remove background
        if not args.no_rembg:
            img_rgba = strip_background(img)
        else:
            img_rgba = img.convert('RGBA')

        # Step 2: Estimate depth
        depth_result = None
        if not args.simple_depth:
            depth_result = try_depth_anything(img_rgba, args.size)

        if depth_result:
            depth, alpha, colors = depth_result
        else:
            depth, alpha, colors = estimate_depth_simple(img_rgba, args.size)

        filled = np.sum(alpha > 0.5)
        print(f"  Foreground pixels: {filled}/{args.size**2}")

        # Step 3: Project into voxel grid
        voxels = project_view_to_grid(depth, alpha, colors, name, args.size)
        print(f"  Projected {len(voxels)} voxel positions")
        all_voxels.append(voxels)

    # Step 4: Merge by consensus
    min_votes = args.min_votes
    print(f"\nMerging with min_votes={min_votes}")

    voxi = merge_and_export(all_voxels, args.size, min_votes)

    lines = voxi.count('\n') + 1
    voxel_count = sum(1 for line in voxi.split('\n') if line.startswith('P') or line.startswith('B'))

    if args.output:
        Path(args.output).write_text(voxi)
        print(f"Written to {args.output} ({lines} lines, ~{voxel_count} commands)")
    else:
        print(voxi)


if __name__ == '__main__':
    main()
