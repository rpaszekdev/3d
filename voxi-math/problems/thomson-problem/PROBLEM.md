# Thomson Problem

## Statement
Place N identical point charges on the surface of a unit sphere S² so as to minimize the total Coulomb potential energy:

```
E(x₁,...,xₙ) = Σᵢ<ⱼ 1/|xᵢ - xⱼ|
```

where each xᵢ ∈ S² (unit sphere in R³).

Equivalently: maximize the minimum pairwise distance, or find the "most spread out" arrangement of N points on a sphere.

## Why It's Hard
- The energy landscape has exponentially many local minima as N grows
- Exact solutions proven only for N = 2, 3, 4, 5, 6, 12
- For most N, we only have numerical optima (no proof they're global)
- The problem connects to: coding theory, crystallography, virus capsid structure, geodesic domes

## Known Exact Solutions

| N | Configuration | Energy | Symmetry Group |
|---|---|---|---|
| 2 | Antipodal pair | 0.5 | O(2) × Z₂ |
| 3 | Equilateral triangle on equator | 1.7321 | D₃ₕ |
| 4 | Tetrahedron | 3.6742 (= 6·√(2/3)) | Tₐ |
| 5 | Triangular dipyramid | 6.4749 | D₃ₕ |
| 6 | Octahedron | 9.9853 | Oₕ |
| 12 | Icosahedron | 49.1653 | Iₕ |
| 24 | Snub cube | 220.2005 | O |

## Conjectured But Unproven

| N | Best Known Config | Energy | Notes |
|---|---|---|---|
| 7 | Pentagonal bipyramid | 14.4529 | |
| 8 | Square antiprism | 19.6753 | NOT the cube! |
| 9 | Triaugmented triangular prism | 25.7599 | |
| 10 | Gyroelongated square bipyramid | 32.7169 | |
| 11 | — | 40.5965 | Irregular |
| 13 | — | 58.8532 | Icosahedron + center? NO — center is inside |
| 14 | — | 69.3066 | |
| 15 | — | 80.6707 | |
| 16 | — | 92.9116 | |
| 32 | — | 412.2611 | |
| 48 | — | 1055.182 | |

## Key Insight
N=8 is NOT a cube — it's a square antiprism (cube rotated 45° on one face). The energy difference is tiny (cube: 19.6751 vs antiprism: 19.6753). Wait — actually the antiprism is LOWER. This shows how subtle the landscape is.

## Our Approach
1. Build a gradient descent + simulated annealing solver on S²
2. Visualize configurations on the sphere using VOXI
3. Visualize the energy landscape for small N
4. Look for patterns in how optimal configurations change with N
5. Target: find or verify optimal configs for N where they're unproven

## Key Formulas

### Energy gradient on sphere
For point xᵢ on the unit sphere:
```
∇ᵢE = -Σⱼ≠ᵢ (xⱼ - xᵢ)/|xⱼ - xᵢ|³
```
Project to tangent plane: Fᵢ = ∇ᵢE - (∇ᵢE · xᵢ)xᵢ

### Stereographic projection (for 2D visualization)
```
(x, y, z) → (x/(1-z), y/(1-z))
```

## References
- Thomson (1904): Original problem formulation
- Smale (1998): Listed as Problem 7 in "Mathematical problems for the next century"
- Wales & Ulker (2006): Extensive numerical results
- Schwartz (2013): Proof that the triangular dipyramid is optimal for N=5
- Cohn & Kumar (2007): Universally optimal configurations
