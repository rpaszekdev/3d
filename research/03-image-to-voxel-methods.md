# Image-to-Voxel Conversion Methods — Research Summary

## Best Pipeline: TripoSR → trimesh → VOXI
Single image → TripoSR mesh (<1 sec) → trimesh.voxelize() → color quantize → VOXI

## All Methods

### Visual Hull Carving
- N silhouettes define cones, intersection = 3D shape
- Fast, simple, but can't capture concavities
- Tools: OpenCV for silhouettes, Open3D for voxel grids

### Depth Map to Voxels
- Monocular depth: Depth Anything V2 (best, ~30ms GPU), MiDaS, ZoeDepth, Depth Pro (Apple)
- Back-project pixels to 3D using camera intrinsics
- Single view = front surface only, need multiple views or assumptions for back

### Neural 3D Reconstruction
- NeRF: train on multi-view images, evaluate density on grid, threshold
- Instant-NGP: hash grid IS voxels, seconds to train
- 3D Gaussian Splatting: rasterize Gaussians into voxel cells
- Tools: nerfstudio, threestudio

### Mesh to Voxels (Voxelization)
- Most reliable path from any 3D format
- trimesh: `trimesh.voxel.creation.voxelize(mesh, pitch)`
- Open3D: `create_from_triangle_mesh(mesh, voxel_size)`
- binvox: classic CLI tool
- Conservative vs thin voxelization

### Single Image 3D
| Model | Quality | Speed | Output |
|-------|---------|-------|--------|
| TripoSR | Good | <1s | Mesh |
| InstantMesh | Better | ~10s | Mesh |
| Wonder3D | Good normals | ~3min | Views+normals |
| Zero123++ | N/A (views) | ~10s | 6 images |
| TRELLIS | Excellent | ~10s | Mesh/Gaussians |

### Point Cloud to Voxels
- Direct binning: floor(point / voxel_size)
- Poisson reconstruction → mesh → voxelize for quality
- Tools: Open3D, NumPy histogramdd

### Pixel Art to Voxels
- Simple extrusion (each pixel → voxel column)
- Distance transform depth estimation for rounded shapes
- Multi-view pixel art → visual hull

### Medical (DICOM)
- Already IS voxel data (CT/MRI)
- TotalSegmentator for automatic organ segmentation
- Marching cubes for isosurface extraction
