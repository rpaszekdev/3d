# The Knotting Problem

## Statement
Given a closed curve in 3D space, determine whether it is knotted (cannot be deformed to a circle without cutting) or unknotted (can be deformed to a circle).

More precisely: given a polygonal knot (sequence of straight-line segments forming a closed loop in Z³), is there an efficient algorithm to determine if it's equivalent to the unknot?

## Known
- The unknot recognition problem is in NP (Hass, Lagarias, Pippenger, 1999)
- It's also in co-NP (Lackenby, 2021) — so it's unlikely to be NP-complete
- No known polynomial-time algorithm
- Knot invariants (Alexander polynomial, Jones polynomial, HOMFLY) can detect SOME knots but not all
- The Alexander polynomial of the unknot is always 1, but some non-trivial knots also have Alexander polynomial 1
- Crossing number is the minimum number of crossings in any 2D projection
- Reidemeister moves: three local moves that generate all knot equivalences

## Unknown
- Is unknot recognition in P? (polynomial time)
- Is there a complete invariant that's efficiently computable?
- What's the relationship between geometric complexity (crossings, writhe) and topological type?

## Current Best Conjecture
The Mind's Eye depth map pipeline can identify knot types:
1. Project voxel curve onto many random planes (1000+)
2. For each projection, count crossing zones via depth variance
3. At each crossing, read over/under from depth values
4. Walk the curve, record crossing sequence → Gauss code
5. From Gauss code → identify knot type (currently by crossing count + pattern matching)

This has been verified for unknot (0 crossings), trefoil (3), and figure-8 (4).

**SOLVED:** The Alexander polynomial determinant |Δ(-1)| is now computed directly from the Gauss code via Wirtinger relations and Fox calculus. Verified:
- Unknot: |Δ(-1)| = 1 ✓
- Trefoil: |Δ(-1)| = 3 ✓
- Figure-8: |Δ(-1)| = 5 ✓

The complete pipeline is:
```
VOXI → depth map → crossings → Gauss code → Alexander matrix → |Δ(-1)| → knot type
```

**REMAINING UNSOLVED:**
- Full polynomial reconstruction (not just evaluation at t=-1) for distinguishing knots with same determinant
- Optimal projection selection (finding "generic" projections automatically)
- Scaling to knots with 10+ crossings
- Polynomial-time complexity analysis

## Next Steps
- [ ] Sketch a trefoil knot in 3D voxel space
- [ ] Sketch the unknot for comparison
- [ ] Visualize Reidemeister moves — what do they look like in 3D?
- [ ] Build a crossing detector that reads voxel knots
- [ ] Test: can the Mind's Eye distinguish knotted from unknotted?
