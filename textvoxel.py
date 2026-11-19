"""
TextVoxel — 3D voxel grids as parsable text for LLM spatial reasoning.

Instead of rendering images, this represents 3D space as text slices
that an LLM can read, reason about, and manipulate symbolically.

Usage:
    from textvoxel import Grid, move, rotate_y, fill_box, snapshot, diff

    g = Grid(8, 8, 8)
    g = fill_box(g, 2, 0, 2, 4, 4, 4, "7")  # orange box
    g = set_voxel(g, 5, 2, 5, "1")           # red point
    print(snapshot(g))
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Optional
import copy
import math


# ── Color Map (matches VOXI conventions) ─────────────────────────────

COLORS = {
    ".": "empty",
    "0": "black",
    "1": "red",
    "2": "green",
    "3": "blue",
    "4": "cyan",
    "5": "magenta",
    "6": "yellow",
    "7": "orange",
    "8": "white",
    "9": "gray",
    "a": "brown",
    "b": "pink",
    "c": "dark-green",
    "d": "tan",
    "e": "maroon",
    "f": "navy",
}


# ── Grid ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Grid:
    """Immutable 3D voxel grid. All operations return new grids."""
    w: int
    h: int
    d: int
    data: tuple = field(default=None, repr=False)

    def __post_init__(self):
        if self.data is None:
            # frozen=True requires object.__setattr__
            object.__setattr__(self, "data", tuple("." * (self.w * self.h * self.d)))

    def _idx(self, x: int, y: int, z: int) -> int:
        return y * (self.w * self.d) + z * self.w + x

    def get(self, x: int, y: int, z: int) -> str:
        if 0 <= x < self.w and 0 <= y < self.h and 0 <= z < self.d:
            return self.data[self._idx(x, y, z)]
        return "."

    def in_bounds(self, x: int, y: int, z: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h and 0 <= z < self.d

    def occupied(self, x: int, y: int, z: int) -> bool:
        return self.get(x, y, z) != "."

    def count(self, color: str = None) -> int:
        if color:
            return sum(1 for v in self.data if v == color)
        return sum(1 for v in self.data if v != ".")


def _with_data(grid: Grid, new_data: list) -> Grid:
    """Create a new grid with updated data (immutable pattern)."""
    return Grid(grid.w, grid.h, grid.d, tuple(new_data))


# ── Setters ──────────────────────────────────────────────────────────

def set_voxel(grid: Grid, x: int, y: int, z: int, color: str) -> Grid:
    if not grid.in_bounds(x, y, z):
        return grid
    data = list(grid.data)
    data[grid._idx(x, y, z)] = color
    return _with_data(grid, data)


def clear_voxel(grid: Grid, x: int, y: int, z: int) -> Grid:
    return set_voxel(grid, x, y, z, ".")


# ── Primitives ───────────────────────────────────────────────────────

def fill_box(grid: Grid, x: int, y: int, z: int,
             w: int, h: int, d: int, color: str) -> Grid:
    data = list(grid.data)
    for dy in range(h):
        for dz in range(d):
            for dx in range(w):
                px, py, pz = x + dx, y + dy, z + dz
                if grid.in_bounds(px, py, pz):
                    data[grid._idx(px, py, pz)] = color
    return _with_data(grid, data)


def fill_sphere(grid: Grid, cx: int, cy: int, cz: int,
                r: int, color: str) -> Grid:
    data = list(grid.data)
    for y in range(max(0, cy - r), min(grid.h, cy + r + 1)):
        for z in range(max(0, cz - r), min(grid.d, cz + r + 1)):
            for x in range(max(0, cx - r), min(grid.w, cx + r + 1)):
                if (x - cx)**2 + (y - cy)**2 + (z - cz)**2 <= r**2:
                    data[grid._idx(x, y, z)] = color
    return _with_data(grid, data)


def fill_line(grid: Grid, x0: int, y0: int, z0: int,
              x1: int, y1: int, z1: int, color: str) -> Grid:
    """Draw a 3D line using Bresenham-like stepping."""
    data = list(grid.data)
    dx, dy, dz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    steps = max(dx, dy, dz) or 1
    for i in range(steps + 1):
        t = i / steps
        x = round(x0 + (x1 - x0) * t)
        y = round(y0 + (y1 - y0) * t)
        z = round(z0 + (z1 - z0) * t)
        if grid.in_bounds(x, y, z):
            data[grid._idx(x, y, z)] = color
    return _with_data(grid, data)


# ── Transforms ───────────────────────────────────────────────────────

def move(grid: Grid, dx: int, dy: int, dz: int,
         color_filter: str = None) -> Grid:
    """Move all voxels (or only those matching color_filter) by offset."""
    data = list("." * len(grid.data))
    for y in range(grid.h):
        for z in range(grid.d):
            for x in range(grid.w):
                v = grid.get(x, y, z)
                if v == ".":
                    continue
                if color_filter and v != color_filter:
                    # Keep non-matching voxels in place
                    data[grid._idx(x, y, z)] = v
                    continue
                nx, ny, nz = x + dx, y + dy, z + dz
                if grid.in_bounds(nx, ny, nz):
                    data[grid._idx(nx, ny, nz)] = v
    return _with_data(grid, data)


def rotate_y(grid: Grid, quarters: int = 1) -> Grid:
    """Rotate entire grid around Y axis by 90-degree increments."""
    quarters = quarters % 4
    if quarters == 0:
        return grid
    result = grid
    for _ in range(quarters):
        data = list("." * len(result.data))
        # For Y-axis rotation: (x,z) -> (z, w-1-x)
        new_w, new_d = result.d, result.w
        new_grid = Grid(new_w, result.h, new_d)
        for y in range(result.h):
            for z in range(result.d):
                for x in range(result.w):
                    v = result.get(x, y, z)
                    if v != ".":
                        nx, nz = z, result.w - 1 - x
                        if new_grid.in_bounds(nx, y, nz):
                            data[new_grid._idx(nx, y, nz)] = v
        result = _with_data(new_grid, data)
    return result


def mirror_x(grid: Grid) -> Grid:
    """Mirror grid along X axis."""
    data = list("." * len(grid.data))
    for y in range(grid.h):
        for z in range(grid.d):
            for x in range(grid.w):
                v = grid.get(x, y, z)
                if v != ".":
                    data[grid._idx(grid.w - 1 - x, y, z)] = v
    return _with_data(grid, data)


def flood_fill(grid: Grid, x: int, y: int, z: int, color: str) -> Grid:
    """Flood fill empty space starting from (x,y,z)."""
    if not grid.in_bounds(x, y, z) or grid.occupied(x, y, z):
        return grid
    data = list(grid.data)
    stack = [(x, y, z)]
    visited = set()
    while stack:
        cx, cy, cz = stack.pop()
        if (cx, cy, cz) in visited:
            continue
        if not grid.in_bounds(cx, cy, cz):
            continue
        if data[grid._idx(cx, cy, cz)] != ".":
            continue
        visited.add((cx, cy, cz))
        data[grid._idx(cx, cy, cz)] = color
        for ddx, ddy, ddz in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
            stack.append((cx+ddx, cy+ddy, cz+ddz))
    return _with_data(grid, data)


# ── Queries ──────────────────────────────────────────────────────────

def find_all(grid: Grid, color: str) -> list[tuple[int, int, int]]:
    """Find all voxel positions matching a color."""
    results = []
    for y in range(grid.h):
        for z in range(grid.d):
            for x in range(grid.w):
                if grid.get(x, y, z) == color:
                    results.append((x, y, z))
    return results


def neighbors(grid: Grid, x: int, y: int, z: int) -> dict:
    """Return the 6 face-adjacent neighbors and their values."""
    dirs = {
        "+x": (x+1, y, z), "-x": (x-1, y, z),
        "+y": (x, y+1, z), "-y": (x, y-1, z),
        "+z": (x, y, z+1), "-z": (x, y, z-1),
    }
    return {name: grid.get(*pos) for name, pos in dirs.items()}


def path_exists(grid: Grid, start: tuple, end: tuple,
                through_empty: bool = True) -> bool:
    """BFS check: can we walk from start to end through empty (or filled) space?"""
    if start == end:
        return True
    target = "." if through_empty else None
    visited = {start}
    queue = [start]
    while queue:
        cx, cy, cz = queue.pop(0)
        for ddx, ddy, ddz in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
            nx, ny, nz = cx+ddx, cy+ddy, cz+ddz
            pos = (nx, ny, nz)
            if pos in visited or not grid.in_bounds(nx, ny, nz):
                continue
            v = grid.get(nx, ny, nz)
            if through_empty and v != ".":
                continue
            if not through_empty and v == ".":
                continue
            if pos == end:
                return True
            visited.add(pos)
            queue.append(pos)
    return False


def find_path(grid: Grid, start: tuple, end: tuple) -> list[tuple] | None:
    """BFS shortest path through empty space. Returns list of positions or None."""
    if start == end:
        return [start]
    visited = {start: None}
    queue = [start]
    while queue:
        cx, cy, cz = queue.pop(0)
        for ddx, ddy, ddz in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
            nx, ny, nz = cx+ddx, cy+ddy, cz+ddz
            pos = (nx, ny, nz)
            if pos in visited or not grid.in_bounds(nx, ny, nz):
                continue
            if grid.get(nx, ny, nz) != "." and pos != end:
                continue
            visited[pos] = (cx, cy, cz)
            if pos == end:
                path = []
                p = pos
                while p is not None:
                    path.append(p)
                    p = visited[p]
                return list(reversed(path))
            queue.append(pos)
    return None


def raycast(grid: Grid, origin: tuple, direction: tuple,
            max_steps: int = 64) -> tuple | None:
    """Cast a ray, return first hit position or None."""
    x, y, z = float(origin[0]), float(origin[1]), float(origin[2])
    dx, dy, dz = direction
    mag = math.sqrt(dx*dx + dy*dy + dz*dz) or 1
    dx, dy, dz = dx/mag, dy/mag, dz/mag
    for _ in range(max_steps):
        x, y, z = x + dx*0.5, y + dy*0.5, z + dz*0.5
        ix, iy, iz = round(x), round(y), round(z)
        if not grid.in_bounds(ix, iy, iz):
            return None
        if grid.occupied(ix, iy, iz):
            return (ix, iy, iz)
    return None


def visible_from(grid: Grid, eye: tuple, target: tuple) -> bool:
    """Is there a clear line of sight from eye to target?"""
    dx = target[0] - eye[0]
    dy = target[1] - eye[1]
    dz = target[2] - eye[2]
    dist = math.sqrt(dx*dx + dy*dy + dz*dz)
    if dist < 1:
        return True
    hit = raycast(grid, eye, (dx, dy, dz), max_steps=int(dist * 3))
    if hit is None:
        return True
    # Hit something — is it at or beyond the target?
    hd = math.sqrt((hit[0]-eye[0])**2 + (hit[1]-eye[1])**2 + (hit[2]-eye[2])**2)
    return hd >= dist - 0.5


# ── Text Rendering ───────────────────────────────────────────────────

def snapshot(grid: Grid, label: str = "", show_empty_layers: bool = False,
             coords: bool = True) -> str:
    """Render grid as text layer slices (Y = up).

    This is the primary output format — what the LLM reads to understand
    the 3D spatial state.
    """
    lines = []
    if label:
        lines.append(f"=== {label} === ({grid.w}x{grid.h}x{grid.d})")
    else:
        lines.append(f"Grid {grid.w}x{grid.h}x{grid.d}  (Y=up, Z=rows, X=cols)")
    lines.append("")

    for y in range(grid.h):
        # Check if layer has content
        has_content = any(
            grid.get(x, y, z) != "."
            for z in range(grid.d) for x in range(grid.w)
        )
        if not has_content and not show_empty_layers:
            continue

        lines.append(f"Y={y}:")
        if coords:
            # Column header (X axis)
            header = "  " + " ".join(str(x % 10) for x in range(grid.w))
            lines.append(header)

        for z in range(grid.d):
            row = " ".join(grid.get(x, y, z) for x in range(grid.w))
            if coords:
                row = f"{z:>1} " + row
            lines.append(row)
        lines.append("")

    # Summary
    occupied = grid.count()
    if occupied:
        colors_used = {}
        for v in grid.data:
            if v != ".":
                colors_used[v] = colors_used.get(v, 0) + 1
        summary = ", ".join(f"{COLORS.get(c, c)}({c})={n}" for c, n in sorted(colors_used.items()))
        lines.append(f"Occupied: {occupied} voxels — {summary}")
    else:
        lines.append("Empty grid")

    return "\n".join(lines)


def projection(grid: Grid, axis: str = "top") -> str:
    """2D projection — top (Y-down), front (Z-facing), or side (X-facing).

    Shows the first non-empty voxel from that viewing direction.
    Useful for quick spatial overview without reading all layers.
    """
    lines = [f"Projection: {axis}"]

    if axis == "top":
        lines.append("  (looking down, X=cols, Z=rows)")
        header = "  " + " ".join(str(x % 10) for x in range(grid.w))
        lines.append(header)
        for z in range(grid.d):
            row = []
            for x in range(grid.w):
                v = "."
                for y in range(grid.h - 1, -1, -1):
                    if grid.get(x, y, z) != ".":
                        v = grid.get(x, y, z)
                        break
                row.append(v)
            lines.append(f"{z:>1} " + " ".join(row))

    elif axis == "front":
        lines.append("  (looking from front, X=cols, Y=rows bottom-up)")
        header = "  " + " ".join(str(x % 10) for x in range(grid.w))
        lines.append(header)
        for y in range(grid.h - 1, -1, -1):
            row = []
            for x in range(grid.w):
                v = "."
                for z in range(grid.d):
                    if grid.get(x, y, z) != ".":
                        v = grid.get(x, y, z)
                        break
                row.append(v)
            lines.append(f"{y:>1} " + " ".join(row))

    elif axis == "side":
        lines.append("  (looking from right, Z=cols, Y=rows bottom-up)")
        header = "  " + " ".join(str(z % 10) for z in range(grid.d))
        lines.append(header)
        for y in range(grid.h - 1, -1, -1):
            row = []
            for z in range(grid.d):
                v = "."
                for x in range(grid.w - 1, -1, -1):
                    if grid.get(x, y, z) != ".":
                        v = grid.get(x, y, z)
                        break
                row.append(v)
            lines.append(f"{y:>1} " + " ".join(row))

    return "\n".join(lines)


def diff(before: Grid, after: Grid, label: str = "") -> str:
    """Show what changed between two grid states.

    + = added, - = removed, ~ = changed color
    """
    lines = []
    if label:
        lines.append(f"=== DIFF: {label} ===")

    added, removed, changed = [], [], []
    for y in range(before.h):
        for z in range(before.d):
            for x in range(before.w):
                b = before.get(x, y, z)
                a = after.get(x, y, z)
                if b == "." and a != ".":
                    added.append((x, y, z, a))
                elif b != "." and a == ".":
                    removed.append((x, y, z, b))
                elif b != a:
                    changed.append((x, y, z, b, a))

    if not added and not removed and not changed:
        lines.append("No changes")
        return "\n".join(lines)

    if added:
        lines.append(f"+ Added ({len(added)}):")
        for x, y, z, c in added[:20]:
            lines.append(f"  ({x},{y},{z}) = {c} ({COLORS.get(c, c)})")
        if len(added) > 20:
            lines.append(f"  ... and {len(added)-20} more")

    if removed:
        lines.append(f"- Removed ({len(removed)}):")
        for x, y, z, c in removed[:20]:
            lines.append(f"  ({x},{y},{z}) was {c} ({COLORS.get(c, c)})")
        if len(removed) > 20:
            lines.append(f"  ... and {len(removed)-20} more")

    if changed:
        lines.append(f"~ Changed ({len(changed)}):")
        for x, y, z, b, a in changed[:20]:
            lines.append(f"  ({x},{y},{z}) {b}→{a}")
        if len(changed) > 20:
            lines.append(f"  ... and {len(changed)-20} more")

    return "\n".join(lines)


# ── Iterative Reasoning Loop ────────────────────────────────────────

def solve_loop(grid: Grid, goal_fn: Callable[[Grid], bool],
               step_fn: Callable[[Grid, int], Grid],
               max_steps: int = 50) -> list[tuple[Grid, str]]:
    """Run transforms until goal is met. Returns list of (grid, snapshot) pairs.

    goal_fn: takes a Grid, returns True if goal is achieved
    step_fn: takes (Grid, step_number), returns new Grid
    """
    history = [(grid, snapshot(grid, label="Step 0"))]
    for i in range(1, max_steps + 1):
        grid = step_fn(grid, i)
        snap = snapshot(grid, label=f"Step {i}")
        history.append((grid, snap))
        if goal_fn(grid):
            break
    return history


# ── VOXI Interop ────────────────────────────────────────────────────

def to_voxi(grid: Grid) -> str:
    """Convert grid to VOXI code (for rendering in the 3D viewer)."""
    lines = [f"V {grid.w} {grid.h} {grid.d}"]
    for y in range(grid.h):
        for z in range(grid.d):
            for x in range(grid.w):
                v = grid.get(x, y, z)
                if v != ".":
                    lines.append(f"P {x} {y} {z} {v}")
    return "\n".join(lines)


def from_voxi(code: str) -> Grid:
    """Parse VOXI code into a Grid (supports P, B commands)."""
    w, h, d = 16, 16, 16
    deferred = []
    for line in code.strip().split("\n"):
        line = line.strip()
        if line.startswith("--") or not line:
            continue
        parts = line.split()
        if not parts:
            continue
        cmd = parts[0]
        if cmd == "V":
            w, h, d = int(parts[1]), int(parts[2]), int(parts[3])
        else:
            deferred.append(parts)

    grid = Grid(w, h, d)
    for parts in deferred:
        cmd = parts[0]
        if cmd == "P":
            grid = set_voxel(grid, int(parts[1]), int(parts[2]),
                             int(parts[3]), parts[4])
        elif cmd == "B":
            grid = fill_box(grid, int(parts[1]), int(parts[2]),
                            int(parts[3]), int(parts[4]),
                            int(parts[5]), int(parts[6]), parts[7])
        elif cmd == "S":
            grid = fill_sphere(grid, int(parts[1]), int(parts[2]),
                               int(parts[3]), int(parts[4]), parts[5])
    return grid


# ── Demo ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Build a scene: room with a pillar, check visibility
    g = Grid(10, 6, 10)

    # Floor
    g = fill_box(g, 0, 0, 0, 10, 1, 10, "9")

    # Walls
    g = fill_box(g, 0, 1, 0, 10, 5, 1, "9")   # back wall
    g = fill_box(g, 0, 1, 0, 1, 5, 10, "9")    # left wall
    g = fill_box(g, 9, 1, 0, 1, 5, 10, "9")    # right wall

    # Pillar in the middle
    g = fill_box(g, 4, 1, 4, 2, 5, 2, "7")

    # Camera at (2, 2, 8) — yellow
    g = set_voxel(g, 2, 2, 8, "6")

    # Target behind pillar at (7, 2, 3) — red
    g = set_voxel(g, 7, 2, 3, "1")

    print(snapshot(g, label="Room with pillar — can camera see target?"))
    print()
    print(projection(g, "top"))
    print()

    # Visibility check
    can_see = visible_from(g, (2, 2, 8), (7, 2, 3))
    print(f"\nCamera (6) at (2,2,8) can see target (1) at (7,2,3): {can_see}")

    # Find path around pillar
    path = find_path(g, (2, 2, 8), (7, 2, 3))
    if path:
        print(f"Path length: {len(path)} steps")
        # Mark path on grid
        g2 = g
        for px, py, pz in path[1:-1]:
            g2 = set_voxel(g2, px, py, pz, "4")
        print()
        print(projection(g2, "top"))
