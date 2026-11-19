# Voxel Algorithms & Data Structures — Research Summary

## Key Algorithms for VOXI

### Octree / Sparse Voxel Octree (SVO)
- Recursively subdivides 3D space into 8 octants
- Only stores occupied regions (sparse)
- Natural LOD: stop subdivision early = automatic level of detail
- **VOXI use**: backing store for zoom/LOD, the "looking at trees" concept
- Papers: Laine & Karras (NVIDIA 2010), GigaVoxels (Crassin 2009)
- Tools: OpenVDB, goxel

### Signed Distance Fields (SDF)
- Each point stores distance to nearest surface (positive=outside, negative=inside)
- Resolution-independent — evaluate at any grid density on demand
- Primitives: sphere, box, torus, plane all have closed-form expressions
- CSG: union=min(a,b), subtract=max(a,-b), intersect=max(a,b)
- Smooth blending via smooth_min for organic shapes
- **VOXI use**: replace B/S/E with math formulas, infinite zoom
- Reference: Inigo Quilez (iquilezles.org)

### Marching Cubes
- Converts scalar field/SDF to triangle mesh
- 256 lookup table cases (15 canonical)
- Dual Contouring preserves sharp edges
- Surface Nets = simpler alternative
- **VOXI use**: smooth mesh export, "Mesh" button in renderer

### Voxel Ray Casting (Amanatides-Woo)
- DDA algorithm stepping through voxel grid boundaries
- O(n) where n = voxels traversed
- Returns hit position + which face was hit
- **VOXI use**: already used in Mind's Eye WHAT command, visibility queries

### Flood Fill 3D
- Iterative with explicit stack (recursive causes stack overflow)
- 6-connected vs 26-connected neighbors
- Connected Component Labeling via two-pass + union-find
- **VOXI use**: paint bucket, enclosed volume detection, room finding
- Tools: scipy.ndimage.label, cc3d

### CSG (Constructive Solid Geometry)
- Boolean ops on voxel grids = trivial array AND/OR/NOT
- CSG trees: leaves=primitives, nodes=operations
- Non-destructive: tree is source of truth, voxelization derived
- **VOXI use**: natural fit for DSL, parametric models

### Run-Length Encoding
- Compress sequences of identical values
- Column-major RLE popular for terrain
- MagicaVoxel .vox stores sparse (position-to-color)
- **VOXI use**: compact file format, network sync

### 3D Pathfinding
- A* with 3D octile heuristic
- Hierarchical: chunk-based + navmesh from voxels
- Flow fields for many-agent pathfinding
- **VOXI use**: game level validation, accessibility analysis
- Tools: Recast & Detour

## Recommended Architecture
```
Layer 1: SDF/CSG expressions (authoring)
Layer 2: Octree voxel grid (runtime)
Layer 3: Spatial queries (ray cast, pathfind, flood fill)
Layer 4: Output (mesh extraction, RLE save, render)
```
