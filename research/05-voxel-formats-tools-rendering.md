# Voxel Formats, Tools & Rendering — Research Summary

## File Formats
| Format | Max Size | Colors | Use |
|--------|----------|--------|-----|
| .vox (MagicaVoxel) | 256³ | 256 palette | Voxel art standard |
| .qb (Qubicle) | Unlimited | RGBA | Professional |
| .binvox | Unlimited | None (geometry) | ML pipelines |
| .vdb (OpenVDB) | Unlimited | Any | Film VFX |
| .nii (NIfTI) | Unlimited | Any | Medical |

## npm Packages Ready to Use
- `parse-magica-voxel` — read .vox (already installed)
- `fastnoise-lite` — Perlin/Simplex/Cellular noise (already installed)
- `wavefunctioncollapse` — procedural generation
- `nifti-reader-js` — medical NIfTI format

## Rendering Techniques
- **Greedy Meshing**: 70% triangle reduction. Merge coplanar faces into larger quads.
  - Reference: 0fps.net by Mikola Lysenko
  - Binary greedy meshing: bitwise ops, 50-200μs per chunk
- **Ambient Occlusion**: per-vertex, check 3 neighboring voxels at corners. Zero runtime cost.
- **GPU Ray Marching**: SVO traversal in compute shaders, handles billions of voxels
- **Voxel Cone Tracing (VXGI)**: real-time global illumination

## Procedural Generation
- **Perlin/Simplex noise**: terrain heightmaps, 3D cave systems
- **Wave Function Collapse**: constraint-based tile filling for buildings/dungeons
- **L-systems**: recursive branching for trees, coral, lightning

## Highest-Impact Additions to VOXI (Ranked)
1. .vox import/export ✅ DONE
2. Greedy meshing + Three.js renderer
3. Procedural noise commands ✅ DONE (TERRAIN)
4. Per-vertex AO in mesh output
5. WFC integration
6. Animation timeline extension
7. STL/3MF export for 3D printing

## Game Engine Techniques
- Minecraft: 16x16x256 chunks, face culling, BFS light propagation
- Teardown: GPU ray marching, hierarchical MIP-map, destruction physics
- Aokana (2025): SVDAG with LOD, handles tens of billions of voxels
