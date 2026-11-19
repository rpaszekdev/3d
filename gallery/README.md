# VOXI Gallery — Demo Showcase

Paste any of these into `v4-voxel.html` to view in 3D.

## Models

| # | File | Description | Voxels | How it was made |
|---|------|-------------|--------|-----------------|
| 01 | penguin-basic.voxi | Simple penguin | ~1K | Hand-authored with Mind's Eye iteration |
| 02 | penguin-hd-2x.voxi | HD penguin (R 2 scale) | ~8K | Same code, R 2 for double resolution |
| 03 | penguin-king.voxi | King penguin with markings | ~9K | 3 iterations using text depth views |
| 04 | penguin-from-image.voxi | Penguin from photo analysis | ~1.5K | smart-to-voxi.py extracted primitives from image |
| 05 | pigeon.voxi | Pigeon with iridescent neck | ~1.6K | 3 iterations, horizontal posture |
| 06 | arena-fps.voxi | FPS arena with cover/sight lines | ~3.9K | Designed using SLICE for sight line verification |
| 07 | floorplan-house.voxi | House floor plan (large) | ~4.8K | Recreated from architectural drawing |
| 08 | floorplan-furnished.voxi | House with furniture | ~3.7K | Sofas, beds, tables, kitchen counters |
| 09 | terrain-hills.voxi | Simplex noise terrain | ~7.4K | Generated with TERRAIN command |
| 10 | castle-on-hill.voxi | Castle on hilltop | ~8.5K | Auto-placed on highest plateau |
| 11 | vox-import-sword.voxi | MagicaVoxel character import | 334 | Imported from .vox file |
| 12 | vox-edited-shield.voxi | Character with sword removed + shield | 341 | Edited using WHAT/ERASE/PAINT |
| 13 | penguin-iterated.voxi | Penguin v4 (final iteration) | ~1K | 4 Mind's Eye iterations |
| 14 | penguin-depth-ai.voxi | AI depth-estimated penguin | 224 | Depth Anything V2 + rembg from photo |
| 15 | penguin-visual-hull.voxi | Visual hull carved penguin | ~2.2K | 3-view silhouette carving from photo |

## Tools Used

- **Mind's Eye** (`minds-eye.js`) — interactive 3D camera: LOOK, ZOOM, SLICE, WHAT, PAINT, ERASE
- **Text View** (`text-view.js`) — 6-view depth projection as text
- **smart-to-voxi.py** — image analysis → clean VOXI primitives
- **depth-to-voxi.py** — Depth Anything V2 + background removal → voxels
- **multiview-to-voxi.py** — visual hull carving from multi-view photos
- **vox-import.js** — MagicaVoxel .vox file import
- **img-to-voxi.py** — floor plan image → walls
