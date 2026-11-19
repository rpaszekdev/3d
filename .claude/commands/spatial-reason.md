---
description: Reason about a spatial/3D problem using VOXI voxel sketches with visual verification
argument-hint: <spatial question or algorithm to reason about>
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Agent]
---

# Spatial Reasoning with VOXI

The user wants to reason about a spatial or 3D problem using the VOXI voxel language as a visual thinking tool.

## The Problem

$ARGUMENTS

## Your Workflow

You are a spatial reasoning agent. You solve 3D algorithms and spatial problems by **sketching intermediate states** in VOXI code, rendering them, and verifying your understanding visually.

### Step 1: Reason in text
Describe the spatial problem. What do you expect to see? What are the geometric relationships?

### Step 2: Sketch in VOXI
Write a VOXI code block to visualize the current state. Use these color conventions:
- **1 (red)** = important / highlighted / hidden elements
- **2 (green)** = "inside" or visible / positive
- **4 (cyan)** = rays, lines, connections, paths
- **6 (yellow)** = current focus / active element / camera
- **7 (orange)** = surfaces, boundaries, objects
- **9 (gray)** = background geometry, walls, floors
- **0 (black)** = avoid on large areas (dark renderer background)

### Step 3: Render and verify
Use the voxi-reasoning server to render and capture screenshots:

```bash
# Ensure server is running (port 3334)
cd ~/Desktop/Research/spatial-reasoning-dsl/voxi-reasoning
node server.js &
# Browser must be open at http://localhost:3334

# Run the reasoning session
node reason.js "<question>" --steps 4
```

Or render a single sketch manually by sending it to the render server:

```bash
curl -X POST http://localhost:3334/render \
  -H 'Content-Type: application/json' \
  -d '{"code": "V 16 16 16\nB 6 1 6 4 4 4 7"}'
```

### Step 4: Read screenshots and verify
Look at the rendered output from multiple angles. Does it match your mental model? What spatial errors do you see?

### Step 5: Revise and repeat
Fix your understanding, update the sketch, re-render. Continue until confident.

## VOXI Language Reference

```
V W H D          — Set grid size (e.g. V 32 32 32)
B X Y Z W H D C  — Box at position, size, color
S X Y Z R C      — Sphere at center, radius, color
C X Y Z R H C    — Cylinder at center, radius, height, color
K X Y Z R H C    — Cone at center, radius, height, color
P X Y Z C        — Single voxel point
E X Y Z RX RY RZ C — Ellipsoid at center, radii, color
D X Y Z W H D C  — Dome at position, size, color
G name / /G       — Named group
@ name X Y Z     — Place group copy at offset
-- comment
```

Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray a=brown b=pink c=dark-green d=tan e=maroon f=navy

Y axis is UP. Grid origin (0,0,0) is bottom-left-front corner.

## Key Principles

- You are NOT generating art. You are using voxels as a **thinking tool**.
- Keep sketches focused — show ONE concept per sketch.
- Use comments (--) heavily to label what each part represents.
- Use small grids (16x16x16) for fast iteration.
- Messy is fine. Clarity > beauty.

## Infrastructure

The voxi-reasoning system is at: `~/Desktop/Research/spatial-reasoning-dsl/voxi-reasoning/`

Files:
- `reason.js` — automated reasoning loop (reason → sketch → render → verify → repeat)
- `server.js` — render server on port 3334
- `prompts.js` — system prompts for reasoner and verifier
- `llm.js` — Claude CLI bridge

The renderer uses the same `v4-voxel.html` as the main V4 editor.
