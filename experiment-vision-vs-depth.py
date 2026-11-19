#!/usr/bin/env python3
"""
experiment-vision-vs-depth.py — Fair comparison: Vision model vs Depth-text model

Generates random 3D scenes, renders them as images, extracts depth matrices,
asks spatial questions, compares Claude Vision (seeing image) vs Claude Text (reading depth).

Ground truth is exact (we generated the scenes).
Questions are programmatic (no human bias).
Scoring is automatic.
"""

import json
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import subprocess
import os
import sys

random.seed(42)

OUTPUT_DIR = "test-videos/vision-vs-depth"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Colors ──────────────────────────────────────────────────────────
COLORS = {
    'red':     {'rgb': (220, 50, 50),   'id': 1},
    'green':   {'rgb': (50, 180, 50),   'id': 2},
    'blue':    {'rgb': (50, 80, 220),   'id': 3},
    'yellow':  {'rgb': (230, 210, 40),  'id': 6},
    'magenta': {'rgb': (180, 50, 180),  'id': 5},
    'orange':  {'rgb': (230, 140, 30),  'id': 7},
}

COLOR_NAMES = list(COLORS.keys())

def render_topdown_scene(objects, grid_size=16, cell_px=30):
    """Render a top-down view of objects on a table as a PIL image."""
    img_size = grid_size * cell_px
    img = Image.new('RGB', (img_size, img_size), (180, 180, 170))  # table color
    draw = ImageDraw.Draw(img)

    # Draw grid lines (subtle)
    for i in range(grid_size + 1):
        pos = i * cell_px
        draw.line([(pos, 0), (pos, img_size)], fill=(160, 160, 150), width=1)
        draw.line([(0, pos), (img_size, pos)], fill=(160, 160, 150), width=1)

    # Draw objects (top-down: x = horizontal, z = vertical)
    for obj in objects:
        x1 = obj['x'] * cell_px
        z1 = obj['z'] * cell_px
        x2 = (obj['x'] + obj['size']) * cell_px
        z2 = (obj['z'] + obj['size']) * cell_px
        color = COLORS[obj['color']]['rgb']

        if obj['shape'] == 'box':
            draw.rectangle([x1, z1, x2, z2], fill=color, outline=(0,0,0), width=2)
        elif obj['shape'] == 'circle':
            # Draw as ellipse
            draw.ellipse([x1, z1, x2, z2], fill=color, outline=(0,0,0), width=2)

        # Label with color initial
        cx, cz = (x1+x2)//2, (z1+z2)//2
        draw.text((cx-4, cz-6), obj['color'][0].upper(), fill=(255,255,255))

    # Add axis labels
    draw.text((5, img_size - 20), "← X →", fill=(80, 80, 80))
    draw.text((img_size - 25, 5), "Z↓", fill=(80, 80, 80))
    draw.text((5, 5), "TOP-DOWN VIEW", fill=(80, 80, 80))

    return img

def generate_depth_matrix(objects, grid_size=16, out_size=20):
    """Generate a depth matrix from the object positions."""
    # Simple depth model: objects have height (closer to camera = lower depth)
    # Table surface = depth 5, objects = depth 1-3 based on height
    grid = np.full((grid_size, grid_size), 5.0)  # table surface

    for obj in objects:
        # Object occupies cells and is "closer" (lower depth)
        depth = 2.0 if obj['shape'] == 'box' else 1.5  # circles slightly closer (taller)
        for x in range(obj['x'], min(obj['x'] + obj['size'], grid_size)):
            for z in range(obj['z'], min(obj['z'] + obj['size'], grid_size)):
                grid[z][x] = depth

    # Resize to output size
    from PIL import Image as PILImage
    grid_img = PILImage.fromarray(grid.astype(np.float32))
    grid_resized = np.array(grid_img.resize((out_size, out_size), PILImage.NEAREST))

    # Quantize to 0-9
    gmin, gmax = grid_resized.min(), grid_resized.max()
    if gmax - gmin < 0.01:
        quantized = np.full_like(grid_resized, 5, dtype=int)
    else:
        quantized = np.clip(((grid_resized - gmin) / (gmax - gmin) * 9).astype(int), 0, 9)

    return quantized

def depth_to_text(q):
    """Convert quantized depth matrix to text."""
    h, w = q.shape
    lines = [f"DEPTH MATRIX ({w}x{h}) — 0=close 9=far"]
    header = "   " + " ".join(f"{i%10}" for i in range(w))
    lines.append(header)
    for row in range(h):
        row_label = f"{row:2d} "
        cells = " ".join(str(q[row, col]) for col in range(w))
        lines.append(row_label + cells)
    return "\n".join(lines)

# ── Question Generators ─────────────────────────────────────────────

def gen_relative_position(objects):
    """Which object is to the left/right/above/below another?"""
    if len(objects) < 2:
        return None
    a, b = random.sample(objects, 2)

    dx = b['x'] - a['x']
    dz = b['z'] - a['z']

    if abs(dx) > abs(dz):
        if dx > 0:
            answer = "RIGHT"
            wrong = "LEFT"
        else:
            answer = "LEFT"
            wrong = "RIGHT"
    else:
        if dz > 0:
            answer = "BELOW"  # +Z = down in top-down view
            wrong = "ABOVE"
        else:
            answer = "ABOVE"
            wrong = "BELOW"

    question = f"In this top-down view, is the {b['color']} object to the LEFT, RIGHT, ABOVE, or BELOW the {a['color']} object?"
    choices = ["LEFT", "RIGHT", "ABOVE", "BELOW"]
    return {'question': question, 'answer': answer, 'choices': choices, 'type': 'position'}

def gen_closer_question(objects):
    """Which object is closer to a specific edge?"""
    if len(objects) < 2:
        return None
    a, b = random.sample(objects, 2)

    edge = random.choice(['left', 'top'])
    if edge == 'left':
        answer = a['color'] if a['x'] < b['x'] else b['color']
        question = f"Which object is closer to the LEFT edge: the {a['color']} or the {b['color']}?"
    else:
        answer = a['color'] if a['z'] < b['z'] else b['color']
        question = f"Which object is closer to the TOP edge: the {a['color']} or the {b['color']}?"

    choices = [a['color'], b['color']]
    return {'question': question, 'answer': answer, 'choices': choices, 'type': 'closer'}

def gen_between_question(objects):
    """Is object C between objects A and B (on X axis)?"""
    if len(objects) < 3:
        return None
    a, b, c = random.sample(objects, 3)

    # Check if C is between A and B on X axis
    min_x = min(a['x'], b['x'])
    max_x = max(a['x'], b['x'])
    is_between = min_x < c['x'] < max_x

    answer = "YES" if is_between else "NO"
    question = f"Is the {c['color']} object horizontally between the {a['color']} and {b['color']} objects?"
    choices = ["YES", "NO"]
    return {'question': question, 'answer': answer, 'choices': choices, 'type': 'between'}

def gen_count_question(objects):
    """How many objects are in the left/right half?"""
    half = random.choice(['left', 'right'])
    if half == 'left':
        count = sum(1 for o in objects if o['x'] < 8)
    else:
        count = sum(1 for o in objects if o['x'] >= 8)

    answer = str(count)
    question = f"How many objects are in the {half} half of the scene?"
    choices = ["0", "1", "2", "3", "4"]
    return {'question': question, 'answer': answer, 'choices': choices, 'type': 'count'}

def gen_distance_question(objects):
    """Which pair of objects is closer together?"""
    if len(objects) < 3:
        return None
    a, b, c = random.sample(objects, 3)

    dist_ab = abs(a['x'] - b['x']) + abs(a['z'] - b['z'])
    dist_ac = abs(a['x'] - c['x']) + abs(a['z'] - c['z'])

    if dist_ab == dist_ac:
        return None

    if dist_ab < dist_ac:
        answer = f"{a['color']} and {b['color']}"
        other = f"{a['color']} and {c['color']}"
    else:
        answer = f"{a['color']} and {c['color']}"
        other = f"{a['color']} and {b['color']}"

    question = f"Which pair is closer together: {a['color']}&{b['color']} or {a['color']}&{c['color']}?"
    choices = [f"{a['color']} and {b['color']}", f"{a['color']} and {c['color']}"]
    return {'question': question, 'answer': answer, 'choices': choices, 'type': 'distance'}

# ── Scene Generator ─────────────────────────────────────────────────

def generate_scene(num_objects=None):
    if num_objects is None:
        num_objects = random.randint(3, 5)

    objects = []
    used_colors = []
    used_positions = []

    for _ in range(num_objects):
        available_colors = [c for c in COLOR_NAMES if c not in used_colors]
        if not available_colors:
            break

        color = random.choice(available_colors)
        used_colors.append(color)
        shape = random.choice(['box', 'circle'])
        size = random.randint(2, 3)

        # Find non-overlapping position
        attempts = 0
        while attempts < 100:
            x = random.randint(1, 14 - size)
            z = random.randint(1, 14 - size)
            overlap = False
            for px, pz, ps in used_positions:
                if abs(x - px) < max(size, ps) + 1 and abs(z - pz) < max(size, ps) + 1:
                    overlap = True
                    break
            if not overlap:
                break
            attempts += 1

        used_positions.append((x, z, size))
        objects.append({
            'color': color, 'shape': shape, 'size': size,
            'x': x, 'z': z, 'y': 1,
        })

    return objects

# ── Main Generation ─────────────────────────────────────────────────

NUM_TASKS = 50
generators = [gen_relative_position, gen_closer_question, gen_between_question,
              gen_count_question, gen_distance_question]

tasks = []
task_id = 0

while len(tasks) < NUM_TASKS:
    objects = generate_scene()
    gen = random.choice(generators)
    q = gen(objects)
    if q is None:
        continue

    task_id += 1

    # Render image
    img = render_topdown_scene(objects)
    img_path = os.path.join(OUTPUT_DIR, f"scene_{task_id:03d}.png")
    img.save(img_path)

    # Generate depth matrix
    depth_q = generate_depth_matrix(objects)
    depth_text = depth_to_text(depth_q)

    tasks.append({
        'id': task_id,
        'type': q['type'],
        'question': q['question'],
        'choices': q['choices'],
        'answer': q['answer'],
        'image_path': img_path,
        'depth_text': depth_text,
        'objects': [{'color': o['color'], 'shape': o['shape'], 'size': o['size'],
                     'x': o['x'], 'z': o['z']} for o in objects],
    })

# Save benchmark
benchmark_path = os.path.join(OUTPUT_DIR, "benchmark.json")
with open(benchmark_path, 'w') as f:
    json.dump({'count': len(tasks), 'seed': 42, 'tasks': tasks}, f, indent=2)

print(f"Generated {len(tasks)} tasks")
print(f"Images saved to {OUTPUT_DIR}/")
print(f"Benchmark saved to {benchmark_path}")

# Print sample
for t in tasks[:5]:
    print(f"\nTask {t['id']} [{t['type']}]: {t['question']}")
    print(f"  Answer: {t['answer']}")
    print(f"  Objects: {[(o['color'], o['shape'], o['x'], o['z']) for o in t['objects']]}")
