# Thinking Log

## Session 1 — 2026-04-08

### What I investigated
1. Built D₅ lattice in 5D and visualized using ND slicing
2. Computed void map — distance from every point to nearest lattice sphere
3. Found the deepest hole (covering radius √(5/4) = 1.118)
4. Analyzed two-orbit packing (D₅ + hole spheres)
5. Random search around D₅ (5000 perturbations)

### What I found
1. **The ND visualizer works on 5D lattices.** d0×d1 slices at different d2,d3,d4 values show the checkerboard structure of D₅. Cross-dimensional slices (d0×d3) show the same symmetry.
2. **The void map is beautiful.** `█` regions (deep holes) are at the centers of D₅ cells, surrounded by gradient `▓▒░·` zones. The pattern is periodic and symmetric.
3. **Two-orbit doesn't work.** The key number: to beat D₅ with 2 orbits, need d_hole/d_lattice > 2^(1/5) = 1.149. D₅ gives only 0.791. The r⁵ volume scaling in 5D makes it impossible to gain from doubling sphere count at reduced radius.
4. **D₅ is locally optimal.** Random perturbations all decrease density. The lattice sits at a local maximum.

### Surprises
- The r⁵ scaling is the key insight. In 2D (r² scaling), adding smaller circles to holes often helps. In 3D (r³), it sometimes helps. In 5D (r⁵), the volume penalty for shrinking radius is devastating. This is why higher-dimensional packing is fundamentally harder — the volume concentrates more sharply at the boundary.
- The void structure of D₅ is uniform, not lumpy. The wasted space is evenly distributed thin gaps, not large cavities. This makes it hard to improve by local modifications.

### Next time
- [ ] Try simulated annealing with lattice-reduction moves (not just random perturbation)
- [ ] Search Gram matrix space directly (6 continuous parameters for a 5D lattice modulo scaling)
- [ ] Look at non-lattice periodic packings with k>2 orbits
- [ ] Study what makes E₈ and Leech optimal — can we apply their principles to 5D?
- [ ] Implement the Cohn-Elkies linear programming bound to verify the upper bound side
