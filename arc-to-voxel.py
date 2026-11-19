"""
Convert ARC-AGI puzzles to V4 Voxel format for visual reasoning.

Usage:
  python3 arc-to-voxel.py <puzzle.json>              # renders all train pairs + test input
  python3 arc-to-voxel.py <puzzle.json> --prompt      # also prints LLM prompt
  python3 arc-to-voxel.py <puzzle.json> --test-only   # only test input (for the LLM to solve)

Outputs voxel script to stdout. Paste into V4 Voxel renderer.
"""
import json, sys, os

# ARC colors (0-9) mapped to V4 voxel colors
# ARC: 0=black, 1=blue, 2=red, 3=green, 4=yellow, 5=gray, 6=magenta, 7=orange, 8=cyan, 9=brown
# V4:  0=black, 1=red, 2=green, 3=blue, 4=cyan, 5=magenta, 6=yellow, 7=orange, 8=white, 9=gray
ARC_TO_V4 = {
    0: 0,   # black → black
    1: 3,   # blue → blue
    2: 1,   # red → red
    3: 2,   # green → green
    4: 6,   # yellow → yellow
    5: 9,   # gray → gray
    6: 5,   # magenta → magenta
    7: 7,   # orange → orange
    8: 4,   # cyan → cyan
    9: 10,  # brown → brown (a)
}

def grid_to_voxels(grid, offset_x, offset_z, y=0):
    """Convert a 2D ARC grid to voxel commands at given offset."""
    lines = []
    h = len(grid)
    w = len(grid[0]) if grid else 0
    for row_idx, row in enumerate(grid):
        # Flip Y so row 0 is at the top (high Y in voxel space)
        vy = h - 1 - row_idx
        for col_idx, val in enumerate(row):
            if val != 0:  # skip black (background)
                vx = offset_x + col_idx
                vz = offset_z
                color = ARC_TO_V4.get(val, 9)
                lines.append(f"B {vx} {vy + y} {vz} 1 1 1 {color}")
    return lines


def render_puzzle(puzzle_data, test_only=False):
    """Generate complete voxel script for an ARC puzzle."""
    train = puzzle_data['train']
    test = puzzle_data['test']

    # Calculate layout
    all_grids = []
    if not test_only:
        for i, pair in enumerate(train):
            all_grids.append(('train_in', i, pair['input']))
            all_grids.append(('train_out', i, pair['output']))
    all_grids.append(('test_in', 0, test[0]['input']))

    # Find max dimensions
    max_h = max(len(g) for _, _, g in all_grids)
    max_w = max(len(g[0]) for _, _, g in all_grids)

    # Layout: pairs side by side with gaps
    gap = 2
    arrow_gap = 1
    pair_width = max_w * 2 + arrow_gap
    total_width = len(all_grids) // 2 * (pair_width + gap) + max_w + gap

    grid_size = max(total_width + 4, max_h + 4, 8)

    lines = [f"V {grid_size} {max_h + 4} {grid_size}"]
    lines.append(f"-- ARC Puzzle")

    x_cursor = 2

    if not test_only:
        for i, pair in enumerate(train):
            inp, out = pair['input'], pair['output']
            ih, iw = len(inp), len(inp[0])
            oh, ow = len(out), len(out[0])

            lines.append(f"-- Train pair {i+1}: Input")
            lines.extend(grid_to_voxels(inp, x_cursor, 2, y=1))

            # Arrow (orange dot between input and output)
            lines.append(f"B {x_cursor + iw + 0} {max_h // 2 + 1} 2 1 1 1 7")

            lines.append(f"-- Train pair {i+1}: Output")
            lines.extend(grid_to_voxels(out, x_cursor + iw + arrow_gap + 1, 2, y=1))

            x_cursor += iw + arrow_gap + 1 + ow + gap

    # Test input
    lines.append(f"-- Test input (SOLVE THIS)")
    test_inp = test[0]['input']
    lines.extend(grid_to_voxels(test_inp, x_cursor, 2, y=1))

    # Question mark placeholder
    qx = x_cursor + len(test_inp[0]) + 2
    lines.append(f"-- ? (your answer goes here)")
    lines.append(f"B {qx} {max_h // 2 + 1} 2 1 1 1 6")

    return '\n'.join(lines)


def make_prompt(puzzle_data):
    """Generate LLM prompt for solving an ARC puzzle visually."""
    train = puzzle_data['train']
    test = puzzle_data['test']
    test_inp = test[0]['input']

    prompt = """You are solving an ARC (Abstraction and Reasoning) puzzle using voxels.

I'm showing you a 3D render of the puzzle. In the render you see:
- Training examples: INPUT → OUTPUT pairs (separated by orange dots)
- A test INPUT on the far right with a yellow "?" next to it

Each colored voxel represents a cell in a 2D grid, viewed from the front. The grid's row 0 is at the bottom, row N at the top.

ARC color mapping:
  0=black(empty), 1=blue, 2=red, 3=green, 4=yellow, 5=gray, 6=magenta, 7=orange, 8=cyan, 9=brown

Study the training examples. Find the pattern/rule that transforms each input into its output. Then apply that rule to the test input.

The test input grid is:
"""
    for row in test_inp:
        prompt += '  ' + ' '.join(str(c) for c in row) + '\n'

    prompt += f"\nGrid size: {len(test_inp)} rows x {len(test_inp[0])} columns"
    prompt += "\n\nWhat is the output grid? Give your answer as a grid of numbers (same format as above)."

    return prompt


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 arc-to-voxel.py <puzzle.json> [--prompt] [--test-only]")
        sys.exit(1)

    puzzle_path = sys.argv[1]
    show_prompt = '--prompt' in sys.argv
    test_only = '--test-only' in sys.argv

    with open(puzzle_path) as f:
        data = json.load(f)

    voxel_script = render_puzzle(data, test_only=test_only)
    print(voxel_script)

    if show_prompt:
        print("\n\n=== LLM PROMPT ===\n")
        print(make_prompt(data))
