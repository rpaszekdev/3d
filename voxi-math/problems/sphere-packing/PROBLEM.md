# Sphere Packing in Higher Dimensions

## Statement
Find the densest arrangement of identical non-overlapping spheres in n-dimensional Euclidean space. Equivalently: what fraction of n-dimensional space can be covered by non-overlapping unit spheres?

## Why It's Hard
- Solved ONLY in dimensions 1, 2, 3, 8, and 24
- Dimensions 4-7 and 9-23 are all OPEN
- The gap between best known packing and upper bound grows with dimension
- AI just made progress (Dec 2025, arXiv:2512.04829) — proving the problem is tractable

## State of Knowledge

### Best Known Packings (Lower Bounds) vs Upper Bounds

| Dim | Best Packing | Lattice | Kissing # | Upper Bound (AI 2025) | Gap |
|-----|-------------|---------|-----------|----------------------|-----|
| 4 | 0.6169 | D₄ | 24 | 0.63610 | 3.1% |
| 5 | 0.4653 | D₅ | 40 | 0.51226 | 10.1% |
| 6 | 0.3729 | E₆ | 72 | 0.41029 | 10.0% |
| 7 | 0.2953 | E₇ | 126 | 0.32111 | 8.7% |
| 8 | 0.2537 | E₈ | 240 | 0.25367 | SOLVED |
| 9 | — | Λ₉ | — | 0.19099 | ? |
| 10 | — | Λ₁₀ | — | 0.14340 | ? |
| 12 | — | K₁₂ | — | 0.07971 | ? |
| 16 | — | BW₁₆ | — | 0.02492 | ? |
| 24 | 0.0019 | Leech | 196560 | 0.0019 | SOLVED |

### Target: Dimension 5
- Best known: D₅ lattice, density ≈ 0.4653
- Upper bound: 0.51226 (AI-improved, Dec 2025)
- Gap: ~10.1% — HUGE room for improvement
- Could a non-lattice packing beat D₅?

## Lattice Generator Matrices

### D₄ (dim 4, det=4, kissing=24)
```
 1  1  0  0
 1 -1  0  0
 0  1 -1  0
 0  0  1 -1
```

### D₅ (dim 5, det=4, kissing=40)
```
 1  1  0  0  0
 1 -1  0  0  0
 0  1 -1  0  0
 0  0  1 -1  0
 0  0  0  1 -1
```

### E₆ (dim 6, det=3, kissing=72, embedded in R⁸)
```
 0   -1    1    0    0    0    0    0
 0    0    0   -1    1    0    0    0
 0    0    0    0   -1    1    0    0
 0    0    0    0    0   -1    1    0
 0    0    0    0    0    0   -1    1
 0.5  0.5  0.5  0.5 -0.5 -0.5 -0.5 -0.5
```

### E₇ (dim 7, det=2, kissing=126)
```
-1   1   0   0   0   0   0
 0  -1   1   0   0   0   0
 0   0  -1   1   0   0   0
 0   0   0  -1   1   0   0
 0   0   0   0  -1   1   0
 0   0   0   0   0  -1   1
 0.5  0.5  0.5  0.5 -0.5 -0.5 -0.5
```

## Our Approach

### Phase 1: Reproduce Known Results
- Implement packing density computation for lattice packings
- Verify D₄, D₅, E₆, E₇ densities match published values
- Build a lattice packing visualizer (project to 2D/3D slices)

### Phase 2: Search for Denser Packings
- Start from known lattices, perturb basis vectors
- Try non-lattice packings (periodic packings with >1 sphere per fundamental domain)
- Use simulated annealing / genetic search on lattice parameters
- Target dimension 5 first (widest gap, manageable complexity)

### Phase 3: Formalize Bounds
- For any packing found denser than D₅, verify rigorously
- A new lower bound in ANY dimension would be publishable

## Key Formulas

### Packing density for a lattice L in dimension n:
```
Δ(L) = V_n(r) / det(L)^(1/2)
```
where:
- V_n(r) = π^(n/2) / Γ(n/2 + 1) · r^n is the volume of an n-ball of radius r
- r = sqrt(min_norm) / 2 is the packing radius (half the minimum distance)
- det(L) = det(G) where G is the Gram matrix (G = B·Bᵀ, B = generator matrix)

### Center density:
```
δ(L) = (r^n) / det(L)^(1/2) = Δ(L) / V_n(1)
```

## References
- Cohn sphere packing page: https://cohn.mit.edu/sphere-packing/
- AI bounds paper: arXiv:2512.04829 (Tutunov et al., Dec 2025)
- Nebe-Sloane lattice catalogue: math.rwth-aachen.de/~Gabriele.Nebe/LATTICES/
- Viazovska (2016): E₈ is optimal in dim 8
- Cohn et al. (2017): Leech lattice is optimal in dim 24
- Klartag (2025): improved asymptotic lower bound to cn²·2⁻ⁿ
