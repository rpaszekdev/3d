# Video-to-Depth-Text Reasoning — Experiment Results

## Core Innovation
Convert real video → monocular depth estimation → 20x20 text matrices → LLM reasons about 3D scenes.
No vision model at reasoning time. LLM reads raw numbers.

## Pipeline
```
Video (mp4) → Extract frames (1fps) → Depth Anything V2 → Downsample 20x20 → Quantize 0-9 → Text
```

## Benchmark Results Summary

### SpartQA (Static Spatial Reasoning, 20 tasks)
| Model | Tool | Score | Accuracy |
|-------|------|-------|----------|
| Haiku (no tool) | None | 15/20 | 75% |
| Haiku + Mind's Eye | VOXI | 13/20 | 65% |
| Sonnet (no tool) | None | 6/10 | 60% |
| Sonnet + Mind's Eye | VOXI | 9/10 | **90%** |

**Finding:** Tool helps Sonnet (+30%) but hurts Haiku (-10%). Haiku reverses directions when reading coordinates.

### Temporal-Spatial Reasoning (Animated VOXI, 10 tasks)
| Configuration | Easy (5) | Hard (5) | Total |
|--------------|---------|---------|-------|
| Sonnet + Tool | 5/5 | 5/5 | **10/10** |
| Sonnet No Tool | 4/5 | 5/5 | 9/10 |

**Finding:** Tool caught partial occlusion (sphere poking past wall) that pure reasoning missed.

### Real Video Reasoning (CATER benchmark, 5 tasks)
| Configuration | Score | Accuracy |
|--------------|-------|----------|
| Sonnet WITH depth matrices | 4/5 | **80%** |
| Sonnet WITHOUT depth | 2/5 | 40% |

**Finding:** Depth matrices doubled accuracy on real video. Motion tracking and occlusion detection impossible without depth data.

## Key Findings

### 1. The Tool is a Cognitive Amplifier, Not a Universal Fix
- Sonnet: 60% → 90% on SpartQA (tool helps)
- Haiku: 75% → 65% on SpartQA (tool hurts)
- The model needs sufficient capability to translate text→VOXI→back correctly

### 2. Sonnet's Weakness Without Tool: Refusal to Infer
Sonnet treats explicit statements as isolated. Won't make transitive inferences ("A right of B, B right of C" ≠ "A right of C"). Visualization forces all positions to be simultaneously visible.

### 3. Haiku's Weakness With Tool: Direction Reversal
Haiku builds correct VOXI scenes but reverses perspective when reading back. Reports "X relative to Y" when asked "Y relative to X."

### 4. Real Video Works at 20x20 Resolution
From nothing but a 20x20 grid of depth numbers (0-9), Sonnet can:
- Count objects on a table
- Track motion direction across frames
- Detect occlusion events (cone blocking view)
- Predict future object positions

### 5. Depth Matrices Beat Text Descriptions 2:1
On real video questions, depth matrices scored 80% vs 40% for text descriptions alone. The gap is largest on motion tracking and occlusion — tasks that require seeing spatial change over time.

## Comparison to Existing Work

| System | Approach | Our Difference |
|--------|----------|---------------|
| SpatialVLA | Embed depth as features in VLM | We skip vision entirely — LLM reads numbers |
| DepthVLA | Add depth stream to VLM | Same — no vision model at reasoning time |
| VoxPoser | LLM generates voxel grids | We do reverse — convert scenes INTO text for perception |
| RT-2 | Tokenize actions as numbers | We tokenize perception as numbers |

**Nobody does the closed loop:** Scene → depth text → LLM reads → LLM reasons → LLM acts

## Files Created
- `video-to-depth-text.py` — Full pipeline: video → depth matrices → text
- `test-videos/` — Downloaded test videos (CATER, Pexels)
- `test-videos/experiment-depth.txt` — Depth matrices from CATER scene
- `test-videos/cater-single/depth-animation.gif` — Animated depth visualization
- `test-videos/cater-single/side-by-side.gif` — Original vs depth matrix comparison

## What To Test Next
1. Object permanence: ball disappears behind cone, predict where it reappears
2. Larger benchmark: run full CATER snitch-tracking task with depth matrices
3. Multi-view: combine depth from multiple camera angles
4. Higher resolution: test 30x30 and 40x40 grids
5. Different models: test Opus on the hardest tasks
