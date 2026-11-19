# Lattice Stick Number

## Statement
Given a knot type K, what is the minimum number of straight-line axis-aligned segments (sticks) needed to embed K as a closed polygon on the cubic lattice Z³?

This number, sL(K), is called the **lattice stick number**.

## Known Exact Values

| Knot | Crossing # | General Stick s(K) | Lattice sL(K) | Source |
|------|-----------|-------------------|---------------|--------|
| Unknot (0₁) | 0 | 3 | 4 | Trivial |
| Trefoil (3₁) | 3 | 6 | 12 | Diao 1993 |
| Figure-8 (4₁) | 4 | 7 | 14 | Huh & Oh 2005 |
| 5₂ | 5 | 8 | 16 | Huh & Oh |
| 9₄₇ | 9 | ? | 18 | Promislow & Rensburg 1999 |

## Known Bounds

- **Upper bound:** sL(K) ≤ 3c(K) + 2 for nontrivial knots (c = crossing number)
- **Tighter for non-alternating:** sL(K) ≤ 3c(K) − 4
- **Lower bound:** sL(K) ≥ 12 for any nontrivial knot
- **Forbidden value:** sL = 15 is impossible (Huh, No, Oh 2024)

## Unknown

- sL(5₁) — the (2,5) torus knot. Bounds: [16, 17]. General stick s(5₁) = 8.
- sL(6₁), sL(6₂), sL(6₃) — all 6-crossing knots. Bounds: [16, 20].
- sL(7₁) — the (2,7) torus knot. Bounds: [18, 23]. General stick s(7₁) = 9.
- Almost everything with crossing number ≥ 6.

## Our Conjecture

**sL(K) = 2 · s(K) for all knots K.**

Evidence:
- Trefoil: 2 × 6 = 12 ✓
- Figure-8: 2 × 7 = 14 ✓
- 5₂: 2 × 8 = 16 ✓
- 9₄₇: needs s(9₄₇) to check

Geometric intuition: each general-position stick (arbitrary direction) requires ~2 axis-aligned sticks (an L-shape) on the cubic lattice. If the optimal general embedding can always be "lattice-ified" with exactly this 2x overhead, the conjecture holds.

**Predictions if true:**
- sL(5₁) = 16 (s = 8, so 2 × 8 = 16)
- sL(7₁) = 18 (s = 9, so 2 × 9 = 18)

## Approach

### Phase 1: Constructive Upper Bounds
Build lattice knots with N sticks, verify type via Alexander polynomial pipeline.

### Phase 2: Optimization
Simulated annealing on vertex positions. Moves: shift a vertex along one axis. Constraint: must remain a valid knot of the target type.

### Phase 3: Lower Bounds
Exhaustive enumeration of all N-stick lattice polygons in a bounded grid. If no polygon of type K exists with N sticks → sL(K) > N.

### Verification
Use existing pipeline: VOXI → depth map → crossings → Gauss code → Alexander polynomial → knot type.

## Key Papers

- Diao (1993) — sL(trefoil) = 12
- Huh & Oh (2005) — sL(figure-8) = 14, proved sL ≥ 15 impossible
- Promislow & Rensburg (1999) — sL(9₄₇) = 18, curvature of lattice knots
- Adams et al. (~1990s) — torus knot stick numbers
- Huh, No, Oh (2024) — lattice stick number 15 is unattainable

## Next Steps

- [x] Build and verify 12-stick lattice trefoil
- [ ] Verify trefoil with Alexander polynomial pipeline
- [ ] Build 14-stick lattice figure-8 (verify known result)
- [ ] Build a general lattice knot optimizer (simulated annealing)
- [ ] Attack 5₁: try to build it with 16 sticks
- [ ] Attack 6-crossing knots
- [ ] Test the 2x conjecture
