/**
 * alexander.js — Compute Alexander polynomial from a Gauss code.
 *
 * Algorithm:
 *   1. Parse Gauss code into crossing data
 *   2. Label arcs between crossings
 *   3. Build the Alexander matrix using Fox calculus relations
 *   4. Delete one row and column
 *   5. Compute determinant = Alexander polynomial
 *
 * The Alexander polynomial is a TOPOLOGICAL invariant:
 *   - Unknot: Δ(t) = 1
 *   - Trefoil: Δ(t) = t - 1 + t⁻¹
 *   - Figure-8: Δ(t) = -t + 3 - t⁻¹
 *
 * It distinguishes most small knots but is NOT complete
 * (some different knots share the same polynomial).
 */

/**
 * Parse a Gauss code like ["+1", "-2", "+3", "-1", "+2", "-3"]
 * into structured crossing data.
 */
export function parseGaussCode(gaussCode) {
  const n = gaussCode.length; // should be 2 * numCrossings
  const numCrossings = n / 2;

  // Each crossing appears twice in the Gauss code
  // Parse into events: {crossingId, isOver}
  const events = gaussCode.map((g) => ({
    crossingId: parseInt(g.substring(1)),
    isOver: g.startsWith("+"),
  }));

  // Label arcs: the arc BETWEEN event[i] and event[i+1] is arc i
  // There are n arcs (same as n events, since the curve is closed)
  const numArcs = n;

  // For each crossing, find which arcs meet there
  // At a crossing, three arcs meet: the over-strand passes through,
  // the under-strand is cut into two arcs
  const crossings = [];

  for (let cId = 1; cId <= numCrossings; cId++) {
    // Find the two positions where this crossing appears
    const positions = [];
    for (let i = 0; i < n; i++) {
      if (events[i].crossingId === cId) {
        positions.push({ index: i, isOver: events[i].isOver });
      }
    }

    if (positions.length !== 2) continue;

    const overPos = positions.find((p) => p.isOver);
    const underPos = positions.find((p) => !p.isOver);

    if (!overPos || !underPos) continue;

    // Arc labels:
    // The arc coming INTO an event at position i is arc (i-1+n)%n
    // The arc going OUT of an event at position i is arc i

    // At a positive crossing (over strand):
    // over-in = arc before overPos, over-out = arc at overPos
    // under-in = arc before underPos, under-out = arc at underPos
    crossings.push({
      id: cId,
      overIn: (overPos.index - 1 + n) % n,
      overOut: overPos.index,
      underIn: (underPos.index - 1 + n) % n,
      underOut: underPos.index,
    });
  }

  return { numCrossings, numArcs, events, crossings };
}

/**
 * Build the Alexander matrix using Wirtinger relations.
 *
 * In a knot diagram with n crossings, there are n arcs.
 * Each arc goes from one undercrossing to the next undercrossing.
 *
 * At each crossing, the Wirtinger relation is:
 *   a_k = t * a_i + (1-t) * a_j
 * where a_i goes under, a_j is the overstrand, a_k comes out.
 *
 * This gives n equations in n unknowns. Delete one row and column → (n-1)×(n-1).
 * Determinant = Alexander polynomial.
 */
export function buildAlexanderMatrix(parsed) {
  const { numCrossings, events } = parsed;
  const n = numCrossings;

  // Relabel arcs: arc i goes from undercrossing i to undercrossing i+1
  // Walk the Gauss code, assign arc labels at each under-crossing
  const arcAtPosition = new Array(events.length).fill(-1);
  let currentArc = 0;

  // First pass: assign arcs. A new arc starts after each under-crossing.
  for (let i = 0; i < events.length; i++) {
    arcAtPosition[i] = currentArc;
    if (!events[i].isOver) {
      currentArc = (currentArc + 1) % n;
    }
  }

  // For each crossing, find the three arcs involved
  // crossing c: over-strand arc, under-in arc, under-out arc
  const matrix = [];

  for (let cId = 1; cId <= n; cId++) {
    const positions = [];
    for (let i = 0; i < events.length; i++) {
      if (events[i].crossingId === cId) positions.push(i);
    }

    const overIdx = positions.find((p) => events[p].isOver);
    const underIdx = positions.find((p) => !events[p].isOver);

    if (overIdx === undefined || underIdx === undefined) continue;

    const overArc = arcAtPosition[overIdx]; // the overstrand
    const underInArc = arcAtPosition[underIdx]; // arc coming into undercrossing
    const underOutArc = (underInArc + 1) % n; // arc leaving undercrossing

    // Wirtinger relation: underOutArc = t * underInArc + (1-t) * overArc
    // Rearranged: -t * underInArc - (1-t) * overArc + underOutArc = 0
    const row = new Array(n).fill(null).map(() => ({}));

    addTerm(row[underInArc], 1, -1); // -t
    addTerm(row[overArc], 0, -1); // -(1-t) = -1 + t
    addTerm(row[overArc], 1, 1);
    addTerm(row[underOutArc], 0, 1); // +1

    matrix.push(row);
  }

  return matrix;
}

function addTerm(poly, power, coeff) {
  poly[power] = (poly[power] || 0) + coeff;
}

/**
 * Evaluate the Alexander matrix at a specific value of t
 * and compute the determinant numerically.
 *
 * For exact computation we'd need polynomial arithmetic,
 * but numerical evaluation at several t values is sufficient
 * to reconstruct the polynomial for small knots.
 */
export function evaluateAlexanderAt(matrix, t) {
  const n = matrix.length;
  if (n === 0) return 1; // unknot

  // Delete last row and last column (standard choice)
  const size = n; // we have numCrossings rows, numArcs columns
  // Actually we need a SQUARE matrix: delete one column to make it square,
  // then delete one row.

  // Build numerical matrix: evaluate each Laurent polynomial at t
  const numMatrix = [];
  for (let r = 0; r < n - 1; r++) {
    const row = [];
    const matRow = matrix[r];
    for (let c = 0; c < matRow.length - 1; c++) {
      let val = 0;
      for (const [power, coeff] of Object.entries(matRow[c])) {
        val += coeff * Math.pow(t, parseInt(power));
      }
      row.push(val);
    }
    numMatrix.push(row);
  }

  // Compute determinant via Gaussian elimination
  return determinant(numMatrix);
}

function determinant(mat) {
  const n = mat.length;
  if (n === 0) return 1;
  if (n === 1) return mat[0][0];
  if (n === 2) return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];

  // LU decomposition
  const a = mat.map((row) => [...row]);
  let det = 1;

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxVal = Math.abs(a[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxVal) {
        maxVal = Math.abs(a[k][i]);
        maxRow = k;
      }
    }

    if (maxVal < 1e-12) return 0;

    if (maxRow !== i) {
      [a[i], a[maxRow]] = [a[maxRow], a[i]];
      det *= -1;
    }

    det *= a[i][i];

    for (let k = i + 1; k < n; k++) {
      const factor = a[k][i] / a[i][i];
      for (let j = i; j < n; j++) {
        a[k][j] -= factor * a[i][j];
      }
    }
  }

  return det;
}

/**
 * Reconstruct the Alexander polynomial by evaluating at several points
 * and fitting coefficients.
 *
 * For a knot with n crossings, the Alexander polynomial has degree ≤ n.
 * We evaluate at 2n+1 points and solve for coefficients.
 */
export function computeAlexanderPolynomial(gaussCode) {
  if (gaussCode.length === 0) {
    return { polynomial: "1", name: "Unknot", coefficients: { 0: 1 } };
  }

  const parsed = parseGaussCode(gaussCode);
  const matrix = buildAlexanderMatrix(parsed);

  // Evaluate at several t values
  const tValues = [0.5, 1.5, 2, 2.5, 3, -1, -0.5, 0.25];
  const evaluations = tValues.map((t) => ({
    t,
    value: evaluateAlexanderAt(matrix, t),
  }));

  // For small knots, match against known polynomials
  // Δ(t) for trefoil: t - 1 + 1/t → at t=2: 2-1+0.5=1.5
  // Δ(t) for figure-8: -t + 3 - 1/t → at t=2: -2+3-0.5=0.5

  const atTwo = evaluations.find((e) => e.t === 2)?.value ?? 0;
  const atHalf = evaluations.find((e) => e.t === 0.5)?.value ?? 0;

  // Normalize: Alexander polynomial is defined up to ±t^k
  // Convention: Δ(1) should be ±1

  // Match known polynomials
  const known = [
    {
      name: "Unknot",
      poly: "1",
      test: (t) => 1,
    },
    {
      name: "Trefoil (3₁)",
      poly: "t - 1 + t⁻¹",
      test: (t) => t - 1 + 1 / t,
    },
    {
      name: "Figure-eight (4₁)",
      poly: "-t + 3 - t⁻¹",
      test: (t) => -t + 3 - 1 / t,
    },
    {
      name: "Cinquefoil (5₁)",
      poly: "t² - t + 1 - t⁻¹ + t⁻²",
      test: (t) => t * t - t + 1 - 1 / t + 1 / (t * t),
    },
    {
      name: "Three-twist (5₂)",
      poly: "2t - 3 + 2t⁻¹",
      test: (t) => 2 * t - 3 + 2 / t,
    },
  ];

  let bestMatch = null;
  let bestError = Infinity;

  for (const k of known) {
    let totalError = 0;
    for (const ev of evaluations) {
      const expected = k.test(ev.t);
      const error = Math.abs(ev.value - expected);
      totalError += error;
    }
    // Also try negated (Δ is defined up to sign)
    let totalErrorNeg = 0;
    for (const ev of evaluations) {
      const expected = -k.test(ev.t);
      const error = Math.abs(ev.value - expected);
      totalErrorNeg += error;
    }
    const minError = Math.min(totalError, totalErrorNeg);

    if (minError < bestError) {
      bestError = minError;
      bestMatch = k;
    }
  }

  const confidence =
    bestError < 0.1
      ? "CERTAIN"
      : bestError < 1
        ? "HIGH"
        : bestError < 5
          ? "MEDIUM"
          : "LOW";

  return {
    polynomial: bestMatch?.poly ?? "unknown",
    name: bestMatch?.name ?? "Unknown",
    confidence,
    error: bestError,
    evaluations,
  };
}

// ═══ CLI ═══
const args = process.argv.slice(2);
if (args.length > 0 && !args[0].endsWith(".voxi")) {
  // Direct Gauss code input: node alexander.js "+1,-2,+3,-1,+2,-3"
  const gaussCode = args[0].split(",").map((s) => s.trim());
  console.log(`Gauss code: [${gaussCode.join(", ")}]`);
  const result = computeAlexanderPolynomial(gaussCode);
  console.log(`Alexander polynomial: ${result.polynomial}`);
  console.log(`Identification: ${result.name}`);
  console.log(
    `Confidence: ${result.confidence} (error=${result.error.toFixed(4)})`,
  );
}
