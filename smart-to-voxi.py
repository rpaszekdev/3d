"""
smart-to-voxi.py — Analyze multi-view images and generate clean VOXI primitives.

Instead of dumping raw voxels, this extracts structural parameters:
  - Bounding box of the object
  - Body segments (head, torso, limbs) via vertical slicing
  - Dominant colors per region
  - Outputs clean E/S/B primitives

Usage:
    python smart-to-voxi.py --strip views.png --views front,side,back --size 32
    python smart-to-voxi.py --front penguin.png --size 24
"""

import argparse
import sys
import numpy as np
from pathlib import Path

try:
    from PIL import Image
    from rembg import remove as remove_bg
except ImportError:
    print("pip install Pillow rembg"); sys.exit(1)


VOXI_PALETTE = [
    (0x11, 0x11, 0x11, '0', 'black'),
    (0xe5, 0x39, 0x35, '1', 'red'),
    (0x43, 0xa0, 0x47, '2', 'green'),
    (0x1e, 0x88, 0xe5, '3', 'blue'),
    (0x00, 0xbc, 0xd4, '4', 'cyan'),
    (0xab, 0x47, 0xbc, '5', 'magenta'),
    (0xfd, 0xd8, 0x35, '6', 'yellow'),
    (0xff, 0x98, 0x00, '7', 'orange'),
    (0xee, 0xee, 0xee, '8', 'white'),
    (0x9e, 0x9e, 0x9e, '9', 'gray'),
    (0x8d, 0x6e, 0x4a, 'a', 'brown'),
    (0xff, 0x9e, 0xb5, 'b', 'pink'),
    (0x2e, 0x7d, 0x32, 'c', 'dark-green'),
    (0xd4, 0xb8, 0x96, 'd', 'tan'),
    (0x8b, 0x1a, 0x1a, 'e', 'maroon'),
    (0x1a, 0x3a, 0x6b, 'f', 'navy'),
]


def rgb_to_voxi(r, g, b):
    best_dist = float('inf')
    best = '9'
    for pr, pg, pb, code, _ in VOXI_PALETTE:
        dist = (r - pr)**2 + (g - pg)**2 + (b - pb)**2
        if dist < best_dist:
            best_dist = dist
            best = code
    return best


def get_silhouette_and_colors(img, size):
    """Remove background, get binary mask + color image at target size."""
    print("  Removing background...")
    rgba = remove_bg(img.convert('RGB')).convert('RGBA')
    rgba = rgba.resize((size, size), Image.LANCZOS)

    alpha = np.array(rgba.split()[3]).astype(float) / 255.0
    mask = alpha > 0.5
    colors = np.array(rgba.convert('RGB'))

    return mask, colors


def analyze_silhouette(mask):
    """Extract bounding box and per-row width from silhouette.
    Returns dict with bbox and row profiles.
    Image coords: row 0 = top.
    """
    h, w = mask.shape
    rows_with_content = []

    for row in range(h):
        cols = np.where(mask[row])[0]
        if len(cols) > 0:
            rows_with_content.append({
                'row': row,
                'left': int(cols[0]),
                'right': int(cols[-1]),
                'width': int(cols[-1] - cols[0] + 1),
                'center': int((cols[0] + cols[-1]) / 2),
            })

    if not rows_with_content:
        return None

    top_row = rows_with_content[0]['row']
    bottom_row = rows_with_content[-1]['row']
    all_lefts = [r['left'] for r in rows_with_content]
    all_rights = [r['right'] for r in rows_with_content]

    return {
        'top': top_row,
        'bottom': bottom_row,
        'left': min(all_lefts),
        'right': max(all_rights),
        'height': bottom_row - top_row + 1,
        'max_width': max(r['width'] for r in rows_with_content),
        'rows': rows_with_content,
    }


def find_segments(profile):
    """Split the silhouette into body segments based on width changes.
    Look for narrow points (neck, waist) that separate head/body/legs.
    """
    rows = profile['rows']
    if len(rows) < 5:
        return [{'start': rows[0]['row'], 'end': rows[-1]['row'], 'type': 'body'}]

    widths = [r['width'] for r in rows]
    max_w = max(widths)

    # Smooth widths to avoid noise
    smoothed = []
    for i in range(len(widths)):
        window = widths[max(0, i-2):min(len(widths), i+3)]
        smoothed.append(sum(window) / len(window))

    # Find narrow points (local minima in width, < 60% of max)
    segments = []
    narrow_threshold = max_w * 0.55
    current_start = 0
    in_narrow = smoothed[0] < narrow_threshold

    for i in range(1, len(smoothed)):
        is_narrow = smoothed[i] < narrow_threshold
        if is_narrow and not in_narrow:
            # Transition to narrow — end of a segment
            segments.append({
                'start_idx': current_start,
                'end_idx': i - 1,
                'start': rows[current_start]['row'],
                'end': rows[i - 1]['row'],
            })
            current_start = i
        elif not is_narrow and in_narrow:
            # Transition from narrow — start of new segment
            segments.append({
                'start_idx': current_start,
                'end_idx': i - 1,
                'start': rows[current_start]['row'],
                'end': rows[i - 1]['row'],
                'narrow': True,
            })
            current_start = i
        in_narrow = is_narrow

    # Add final segment
    segments.append({
        'start_idx': current_start,
        'end_idx': len(rows) - 1,
        'start': rows[current_start]['row'],
        'end': rows[-1]['row'],
    })

    # Classify segments
    for seg in segments:
        seg_rows = rows[seg['start_idx']:seg['end_idx'] + 1]
        seg['avg_width'] = sum(r['width'] for r in seg_rows) / len(seg_rows)
        seg['max_width'] = max(r['width'] for r in seg_rows)
        seg['center_x'] = int(sum(r['center'] for r in seg_rows) / len(seg_rows))
        seg['left'] = min(r['left'] for r in seg_rows)
        seg['right'] = max(r['right'] for r in seg_rows)
        seg['height'] = seg['end'] - seg['start'] + 1

    return segments


def get_dominant_color(colors, mask, row_start, row_end, col_start, col_end):
    """Get the most common VOXI color in a region."""
    region_colors = []
    for r in range(max(0, row_start), min(colors.shape[0], row_end + 1)):
        for c in range(max(0, col_start), min(colors.shape[1], col_end + 1)):
            if mask[r, c]:
                rgb = colors[r, c]
                region_colors.append(rgb_to_voxi(int(rgb[0]), int(rgb[1]), int(rgb[2])))

    if not region_colors:
        return '9'

    # Most common color
    from collections import Counter
    counts = Counter(region_colors)
    return counts.most_common(1)[0][0]


def get_front_back_colors(front_colors, front_mask, back_colors, back_mask,
                          row_start, row_end, col_start, col_end):
    """Get dominant color from front and back views for a segment."""
    front_c = get_dominant_color(front_colors, front_mask, row_start, row_end, col_start, col_end)
    if back_colors is not None:
        back_c = get_dominant_color(back_colors, back_mask, row_start, row_end, col_start, col_end)
    else:
        back_c = front_c
    return front_c, back_c


def segments_to_voxi(segments, front_profile, side_profile,
                     front_colors, front_mask, back_colors, back_mask, size):
    """Convert analyzed segments into VOXI primitives."""
    lines = [f"V {size} {size} {size}"]
    lines.append(f"-- Auto-generated from image analysis ({len(segments)} segments)")
    lines.append("")

    # Determine depth from side view
    if side_profile:
        side_max_width = side_profile['max_width']
    else:
        # Estimate depth as ~80% of front width
        side_max_width = int(front_profile['max_width'] * 0.8)

    # Sort segments by size (largest = body, smallest at top = head, smallest at bottom = feet)
    sorted_segs = sorted(segments, key=lambda s: s.get('avg_width', 0), reverse=True)

    for i, seg in enumerate(segments):
        is_narrow = seg.get('narrow', False)
        h = seg['height']
        if h < 2:
            continue

        # Image coords to voxel coords (flip Y)
        vy_bottom = size - 1 - seg['end']
        vy_top = size - 1 - seg['start']
        vy_center = (vy_bottom + vy_top) // 2
        vx_center = seg['center_x']

        # Width from front view
        rx = max(1, seg['max_width'] // 2)
        ry = max(1, h // 2)

        # Depth from side view (estimate per segment)
        if side_profile:
            # Find corresponding rows in side profile
            side_rows = [r for r in side_profile['rows']
                         if seg['start'] <= r['row'] <= seg['end']]
            if side_rows:
                rz = max(1, max(r['width'] for r in side_rows) // 2)
            else:
                rz = max(1, rx * 3 // 4)
        else:
            rz = max(1, rx * 3 // 4)

        vz_center = size // 2

        # Get colors from front and back
        front_c, back_c = get_front_back_colors(
            front_colors, front_mask, back_colors, back_mask,
            seg['start'], seg['end'], seg['left'], seg['right']
        )

        # Also check if there's a different color in the center (belly)
        center_margin = max(1, (seg['right'] - seg['left']) // 4)
        belly_c = get_dominant_color(
            front_colors, front_mask,
            seg['start'], seg['end'],
            seg['left'] + center_margin, seg['right'] - center_margin
        )

        if is_narrow:
            # Narrow segment = neck, waist, or connector
            label = "neck/connector"
            lines.append(f"-- {label}")
            lines.append(f"E {vx_center} {vy_center} {vz_center} {rx} {ry} {rz} {back_c}")
        elif seg == sorted_segs[0]:
            # Largest segment = main body
            lines.append(f"-- Body (main)")
            lines.append(f"E {vx_center} {vy_center} {vz_center} {rx} {ry} {rz} {back_c}")

            # Add belly (front-facing, different color)
            if belly_c != back_c:
                belly_rz = max(1, rz // 2)
                belly_vz = vz_center - rz + belly_rz
                lines.append(f"-- Belly")
                lines.append(f"E {vx_center} {vy_center} {belly_vz} {max(1,rx-1)} {max(1,ry-1)} {belly_rz} {belly_c}")
        elif seg['start'] < sorted_segs[0]['start']:
            # Above the body = head
            # Use sphere for head
            r_head = max(rx, ry, rz)
            lines.append(f"-- Head")
            lines.append(f"S {vx_center} {vy_center} {vz_center} {r_head} {back_c}")

            # Check for beak (small bright area at front of head)
            beak_c = get_dominant_color(
                front_colors, front_mask,
                seg['start'] + h // 3, seg['end'],
                seg['center_x'] - 2, seg['center_x'] + 2
            )
            if beak_c in ('7', '6', 'd', 'a'):  # orange/yellow/tan/brown
                beak_y = vy_center - 1
                beak_z = vz_center - rz
                lines.append(f"-- Beak")
                lines.append(f"B {vx_center-1} {beak_y} {beak_z} 2 1 2 {beak_c}")

            # Eyes
            lines.append(f"-- Eyes")
            eye_y = vy_center + 1
            eye_z = vz_center - r_head + 1
            lines.append(f"P {vx_center-1} {eye_y} {eye_z} 8")
            lines.append(f"P {vx_center+1} {eye_y} {eye_z} 8")

        elif seg['start'] > sorted_segs[0]['end']:
            # Below the body = feet/legs
            lines.append(f"-- Feet/legs")
            # Split into left and right
            mid = seg['center_x']
            left_x = seg['left'] + (mid - seg['left']) // 2
            right_x = mid + (seg['right'] - mid) // 2
            foot_w = max(2, (seg['right'] - seg['left']) // 3)
            lines.append(f"B {left_x} {vy_bottom} {vz_center-1} {foot_w} {h} 3 {front_c}")
            lines.append(f"B {right_x} {vy_bottom} {vz_center-1} {foot_w} {h} 3 {front_c}")
        else:
            # Other segment
            lines.append(f"-- Segment")
            lines.append(f"E {vx_center} {vy_center} {vz_center} {rx} {ry} {rz} {back_c}")

    # Add flippers/wings if front view shows extensions on the sides
    body_seg = sorted_segs[0]
    body_left = body_seg['left']
    body_right = body_seg['right']
    body_vx = body_seg['center_x']

    # Check for wing-like extensions in front silhouette
    for row_data in front_profile['rows']:
        if row_data['left'] < body_left - 2 or row_data['right'] > body_right + 2:
            # Found wing extension
            vy = size - 1 - row_data['row']
            if row_data['left'] < body_left - 2:
                wing_x = row_data['left']
                wing_w = body_left - row_data['left']
                lines.append(f"-- Left wing/flipper at y={vy}")
                lines.append(f"B {wing_x} {vy} {size//2-1} {wing_w} 1 2 {back_c}")
            if row_data['right'] > body_right + 2:
                wing_x = body_right + 1
                wing_w = row_data['right'] - body_right
                lines.append(f"-- Right wing/flipper at y={vy}")
                lines.append(f"B {wing_x} {vy} {size//2-1} {wing_w} 1 2 {back_c}")
            break  # Just get the first wing row as reference

    # Consolidate wing references into single blocks
    # (The above adds one line per row — let's replace with a single block)

    return "\n".join(lines)


def split_strip(img, num_views):
    w, h = img.size
    view_w = w // num_views
    return [img.crop((i * view_w, 0, (i + 1) * view_w, h)) for i in range(num_views)]


def main():
    parser = argparse.ArgumentParser(description='Smart image-to-VOXI primitive generator')
    parser.add_argument('--front', help='Front view image')
    parser.add_argument('--side', help='Side/profile view image')
    parser.add_argument('--back', help='Back view image')
    parser.add_argument('--strip', help='Single image with views side by side')
    parser.add_argument('--views', default='front,side,back')
    parser.add_argument('--size', type=int, default=24, help='Voxel grid size')
    parser.add_argument('--output', '-o', help='Output .voxi file')

    args = parser.parse_args()

    images = {}
    if args.strip:
        strip = Image.open(args.strip).convert('RGB')
        view_names = args.views.split(',')
        view_imgs = split_strip(strip, len(view_names))
        for name, img in zip(view_names, view_imgs):
            images[name] = img
    else:
        if args.front: images['front'] = Image.open(args.front).convert('RGB')
        if args.side: images['side'] = Image.open(args.side).convert('RGB')
        if args.back: images['back'] = Image.open(args.back).convert('RGB')

    if 'front' not in images:
        print("Need at least a --front view"); sys.exit(1)

    print(f"Analyzing {len(images)} views at {args.size}x{args.size}...")

    # Process front view
    front_mask, front_colors = get_silhouette_and_colors(images['front'], args.size)
    front_profile = analyze_silhouette(front_mask)
    print(f"  Front: bbox {front_profile['left']}-{front_profile['right']} x {front_profile['top']}-{front_profile['bottom']}, max_width={front_profile['max_width']}")

    # Process side view
    side_profile = None
    if 'side' in images:
        side_mask, _ = get_silhouette_and_colors(images['side'], args.size)
        side_profile = analyze_silhouette(side_mask)
        if side_profile:
            print(f"  Side: max_width={side_profile['max_width']}")

    # Process back view
    back_mask, back_colors = None, None
    if 'back' in images:
        back_mask, back_colors = get_silhouette_and_colors(images['back'], args.size)
        print(f"  Back: processed")

    # Find body segments
    segments = find_segments(front_profile)
    print(f"\n  Found {len(segments)} segments:")
    for i, seg in enumerate(segments):
        narrow = " (narrow)" if seg.get('narrow') else ""
        print(f"    {i}: rows {seg['start']}-{seg['end']}, width={seg.get('avg_width', 0):.0f}{narrow}")

    # Generate VOXI
    voxi = segments_to_voxi(
        segments, front_profile, side_profile,
        front_colors, front_mask, back_colors, back_mask,
        args.size
    )

    if args.output:
        Path(args.output).write_text(voxi)
        print(f"\nWritten to {args.output} ({voxi.count(chr(10))+1} lines)")
    else:
        print(f"\n{voxi}")


if __name__ == '__main__':
    main()
