# Conjectures

## Active

- [TESTED — HOLDS] **"Structural transitions occur at N = symmetric_polyhedron + 1."** Adding one charge to a highly symmetric configuration (tetrahedron, octahedron, icosahedron) forces a total structural reorganization. Confirmed for N=7 (post-octahedron), N=13 (post-icosahedron). The additive strategy (take N-1 config + add point) consistently loses to fresh starts at these N values.

- [TESTED — HOLDS] **"Symmetry is non-monotonic in N."** The number of distinct pairwise distances does NOT increase smoothly with N. It jumps wildly: N=6 has 2, N=7 has 19, N=12 has 3, N=13 has 63. Symmetric polyhedra are islands of order in a sea of irregularity.

- [UNTESTED] **"The basins of highly symmetric N values are uniquely deep."** For N=4 and N=12, every random start converges to the same minimum (100% convergence). For irregular N (like 11, 13), there should be many competing local minima. Prediction: the variance of final energies across starts should peak at N just after symmetric configurations.

- [PARTIALLY CONFIRMED] **"The next symmetry recovery after N=12 occurs at N=24 (snub cube, O symmetry)."** Wales database confirms N=24 has O symmetry group. Our solver can't find it (1.4% gap, stuck in local minima with 21 distinct distances). Need basin-hopping or seeded start from snub cube vertices. Prediction for N=25: transition/symmetry break.

- [UNTESTED] **"The energy landscape has more local minima at N just after symmetric configurations."** If N=12 is a single deep basin and N=13 has many shallow ones, the variance of solver outcomes should spike at N=13. Testable by running 100+ starts and measuring energy variance.

## Retired
(none)
