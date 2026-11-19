# AI + LLM + Voxel Reasoning — Research Summary

## The Proven Architecture (from VoxPoser)
```
Natural language → LLM generates DSL code → Voxel engine executes →
Text result → LLM reasons → iterate
```
This is exactly what VOXI + Mind's Eye implements.

## Key Systems

### VoxPoser (Stanford, 2023)
- LLM writes Python code → fills 3D voxel grids with affordance values → robot plans
- Zero-shot generalization to new tasks
- LLMs don't generate raw voxels — they generate CODE that fills voxels
- **Key insight**: voxel grids as the interface between language and space

### ShapeGPT (2024)
- VQ-VAE tokenizes 3D shapes → LLM processes shape tokens alongside text
- Bidirectional text-shape translation
- "Make the chair wider" → modified shape

### 3D-GPT (2023)
- LLM agents generate Blender Python scripts for 3D content
- Same pattern works for voxel DSLs

### Point-E / Shap-E (OpenAI)
- Text → point cloud / implicit function → voxelizable

## What's Novel About Our Approach
1. **Text-based 3D perception** — depth matrices as text, no vision model
2. **LLM controls the camera** — ZOOM/SLICE/WHAT bidirectional loop
3. **Source tracing** — WHAT command bridges view → 3D coord → source line
4. **"No vision model" constraint** — contrarian to entire research direction

## Benchmarks Where Tool Helps
- ARC-AGI: grid-based, LLMs score 0-37%, tool could augment
- SpartQA: multi-hop spatial text reasoning
- VSI-Bench: 71% errors from spatial reasoning failures
- Mental rotation: VLMs at random chance

## Available Benchmarks for Testing
| Benchmark | Download | Tests |
|-----------|----------|-------|
| SpartQA | cse.msu.edu/~kordjams/data/SpartQA_Auto.zip | Multi-hop text spatial |
| SRBench | HuggingFace stogian/srbench | Mental rotation |
| STARE | HuggingFace kuvvi/STARE | Cube net folding |
| VR-Bench | HuggingFace amagipeng/VR-Bench | 3D maze navigation |
| ViewSpatial | HuggingFace lidingm/ViewSpatial-Bench | Perspective taking |

## Key Finding
DSL representation (Option 4) is the sweet spot for LLM-voxel interaction.
LLMs can both understand and generate DSL code, it's precise and unambiguous.
