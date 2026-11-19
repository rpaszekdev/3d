# Mind's Eye — Specification & Guide

A pure-text 3D camera system that lets AI models "see" voxel scenes without a GPU or browser.

---

## 1. What Is the Mind's Eye?

The Mind's Eye is a **raycaster that turns 3D voxel grids into ASCII art**. It shoots
rays from a virtual camera through a voxel grid and produces a 2D text image where each
character tells you two things:

1. **Whether a voxel was hit** (`.` means empty, a digit means solid)
2. **How deep that voxel is** (the digit `0`–`9`)

This gives an AI model (or a human reading a terminal) the ability to inspect a 3D scene
from any angle — without needing a graphical display.

---

## 2. How Depth Numbers Work

This is the most important concept. When the Mind's Eye renders a view, every pixel in the
output is one of:

| Character | Meaning                                    |
|-----------|--------------------------------------------|
| `.`       | Empty — the ray hit nothing                |
| `0`       | Hit a voxel at the **front surface** (closest to camera) |
| `1`       | Hit a voxel **slightly behind** the front surface |
| `2`–`8`   | Progressively **deeper** into the scene    |
| `9`       | Hit a voxel at the **back** of the scene (farthest from camera) |

The numbers are **relative to the view depth**. A `0` always means "right at the front",
and `9` always means "right at the back". The system scales the actual depth into this
0–9 range.

### Example: A Sphere

A sphere is the clearest way to see depth in action. Here is a sphere of radius 6
centered in a 16x16x16 grid, viewed from the front:

```
FRONT (→X, ↑Y)
               1 1 1 1 1 1
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
 . . . . . . . . . . . . . . . .
 . . . . . . . . 5 . . . . . . .    ← top of sphere, ray enters late = deep
 . . . . . 4 4 3 3 3 4 4 . . . .
 . . . . 4 3 2 2 2 2 2 3 4 . . .
 . . . 4 3 2 2 2 2 2 2 2 3 4 . .
 . . . 4 2 2 2 2 2 2 2 2 2 4 . .
 . . . 3 2 2 2 2 2 2 2 2 2 3 . .
 . . 5 3 2 2 2 2 1 2 2 2 2 3 5 .    ← dead center = closest = 1
 . . . 3 2 2 2 2 2 2 2 2 2 3 . .
 . . . 4 2 2 2 2 2 2 2 2 2 4 . .
 . . . 4 3 2 2 2 2 2 2 2 3 4 . .
 . . . . 4 3 2 2 2 2 2 3 4 . . .
 . . . . . 4 4 3 3 3 4 4 . . . .
 . . . . . . . . 5 . . . . . . .    ← bottom edge, deep again
 . . . . . . . . . . . . . . . .
```

**Reading this image:**

- The **center** shows `1` — this is the closest point of the sphere to the camera
  (the "nose" of the sphere, almost touching the front face)
- Moving outward, depths increase: `2`, `3`, `4`, `5` — the surface curves **away**
  from you, so the ray has to travel further before hitting it
- The **edges** show `4` and `5` — these are the silhouette, where the ray barely
  grazes the sphere's surface far from the front

Think of it like this:

```
Camera                             Sphere cross-section
  |                                    ╭───────╮
  |  ray at center ─────────── 1 ────▶│        │
  |  ray at mid ──────────── 2 ──────▶│        │
  |  ray at edge ─────────── 5 ───────▶╰      │
  |  ray at empty ──── . ──────────────────────▶  (miss)
```

### Depth changes with viewing direction

The **same sphere** viewed from the **right** side looks different:

```
FRONT (→X, ↑Y)                       RIGHT (→Z, ↑Y)
. . . . . . . . . . . . . . . .     . . . . . . . . . . . . . . . .
. . . . . . . . 5 . . . . . . .     . . . . . . . . 4 . . . . . . .
. . . . . 4 4 3 3 3 4 4 . . . .     . . . . . 4 3 2 2 2 3 4 . . . .
. . . . 4 3 2 2 2 2 2 3 4 . . .     . . . . 3 2 2 2 2 2 2 2 3 . . .
. . . 4 3 2 2 2 2 2 2 2 3 4 . .     . . . 4 2 2 2 1 1 1 2 2 2 4 . .
. . . 4 2 2 2 2 2 2 2 2 2 4 . .     . . . 3 2 2 1 1 1 1 1 2 2 3 . .
. . . 3 2 2 2 2 2 2 2 2 2 3 . .     . . . 2 2 1 1 1 1 1 1 1 2 2 . .
. . 5 3 2 2 2 2 1 2 2 2 2 3 5 .     . . 4 2 2 1 1 1 1 1 1 1 2 2 4 .
. . . 3 2 2 2 2 2 2 2 2 2 3 . .     . . . 2 2 1 1 1 1 1 1 1 2 2 . .
```

Notice that the **right view** shows more `1`s (close voxels) across the center.
That's because from the right, the camera is looking along the Z axis, and the sphere's
center section is **flat-on** to that camera — many voxels at similar shallow depth.

From the front, only the very tip is at depth 1. From the side, a whole band is at depth 1.
**Same object, different depth maps, because the camera angle changed.**

---

## 3. Camera Commands

### LOOK — Single orthographic view

```
LOOK front | back | left | right | top | bottom
```

Projects the entire grid from one of 6 axis-aligned directions. Each view has a label
showing which axes map to columns (→) and rows (↑):

| View     | Columns (→) | Rows (↑) | Camera looks toward |
|----------|-------------|----------|---------------------|
| `front`  | X           | Y        | +Z direction        |
| `back`   | X           | Y        | −Z direction        |
| `left`   | Z           | Y        | +X direction        |
| `right`  | Z           | Y        | −X direction        |
| `top`    | X           | Z        | −Y direction        |
| `bottom` | X           | Z        | +Y direction        |

### WIDE — 6-angle overview

```
WIDE
```

Shows all 6 views arranged like an unfolded cube:

```
         [  TOP  ]
[LEFT]   [FRONT]   [RIGHT]
         [BOTTOM]
         [ BACK ]
```

### ZOOM — Crop to a region

```
ZOOM cx cy cz radius [view]
```

Zooms into a spherical region centered at (cx, cy, cz). Shows the requested view plus
two orthogonal views for spatial context.

**Example from the demo scene** — zooming into the brain:

```
ZOOM center=(10,16,24) radius=8

FRONT (→X, ↑Y) [x:2-19 y:8-25]
                       1 1 1 1 1 1 1
   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6
 0 . . . . . . . . . . . . . . . . .
 1 . . . . . . . . . . . . . . . . .
 2 . . . . . . . . 5 . . . . . . . .
 3 . . . . . 4 3 3 3 3 3 4 . . . . .
 4 . . . . 3 3 2 2 2 2 2 2 3 . . . .
 5 . . . 4 3 2 2 2 2 2 2 2 3 4 . . .
 6 . . . 3 2 2 2 2 2 2 2 2 2 3 . . .
 7 . . . 3 2 2 2 2 2 2 2 2 2 3 . . .
 8 . . 5 3 2 2 2 2 1 2 2 2 2 3 5 . .    ← sphere center
 9 . . . 3 2 2 2 2 2 2 2 2 2 3 . . 5
10 . . . 3 2 2 2 2 2 2 2 2 2 3 5 5 5    ← yellow sparks (5=far)
11 . . . 4 3 2 2 2 2 2 2 2 3 4 . . 5
12 . . . . 3 3 2 2 2 2 2 3 3 . . . .
13 . . . . . 4 3 3 3 3 3 4 . . . . .
14 . . . . . . 5 4 3 4 5 . . . . .      ← brain stem below
15 . . . . . . 5 4 3 4 5 . . . . .
16 . . . . . . 5 4 3 4 5 . . . . .
```

The brain sphere is clearly visible with its depth gradient and the narrow stem below.

### SLICE — Cross-section

```
SLICE y=N | x=N | z=N
```

Cuts through the grid at a single coordinate, showing the **actual color** of each voxel
(not depth). This is like an MRI scan — it reveals internal structure that no external
view can see.

**Example** — slicing a sphere horizontally at its center:

```
SLICE y=8 (→X, ↑Z) — colors shown
. . . . . . . . . . . . . . . .
. . . . . . . . 7 . . . . . . .
. . . . . 7 7 7 7 7 7 7 . . . .
. . . . 7 7 7 7 7 7 7 7 7 . . .
. . . 7 7 7 7 7 7 7 7 7 7 7 . .
. . . 7 7 7 7 7 7 7 7 7 7 7 . .      all 7 = orange (the sphere's color)
. . . 7 7 7 7 7 7 7 7 7 7 7 . .
. . 7 7 7 7 7 7 7 7 7 7 7 7 7 .
. . . 7 7 7 7 7 7 7 7 7 7 7 . .
. . . 7 7 7 7 7 7 7 7 7 7 7 . .
```

**Key difference from LOOK:** SLICE shows **colors** (what the voxel IS), while LOOK
shows **depth** (how far away it is). Slice output uses hex color codes (0–f), not
depth numbers.

### WHAT — Identify a pixel

```
WHAT view col row
```

Traces a single ray from a 2D pixel back into 3D space. Returns:
- The 3D coordinate it hits
- The color of that voxel
- How deep the hit was
- Which line of VOXI source code created it

**Example** — clicking on the brain's center in the front view:

```
WHAT front col=10 row=16
→ 3D position: (10, 15, 19)
→ Color: magenta (5)
→ Depth: 19
→ Source:
  line 16: S 10 16 24 6 5
→ To edit: P 10 15 19 <color>
```

This tells us: the pixel at column 10, row 16 in the front view corresponds to the voxel
at (10, 15, 19) in 3D space, which was created by a Sphere command on line 16 of the
VOXI file.

### COMPARE — Two views side by side

```
COMPARE view1 view2
```

Shows two views next to each other for quick comparison.

### AROUND — Orbit a point

```
AROUND cx cy cz radius
```

Shows front, right, back, and left views all cropped to the same region — like walking
around an object.

### Other Commands

| Command           | Description                               |
|-------------------|-------------------------------------------|
| `FOCUS x y z w h d` | Crop to a box region                   |
| `PAINT view col row color` | Set a voxel through the camera   |
| `ERASE view col row`      | Remove a voxel through the camera |
| `DIFF`            | Show changes since last snapshot           |
| `INFO`            | Scene statistics (grid size, voxel count, color breakdown) |

---

## 4. The Reasoning Loop

The Mind's Eye is designed for an **iterative reasoning workflow** where an AI model
thinks spatially by sketching and verifying:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────┐      writes       ┌──────────┐     renders    │
│   │  BRAIN  │  ──────────────▶  │  SKETCH  │  ──────────▶   │
│   │  (LLM)  │    VOXI code      │ (voxels) │   ASCII views  │
│   └─────────┘                   └──────────┘                 │
│        ▲                                           │         │
│        │            verification                   │         │
│        └───────────────────────────────────────────┘         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Step 1 — Reason:** The LLM describes what it expects to see in 3D space.

**Step 2 — Sketch:** It writes VOXI code — a simple language where `B 5 0 5 3 4 3 7`
means "place an orange box at (5,0,5) of size 3x4x3".

**Step 3 — Render:** The Mind's Eye raycasts the sketch from multiple angles, producing
depth maps like the ones shown above.

**Step 4 — Verify:** The LLM (or a separate verifier) examines the renders. Did the
sphere end up in the right place? Is the house roof above the walls?

**Step 5 — Revise:** Fix errors, re-sketch, re-render. Repeat until confident.

This cycle gives LLMs a **visual scratchpad** for 3D reasoning — the same way a human
might rotate a physical model or sketch on a whiteboard to think through a spatial problem.

---

## 5. VOXI Language Quick Reference

The Mind's Eye renders scenes written in VOXI, a voxel description language:

```
V W H D          — Set grid size (e.g. V 32 32 32)
B X Y Z W H D C  — Box at position (X,Y,Z), size (W,H,D), color C
S X Y Z R C      — Sphere at center (X,Y,Z), radius R, color C
C X Y Z R H C    — Cylinder at center, radius R, height H, color C
K X Y Z R H C    — Cone at center, radius R, height H, color C
P X Y Z C        — Single voxel point at (X,Y,Z), color C
E X Y Z RX RY RZ C — Ellipsoid at center, radii, color C
D X Y Z W H D C  — Dome at position, size, color C
G name / /G      — Define a named group
@ name X Y Z    — Place a group copy at offset
-- comment       — Comment line
```

**Colors:** `0`=black `1`=red `2`=green `3`=blue `4`=cyan `5`=magenta `6`=yellow
`7`=orange `8`=white `9`=gray `a`=brown `b`=pink `c`=dark-green `d`=tan `e`=maroon `f`=navy

**Coordinate system:** Y axis is UP. Origin (0,0,0) is the bottom-left-front corner.

---

## 6. Full Demo Scene — "How the Mind's Eye Works"

The file `minds-eye-demo.voxi` contains a 48x32x48 scene that visualises the architecture
described in Section 4. Here is its front view:

```
FRONT (→X, ↑Y) — 48 wide, 32 tall
 BRAIN (left)          SKETCH (center)         EYE (right)
 ┌─ magenta sphere     ┌─ cyan wireframe       ┌─ white/blue eyeball
 │  with pink ridges   │  containing tiny      │  with yellow vision
 │  and yellow sparks  │  orange house with    │  rays shooting toward
 │  (neural activity)  │  red roof, green      │  the sketch
 │                     │  ground, brown door   │
 └─ gray stem on       └─ floating in space    └─ gray pedestal
    pedestal

          ──green──▶          ──cyan──▶
  BRAIN               SKETCH              EYE
          ◀──────── red feedback ────────┘
                  (visible at y=5 slice)
```

```
. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
. . . . . . . . . . 5 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
. . . . . . . 4 4 4 4 4 4 4 . . . . . . . . . . . . . . . . . . . . . . . . 5 . . . . . . . . .
. . . . . . 4 4 4 4 4 4 4 4 4 . . . . . . . . . . . . . . . . 4 4 5 . 5 4 4 4 4 4 5 . . . . . .
. . . . . 4 4 4 4 4 4 4 4 4 4 4 . . . . . . . . . . . . . . . . . . 5 4 4 4 4 4 4 4 5 . . . . .
. . . . . 4 4 4 4 4 4 4 4 4 4 4 . . . 4 4 4 4 4 4 4 4 4 4 . . 4 4 4 4 4 3 3 3 3 3 4 4 . . . . .
. . . . . 4 4 4 4 4 4 4 4 4 4 4 . . . 4 . . . 5 5 . . . 4 . . . . . 4 4 3 3 3 3 3 4 4 . . . . .
. . . . 5 4 4 4 4 4 3 4 4 4 4 4 5 . . 4 . . 4 4 4 4 . . 4 . 4 4 4 4 4 4 3 3 3 3 3 4 4 5 . . . .
. . . . . 4 4 4 4 4 4 4 4 4 4 4 . . 5 4 . 4 4 4 4 4 4 . 4 . . 5 . . 4 4 3 3 3 3 3 4 4 . . . . .
. . . . . 4 4 4 4 4 4 4 4 4 4 4 5 5 5 4 4 4 4 4 4 4 4 4 4 5 5 4 4 4 4 4 3 3 3 3 3 4 4 . . . . .
. . . . . 4 4 4 4 4 4 4 4 4 4 4 . . 5 4 . 4 4 4 4 4 4 . 4 . . 5 . . 5 4 4 4 4 4 4 4 5 . . . . .
. . . . . . 4 4 4 4 4 4 4 4 4 . . . . 4 . 4 4 4 4 4 4 . 4 . . 4 4 5 . 5 4 4 4 4 4 5 . . . . . .
. . . . . . . 4 4 4 4 4 4 4 . . . . . 4 . 4 4 4 4 4 4 . 4 . . . . . . . . . 5 . . . . . . . . .
. . . . . . . . 5 4 4 4 5 . . . . . . 4 . 4 4 4 4 4 4 . 4 . . . . . . . . . . . . . . . . . . .
. . . . . . . . 5 4 4 4 5 . . . . . . 4 . 4 4 4 4 4 4 . 4 . . . . . . . . . . . . . . . . . . .
. . . . . . . . 5 4 4 4 5 . . . . . . 4 4 4 4 4 4 4 4 4 4 . . . . . . . . . . . . . . . . . . .
. . . . . . . . 5 4 4 4 5 . . . . . . . . . . . . . . . . . . . . . . 5 4 4 4 4 4 5 . . . . . .
. . . . . . . . 5 4 4 4 5 . . . . . . . . . . . . . . . . . . . . . . 5 4 4 4 4 4 5 . . . . . .
. . . . . . . . . . 5 4 4 4 4 4 3 3 3 3 3 2 2 2 2 2 2 2 2 2 2 2 2 2 3 3 3 3 3 4 4 5 . . . . . .
. . . . . . . . . . . 4 . . . . . . . . . . . . . . . . . . . . . . . 5 4 4 4 4 4 5 . . . . . .
. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 5 4 4 4 4 4 5 . . . . . .
. . . . . 4 4 4 4 4 4 4 4 4 4 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
```

The bottom row of `0`s is the ground plane — depth 0 because it's right at the front face
of the grid. The brain sphere shows `4`s and `3`s because it's centered deep in the scene
(z=24 in a 48-deep grid). The eye on the right shows `3`s and `4`s at its core for
the same reason.

---

## 7. Key Takeaways

1. **Depth numbers are relative**, not absolute. `0` = closest to camera, `9` = farthest.
   The same voxel shows different depth numbers from different camera angles.

2. **LOOK shows depth, SLICE shows color.** LOOK tells you "how far away is this?".
   SLICE tells you "what is this made of?". Both are essential for spatial reasoning.

3. **WHAT traces pixels back to code.** You can click any pixel in a view and find out
   exactly which 3D coordinate and which VOXI source line produced it.

4. **No GPU needed.** The entire system runs as pure JavaScript text processing. This
   makes it usable by AI models that can only read and write text — they can "see" 3D
   scenes through these ASCII depth maps.

5. **The reasoning loop is the real innovation.** The Mind's Eye isn't just a renderer —
   it's a thinking tool. By sketching in VOXI, rendering, verifying, and revising, an AI
   can iteratively build spatial understanding the way a human sketches on a whiteboard.
