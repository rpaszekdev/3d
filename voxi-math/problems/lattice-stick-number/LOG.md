# Session Log

## Session 2026-04-08

### What I investigated
- Surveyed all known lattice stick numbers (web research)
- Built and validated a 12-stick lattice trefoil in VOXI format
- Mapped the frontier: which values are known, unknown, forbidden

### What I found
- Only 4 exact lattice stick numbers are known for nontrivial knots
- sL = 15 is proven impossible (Huh, No, Oh 2024)
- The 6-crossing knots are completely open (bounds [16,20])

### Surprises
- **The 2x ratio.** For every known case, sL(K) = exactly 2·s(K). This is either a deep theorem about the cubic lattice or a coincidence that breaks at 5₁. Either way, it's the first thing to test.
- **The gap structure.** Known achievable values are {4, 12, 14, 16, 18} with 15 forbidden. What about 13? 17? 19? The discrete structure of achievable lattice stick numbers is poorly understood.

### Updated conjectures
- NEW: sL(K) = 2·s(K) conjecture
- NEW: sL(5₁) = 16 prediction
- NEW: sL(7₁) = 18 prediction

### Next time
- Build figure-8 at 14 sticks (validate known result)
- Build the optimizer engine
- Attack 5₁ — try to find a 16-stick lattice embedding
- Run Alexander polynomial on the trefoil VOXI to verify end-to-end
