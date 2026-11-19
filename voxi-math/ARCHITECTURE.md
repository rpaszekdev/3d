# VOXI Math — Architecture

## Core Principle
One grid, everything reads/writes to it. Simulation, visualization, and reasoning all share the same data structure. When we add octrees, they replace the flat grid but expose the same interface.

## Data Structure

```
VoxelField {
  grid: Float32Array[W * H * D * 4]   // vx, vy, vz, pressure per cell
  W, H, D: int                         // grid dimensions

  // Interface (same for flat grid AND octree later)
  get(x, y, z) → { vx, vy, vz, p }
  set(x, y, z, { vx, vy, vz, p })
  neighbors(x, y, z) → [6 adjacent cells]
  gradient(x, y, z) → { dvx/dx, dvy/dy, dvz/dz }
  vorticity(x, y, z) → { wx, wy, wz }
  magnitude(x, y, z) → scalar |v|
}
```

## Levels (each builds on previous)

### Level 1: Time Evolution
- Lattice Boltzmann or finite-difference NS solver on flat grid
- Outputs: velocity field at each timestep
- Mind's Eye views: color = velocity magnitude
- Commands: STEP N (advance N timesteps), PLAY (animate)

### Level 2: Adaptive Resolution (Octrees)
- Replace flat grid with octree
- Same interface: get/set/neighbors/gradient
- Auto-refine where |gradient| > threshold
- Mind's Eye ZOOM now adds real resolution, not just crops
- Track: max vorticity, gradient growth rate

### Level 3: Multiple Channels
- Mind's Eye renders any field: velocity, vorticity, pressure, energy
- LOOK front CHANNEL vorticity
- SLICE y=16 CHANNEL pressure
- Color maps configurable per channel

### Level 4: Formal Bounds
- After each timestep, compute: max|v|, max|ω|, total energy
- Track growth rates: is max|ω| growing? How fast?
- LLM reads bounds + views together
- Export conjectures as testable statements

### Level 5: Proof Connection
- LLM proposes inequality (e.g., "‖ω‖ ≤ C·t^(-1/2)")
- System tests against simulation data
- If holds across all runs → candidate lemma
- Optional: export to Lean4 for formal verification

## File Structure
```
voxi-math/
  field.js          — VoxelField class (flat grid now, octree later)
  simulate.js       — NS solver (reads/writes VoxelField)
  channels.js       — Convert field data → VOXI color codes
  evolve.js         — CLI: run simulation + Mind's Eye observation loop
  ARCHITECTURE.md   — this file
```

## Key Design Decisions

1. **VoxelField interface is stable** — simulation and visualization code won't change when we swap flat grid for octree
2. **Channels are separate from geometry** — same field, different views (velocity vs vorticity vs pressure)
3. **Simulation is synchronous** — one timestep at a time, Mind's Eye can inspect between any two steps
4. **Everything outputs VOXI** — simulation state can always be exported as a .voxi file for the existing renderer
