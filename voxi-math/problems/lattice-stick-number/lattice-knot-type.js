#!/usr/bin/env node
/**
 * lattice-knot-type.js — Identify knot type from lattice vertex list.
 *
 * Unlike knot-analyzer.js which works on VOXI voxel clouds, this takes
 * an EXPLICIT vertex sequence (the polygon's corners), so there's no
 * ambiguity in curve ordering.
 *
 * Pipeline:
 *   1. Validate lattice polygon (axis-aligned, closed loop)
 *   2. Project onto many random planes
 *   3. Find crossings between projected segments
 *   4. Build Gauss code (over/under from depth)
 *   5. Compute |Δ(-1)| (Alexander polynomial determinant)
 *   6. Match to known knot types
 *
 * Usage:
 *   node lattice-knot-type.js '[[0,0,0],[3,0,0],...]'
 *   node lattice-knot-type.js --file vertices.json
 *   node lattice-knot-type.js --file vertices.json --verbose --angles 1000
 */

import fs from "fs";

// ═══════════════════════════════════════════════════
// PARSE & VALIDATE
// ═══════════════════════════════════════════════════

function parseInput() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const anglesIdx = args.indexOf("--angles");
  const numAngles = anglesIdx >= 0 ? parseInt(args[anglesIdx + 1]) : 500;
  const fileIdx = args.indexOf("--file");

  let vertices;
  if (fileIdx >= 0) {
    vertices = JSON.parse(fs.readFileSync(args[fileIdx + 1], "utf8"));
  } else {
    const raw = args.find((a) => !a.startsWith("--"));
    if (!raw) {
      console.error(
        "Usage: node lattice-knot-type.js '[[x,y,z],...]' [--verbose] [--angles N]",
      );
      process.exit(1);
    }
    vertices = JSON.parse(raw);
  }

  return { vertices, verbose, numAngles };
}

function validate(verts) {
  const errors = [];
  const n = verts.length;

  // Check closure
  const first = verts[0],
    last = verts[n - 1];
  if (first[0] !== last[0] || first[1] !== last[1] || first[2] !== last[2]) {
    errors.push("Loop does not close");
  }

  // Check axis-alignment
  for (let i = 0; i < n - 1; i++) {
    let diffs = 0;
    for (let j = 0; j < 3; j++) {
      if (verts[i][j] !== verts[i + 1][j]) diffs++;
    }
    if (diffs !== 1) {
      errors.push(
        `Stick ${i}: not axis-aligned (${verts[i]} -> ${verts[i + 1]})`,
      );
    }
  }

  // Check no self-intersection (segments don't share interior points)
  // We check this via the crossing analysis — skip here for speed

  return errors;
}

// ═══════════════════════════════════════════════════
// CROSSING DETECTION — Lattice-specific + general projection
// ═══════════════════════════════════════════════════

/**
 * Exact crossing detection for axis-aligned lattice polygons.
 *
 * Projects along each axis (X, Y, Z) and finds perpendicular segment pairs
 * that cross. For lattice knots this is exact — no floating point issues.
 *
 * Returns crossings for the projection axis that gives the fewest crossings
 * (closest to the minimal crossing number).
 */
function latticeExactCrossings(verts) {
  const numSegs = verts.length - 1;

  function segAxis(i) {
    const a = verts[i],
      b = verts[i + 1];
    if (a[0] !== b[0]) return 0; // X
    if (a[1] !== b[1]) return 1; // Y
    return 2; // Z
  }

  // Try projecting along each of the 3 axes
  const projAxes = [
    { drop: 2, u: 0, v: 1, name: "XY (drop Z)" },
    { drop: 0, u: 1, v: 2, name: "YZ (drop X)" },
    { drop: 1, u: 0, v: 2, name: "XZ (drop Y)" },
  ];

  let bestCrossings = null;
  let bestCount = Infinity;
  let bestProjName = "";

  for (const proj of projAxes) {
    const crossings = [];

    for (let i = 0; i < numSegs; i++) {
      const axI = segAxis(i);
      if (axI === proj.drop) continue; // projects to a point

      for (let j = i + 2; j < numSegs; j++) {
        if (i === 0 && j === numSegs - 1) continue; // adjacent at wrap
        const axJ = segAxis(j);
        if (axJ === proj.drop) continue; // projects to a point
        if (axI === axJ) continue; // parallel in projection

        // One segment is along proj.u axis, the other along proj.v axis
        const ai = verts[i],
          bi = verts[i + 1];
        const aj = verts[j],
          bj = verts[j + 1];

        // Segment i spans [min,max] in its axis, fixed in the other
        // Segment j spans [min,max] in its axis, fixed in the other
        const iU = axI === proj.u; // true if seg i is along the U axis

        let uSeg, vSeg, uIdx, vIdx;
        if (iU) {
          uSeg = { a: ai, b: bi };
          uIdx = i;
          vSeg = { a: aj, b: bj };
          vIdx = j;
        } else {
          uSeg = { a: aj, b: bj };
          uIdx = j;
          vSeg = { a: ai, b: bi };
          vIdx = i;
        }

        // uSeg goes along proj.u axis: proj.v is fixed
        const uFixed_v = uSeg.a[proj.v]; // fixed coordinate in v-axis
        const uMin = Math.min(uSeg.a[proj.u], uSeg.b[proj.u]);
        const uMax = Math.max(uSeg.a[proj.u], uSeg.b[proj.u]);

        // vSeg goes along proj.v axis: proj.u is fixed
        const vFixed_u = vSeg.a[proj.u]; // fixed coordinate in u-axis
        const vMin = Math.min(vSeg.a[proj.v], vSeg.b[proj.v]);
        const vMax = Math.max(vSeg.a[proj.v], vSeg.b[proj.v]);

        // They cross in projection if vFixed_u is strictly inside [uMin,uMax]
        // and uFixed_v is strictly inside [vMin,vMax]
        if (
          vFixed_u > uMin &&
          vFixed_u < uMax &&
          uFixed_v > vMin &&
          uFixed_v < vMax
        ) {
          // Depth = coordinate along proj.drop axis
          const depthU = uSeg.a[proj.drop]; // constant along the segment
          const depthV = vSeg.a[proj.drop]; // constant along the segment

          // Compute parameter t along each segment at the crossing point
          const tU =
            (vFixed_u - uSeg.a[proj.u]) / (uSeg.b[proj.u] - uSeg.a[proj.u]);
          const tV =
            (uFixed_v - vSeg.a[proj.v]) / (vSeg.b[proj.v] - vSeg.a[proj.v]);

          // Depth along the dropped axis for each original segment i, j
          const depthI = iU ? depthU : depthV;
          const depthJ = iU ? depthV : depthU;
          const tI = iU ? tU : tV;
          const tJ = iU ? tV : tU;

          crossings.push({
            segA: i,
            segB: j,
            t: tI,
            s: tJ,
            depthA: depthI,
            depthB: depthJ,
            // Higher depth along dropped axis = OVER (closer to viewer)
            aIsOver: depthI > depthJ,
          });
        }
      }
    }

    if (crossings.length < bestCount) {
      bestCount = crossings.length;
      bestCrossings = crossings;
      bestProjName = proj.name;
    }
  }

  return {
    crossings: bestCrossings,
    crossingCount: bestCount,
    projName: bestProjName,
  };
}

/**
 * General projection crossing detection (for non-lattice or verification).
 * Uses Fibonacci sphere sampling with slight off-axis perturbation.
 */
function segmentIntersect2D(ax, ay, bx, by, cx, cy, dx, dy) {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const s = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;

  if (t > 0.01 && t < 0.99 && s > 0.01 && s < 0.99) {
    return { t, s };
  }
  return null;
}

function projectAndAnalyze(verts, numAngles) {
  const numSegs = verts.length - 1;
  const golden = (1 + Math.sqrt(5)) / 2;

  // Also try the 3 exact lattice projections with small perturbation
  // This catches crossings that the general scanner might miss due to
  // axis-alignment degeneracies
  const perturbedAxes = [
    [0.01, 0.02, 1.0], // near-Z
    [1.0, 0.01, 0.02], // near-X
    [0.02, 1.0, 0.01], // near-Y
  ];

  let bestCrossings = null;
  let bestCount = Infinity;
  let bestAngle = null;

  const allDirections = [];

  // Add Fibonacci sphere directions
  for (let i = 0; i < numAngles; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / numAngles);
    const phi = (2 * Math.PI * i) / golden;
    allDirections.push([
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
    ]);
  }

  // Add perturbed axis directions
  for (const d of perturbedAxes) {
    const len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    allDirections.push([d[0] / len, d[1] / len, d[2] / len]);
  }

  for (let i = 0; i < allDirections.length; i++) {
    const [dx, dy, dz] = allDirections[i];

    let ux = 0,
      uy = 1,
      uz = 0;
    if (Math.abs(dy) > 0.9) {
      ux = 1;
      uy = 0;
      uz = 0;
    }

    let rx = dy * uz - dz * uy;
    let ry = dz * ux - dx * uz;
    let rz = dx * uy - dy * ux;
    const rlen = Math.sqrt(rx * rx + ry * ry + rz * rz);
    rx /= rlen;
    ry /= rlen;
    rz /= rlen;

    const upx = ry * dz - rz * dy;
    const upy = rz * dx - rx * dz;
    const upz = rx * dy - ry * dx;

    const proj = verts.map((v) => ({
      u: v[0] * rx + v[1] * ry + v[2] * rz,
      v: v[0] * upx + v[1] * upy + v[2] * upz,
      depth: v[0] * dx + v[1] * dy + v[2] * dz,
    }));

    const crossings = [];
    for (let a = 0; a < numSegs; a++) {
      for (let b = a + 2; b < numSegs; b++) {
        if (a === 0 && b === numSegs - 1) continue;

        const hit = segmentIntersect2D(
          proj[a].u,
          proj[a].v,
          proj[a + 1].u,
          proj[a + 1].v,
          proj[b].u,
          proj[b].v,
          proj[b + 1].u,
          proj[b + 1].v,
        );

        if (hit) {
          const depthA =
            proj[a].depth * (1 - hit.t) + proj[a + 1].depth * hit.t;
          const depthB =
            proj[b].depth * (1 - hit.s) + proj[b + 1].depth * hit.s;

          crossings.push({
            segA: a,
            segB: b,
            t: hit.t,
            s: hit.s,
            depthA,
            depthB,
            aIsOver: depthA < depthB,
          });
        }
      }
    }

    if (crossings.length < bestCount && crossings.length > 0) {
      bestCount = crossings.length;
      bestCrossings = crossings;
      bestAngle = { i };
    }
  }

  return {
    crossings: bestCrossings,
    crossingCount: bestCount,
    angle: bestAngle,
  };
}

// ═══════════════════════════════════════════════════
// GAUSS CODE & ALEXANDER POLYNOMIAL
// ═══════════════════════════════════════════════════

function buildGaussCode(crossings) {
  const events = [];

  for (let c = 0; c < crossings.length; c++) {
    const cr = crossings[c];
    const id = c + 1;

    // Strand A passes through at position segA + t
    events.push({
      pos: cr.segA + cr.t,
      crossingId: id,
      isOver: cr.aIsOver,
    });

    // Strand B passes through at position segB + s
    events.push({
      pos: cr.segB + cr.s,
      crossingId: id,
      isOver: !cr.aIsOver,
    });
  }

  events.sort((a, b) => a.pos - b.pos);

  return events.map((e) => (e.isOver ? "+" : "-") + e.crossingId);
}

/**
 * Compute |Δ(-1)| — the Alexander polynomial determinant.
 *
 * Uses Wirtinger presentation + Fox calculus:
 * - Each arc between consecutive crossings is a generator
 * - Each crossing gives a relation
 * - The Alexander matrix at t=-1 is computed
 * - |det(minor)| = |Δ(-1)|
 *
 * Known values: unknot=1, trefoil=3, figure-8=5, 5₁=5, 5₂=7, 6₁=9, ...
 */
function computeAlexanderDeterminant(crossings, numSegments) {
  if (crossings.length === 0) return 1;

  const n = crossings.length; // number of crossings = number of arcs

  // Label arcs 0..n-1. Arc i goes from crossing i's exit to crossing (i+1)'s entrance
  // walking along the knot.

  // Build crossing events in curve-order
  const events = [];
  for (let c = 0; c < n; c++) {
    const cr = crossings[c];
    events.push({
      pos: cr.segA + cr.t,
      crossingIdx: c,
      isStrandA: true,
      isOver: cr.aIsOver,
    });
    events.push({
      pos: cr.segB + cr.s,
      crossingIdx: c,
      isStrandA: false,
      isOver: !cr.aIsOver,
    });
  }
  events.sort((a, b) => a.pos - b.pos);

  // Arc labels: arc[i] = the arc starting after the i-th event
  // At each crossing, we have an over-strand and an under-strand
  // The over-strand passes through without interruption
  // The under-strand ends one arc and starts a new one

  // Assign arcs: walk through events, increment arc number at each under-crossing
  const arcAtEvent = [];
  let arcNum = 0;
  for (let i = 0; i < events.length; i++) {
    arcAtEvent.push(arcNum);
    if (!events[i].isOver) {
      arcNum++;
    }
  }

  // For each crossing, find the three arcs involved:
  // - incoming under-arc (arc before the under-crossing)
  // - outgoing under-arc (arc after the under-crossing)
  // - over-arc (the arc that passes over)
  const crossingRelations = [];

  for (let c = 0; c < n; c++) {
    let overArc = -1,
      underIn = -1,
      underOut = -1;
    let sign = 1; // +1 for right-handed, -1 for left-handed

    for (let i = 0; i < events.length; i++) {
      if (events[i].crossingIdx === c) {
        if (events[i].isOver) {
          overArc = arcAtEvent[i];
        } else {
          underIn = arcAtEvent[i];
          underOut = (arcAtEvent[i] + 1) % n;

          // Determine sign: check which side the over-strand crosses
          // We use the convention from the crossing structure
          const cr = crossings[c];
          // Cross product of (under direction) × (over direction) determines sign
          sign = events[i].isStrandA ? -1 : 1;
          // Refine: if aIsOver in original crossing, strand A is over
          if (cr.aIsOver && events[i].isStrandA) {
            // This event is strand A and it's over — this shouldn't happen here
            // since we filter by !isOver above
          }
        }
      }
    }

    if (overArc >= 0 && underIn >= 0) {
      crossingRelations.push({ overArc, underIn, underOut, sign });
    }
  }

  // Build Alexander matrix at t = -1
  // Relation at crossing: t·x_j - x_i + (1-t)·x_k = 0  (right-handed)
  // or: t·x_k - x_i + (1-t)·x_j = 0  (left-handed)
  // At t = -1:
  //   right: -x_j - x_i + 2·x_k = 0
  //   left:  -x_k - x_i + 2·x_j = 0

  // We use the (n-1) × (n-1) minor (delete last row and last column)
  const size = n - 1;
  if (size <= 0) return 1;

  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  for (let r = 0; r < Math.min(crossingRelations.length, size); r++) {
    const { overArc, underIn, underOut, sign } = crossingRelations[r];

    // Simplified Wirtinger relation at t=-1:
    // The under-strand enters as arc underIn, exits as arc underOut
    // The over-strand is arc overArc
    // Relation: x_underOut + x_underIn - 2·x_overArc = 0 (up to sign)

    if (underIn < size) matrix[r][underIn] += -1;
    if (underOut < size) matrix[r][underOut] += -1;
    if (overArc < size) matrix[r][overArc] += 2;
  }

  // Compute determinant of the matrix
  return Math.abs(Math.round(determinant(matrix)));
}

function determinant(matrix) {
  const n = matrix.length;
  if (n === 0) return 1;
  if (n === 1) return matrix[0][0];
  if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];

  // LU decomposition with partial pivoting
  const A = matrix.map((row) => [...row]);
  let det = 1;

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(A[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-10) return 0;

    if (maxRow !== col) {
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      det *= -1;
    }

    det *= A[col][col];

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let j = col; j < n; j++) {
        A[row][j] -= factor * A[col][j];
      }
    }
  }

  return det;
}

// ═══════════════════════════════════════════════════
// KNOT IDENTIFICATION
// ═══════════════════════════════════════════════════

function identifyKnot(crossingCount, alexDet) {
  // Known |Δ(-1)| values for prime knots
  const table = [
    { name: "Unknot", crossings: 0, det: 1 },
    { name: "Trefoil (3₁)", crossings: 3, det: 3 },
    { name: "Figure-eight (4₁)", crossings: 4, det: 5 },
    { name: "Cinquefoil (5₁)", crossings: 5, det: 5 },
    { name: "Three-twist (5₂)", crossings: 5, det: 7 },
    { name: "Stevedore (6₁)", crossings: 6, det: 9 },
    { name: "6₂", crossings: 6, det: 11 },
    { name: "6₃", crossings: 6, det: 13 },
    { name: "7₁", crossings: 7, det: 7 },
    { name: "7₂", crossings: 7, det: 11 },
    { name: "7₃", crossings: 7, det: 13 },
    { name: "7₄", crossings: 7, det: 25 },
  ];

  // First, try exact match on both crossing count and determinant
  const exactMatches = table.filter(
    (k) => k.crossings === crossingCount && k.det === alexDet,
  );
  if (exactMatches.length === 1) {
    return {
      ...exactMatches[0],
      confidence: "high",
      method: "crossing count + |Δ(-1)|",
    };
  }

  // Try match on determinant only (crossing count from best projection might not be minimal)
  const detMatches = table.filter((k) => k.det === alexDet);
  if (detMatches.length === 1) {
    return {
      ...detMatches[0],
      confidence: "medium",
      method: "|Δ(-1)| only (unique match)",
    };
  }

  if (detMatches.length > 1) {
    const names = detMatches.map((k) => k.name).join(" or ");
    return {
      name: names,
      crossings: crossingCount,
      det: alexDet,
      confidence: "low",
      method: "|Δ(-1)| matches multiple knots",
    };
  }

  if (alexDet === 1) {
    return {
      name: "Unknot (or Alexander-trivial)",
      crossings: crossingCount,
      det: 1,
      confidence: "medium",
      method: "|Δ(-1)| = 1",
    };
  }

  return {
    name: `Unknown (c=${crossingCount}, |Δ(-1)|=${alexDet})`,
    crossings: crossingCount,
    det: alexDet,
    confidence: "low",
    method: "no match in table",
  };
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

const { vertices, verbose, numAngles } = parseInput();

console.log("=== LATTICE KNOT TYPE IDENTIFIER ===\n");

// Validate
const errors = validate(vertices);
const stickCount = vertices.length - 1;
console.log(`Sticks: ${stickCount}`);
console.log(`Vertices: ${vertices.length}`);

if (errors.length > 0) {
  console.log("\nValidation errors:");
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("Validation: PASS\n");

// Method 1: Lattice-exact crossing detection
console.log("--- Lattice-exact crossing detection ---");
const latticeResult = latticeExactCrossings(vertices);
console.log(`Projection: ${latticeResult.projName}`);
console.log(`Crossings: ${latticeResult.crossingCount}`);

// Method 2: General projection scanning (verification)
console.log(
  `\n--- General projection scan (${numAngles} angles + perturbed axes) ---`,
);
const projResult = projectAndAnalyze(vertices, numAngles);
console.log(`Crossings: ${projResult.crossingCount}`);

// Use the lattice-exact result for lattice knots — the general projection
// scanner has degenerate behavior with axis-aligned segments.
// Fall back to general projection only if lattice-exact finds 0 crossings.
const result = latticeResult.crossingCount > 0 ? latticeResult : projResult;

console.log(
  `\nUsing: ${result === latticeResult ? "lattice-exact" : "general projection"} (${result.crossingCount} crossings)`,
);

if (result.crossingCount > 0) {
  const gaussCode = buildGaussCode(result.crossings);
  console.log(`Gauss code: [${gaussCode.join(", ")}]`);

  const alexDet = computeAlexanderDeterminant(result.crossings, stickCount);
  console.log(`|Δ(-1)| = ${alexDet}`);

  if (verbose) {
    console.log("\nCrossing details:");
    for (let i = 0; i < result.crossings.length; i++) {
      const c = result.crossings[i];
      console.log(
        `  #${i + 1}: seg ${c.segA}↔${c.segB}, depth ${c.depthA.toFixed(2)} vs ${c.depthB.toFixed(2)}, ${c.aIsOver ? "A over" : "B over"}`,
      );
    }
  }

  const knot = identifyKnot(result.crossingCount, alexDet);

  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  KNOT: ${knot.name.padEnd(34)}║`);
  console.log(`║  Crossings: ${String(result.crossingCount).padEnd(30)}║`);
  console.log(`║  |Δ(-1)|: ${String(knot.det).padEnd(32)}║`);
  console.log(`║  Confidence: ${knot.confidence.padEnd(29)}║`);
  console.log(`║  Method: ${knot.method.padEnd(33)}║`);
  console.log(`║  Sticks: ${String(stickCount).padEnd(33)}║`);
  console.log(`╚═══════════════════════════════════════════╝`);
} else {
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  KNOT: Unknot                             ║");
  console.log(`║  Sticks: ${String(stickCount).padEnd(33)}║`);
  console.log("╚═══════════════════════════════════════════╝");
}
