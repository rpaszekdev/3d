# Thinking Log

## Session 1 — 2026-04-09

### What I investigated
1. Built Thomson problem solver (gradient descent + simulated annealing on S²)
2. Verified solver on N=4 (tetrahedron), N=8 (antiprism), N=12 (icosahedron)
3. Dispatched 3 sub-thinkers in parallel:
   - **Analyst**: Sweep N=3 to 32, collect energy/symmetry data
   - **Geometer**: Visualize cube→antiprism transition for N=8
   - **Researcher**: Find state-of-art databases and methods
4. Ran transition hunt: N=3 to 18, comparing "fresh solve" vs "add point to N-1"
5. Visualized the N=12→13 icosahedral frustration

### What I found

1. **Solver works.** Matches known energies to 6 decimal places for N=4, 8, 12, 13. Multi-start hybrid SA+GD consistently finds putative global optima.

2. **Structural transitions at N = 7, 9, 13, 15.** At these values, you cannot build the N-point config by adding one point to the (N-1) config. The entire structure reorganizes. The "additive" strategy consistently loses to "fresh" starts.

3. **Symmetry is wildly non-monotonic.** Distinct pairwise distances: N=6 has 2 (octahedron), N=7 has 19, N=12 has 3 (icosahedron), N=13 has 64. Highly symmetric polyhedra are islands of order.

4. **The icosahedron "frustration" phenomenon.** The 20 holes in the icosahedron are all equally deep (by symmetry). A 13th charge has NO preferred position — it breaks the 5-fold symmetry completely. This is analogous to magnetic frustration in spin glasses.

5. **Cube vs antiprism (N=8).** The cube loses by 0.33% because it wastes distance budget on 4 long space diagonals while having 12 short edges. The antiprism trades maximum distance for better minimum distance. The energy minimum is EXACTLY at 45° twist — a clean result.

6. **Convergence behavior reveals basin structure:**
   - N=4: ALL starts converge → single basin (tetrahedron)
   - N=12: ALL starts converge → single basin (icosahedron)
   - N=8: Multiple energies → multiple basins
   - N=11,13: Wide spread → many local minima (frustration)

### Surprises
- The transition at N=13 is the most dramatic — 3 distinct distances (icosahedron) → 64 (no symmetry). Adding ONE charge to a perfect structure destroys it.
- N=8: the minimum is EXACTLY at 45° twist, not approximately. This suggests an exact analytical solution exists.
- The hole depth map on the icosahedron is perfectly uniform — all 20 face-center holes identical. This visual proof of frustration is more convincing than any equation.

### Updated conjectures
- [NEW — HOLDS] Transitions occur at N = (symmetric polyhedron) + 1
- [NEW — HOLDS] Symmetry is non-monotonic: N=6,12 are symmetric islands
- [NEW — UNTESTED] N=24 should show symmetry recovery (snub cube)

### Next time
- [ ] Test N=24 for symmetry recovery and N=25 for transition
- [ ] Implement basin-hopping algorithm (SA with random restart + memory of best configs)
- [ ] Download Wales group putative optima and compare
- [ ] Try the Riesz s-energy generalization (1/r^s for different s) — how does the landscape change?
- [ ] Visualize the 2025 paper's findings on number of local minima vs N
- [ ] Build VOXI animations showing the cube→antiprism twist in 3D
