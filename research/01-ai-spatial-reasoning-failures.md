# AI Spatial Reasoning Failures — Research Summary

## Documented Problems AI Can't Solve (But Humans Can)

### Abstract Benchmarks
| Category | Human | Best AI | Benchmark |
|----------|-------|---------|-----------|
| Abstract rule induction | 60-98% | 0-37% (ARC-AGI-2) | ARC-AGI |
| Visual concept learning | ~91% | 21-56% | Bongard variants |
| Mental rotation | Trivial | Random chance | Mind the Gap |
| Perspective transformation | Intuitive | 27.5% (GPT-4o) | Perspective-taking |
| Paper/net folding | Easy | ~25% | Unfolding Spatial Cognition |
| Multi-hop spatial chaining | High | Consistently low | SpartQA |

### Real-World Failures
- **Autonomous Vehicles**: Cruise dragged pedestrian 20ft (spatial misclassification), Waymo 16 collisions with stationary objects
- **Warehouse Robots**: Amazon can only handle 65% of items, 35% failure rate on spatial reasoning
- **Robotic Manipulation**: Complete depth sensor failure on transparent/reflective objects
- **Surgical Robots**: No Level 4/5 autonomous surgery deployed — spatial reasoning in soft tissue beyond current capability
- **Construction**: "Persistent failures" in dynamic environments

### Key Papers
- Chollet, "ARC-AGI-2" (2025)
- Srivastava et al., "Mind the Gap" (2025)
- Yang et al., "Thinking in Space" (CVPR 2025)
- Huang et al., VoxPoser (2023)
