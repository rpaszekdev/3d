# Conjectures

## Active
- [TESTED — FAILED] **"Two-orbit packing (D₅ + holes) beats D₅."** The D₅ holes have depth √(5/4) ≈ 1.118 but need depth > √2 · 2^(1/5) ≈ 1.624 for same-size two-orbit to win. Deficit: 36%. The r⁵ volume scaling in 5D kills the advantage of more spheres.

- [TESTED — HOLDS] **"D₅ is a local optimum."** 5000 random perturbations of the D₅ basis vectors could not improve the density. Small deformations all reduce density.

- [UNTESTED] **"To beat D₅, need a fundamentally different lattice — not a perturbation."** The search space of 5D lattices has many local optima. D₅ might not be the global optimum, but random search won't find the better one. Need structured search (genetic algorithm, simulated annealing with lattice-specific moves, or Bayesian optimization on Gram matrix parameters).

- [KEY INSIGHT] **"The void map reveals that D₅'s wasted space is distributed uniformly, not concentrated."** The deepest holes are only 1.118 away from the lattice — not deep enough for unit spheres. The 53.5% empty space is spread as thin gaps between touching spheres, not as large cavities.

## Retired
(none)
