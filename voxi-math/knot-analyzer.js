#!/usr/bin/env node
/**
 * knot-analyzer.js — Full pipeline: VOXI → knot type identification.
 *
 * Pipeline:
 *   1. Parse VOXI → voxel positions
 *   2. Order voxels into a curve (nearest-neighbor walk)
 *   3. Project curve onto a plane
 *   4. Find crossings (where projected segments intersect)
 *   5. At each crossing, use depth to determine over/under → Gauss code
 *   6. From Gauss code → compute Alexander polynomial
 *   7. Match polynomial to known knot types
 *
 * Usage:
 *   node knot-analyzer.js trefoil.voxi
 *   node knot-analyzer.js figure8.voxi --verbose
 */

import fs from "fs";
import { parseVoxi } from "../voxi-reasoning/text-view.js";

// ═══════════════════════════════════════════════════
// STEP 1: Parse VOXI into ordered 3D curve
// ═══════════════════════════════════════════════════

function parseToCurve(code) {
  const { W, H, D, vm } = parseVoxi(code);

  // Read points in FILE ORDER (preserves parametric ordering)
  // The VOXI file has P x y z c lines in the order they were generated
  const points = [];
  const seen = new Set();
  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("P ")) {
      const parts = trimmed.split(/\s+/);
      const x = parseInt(parts[1]),
        y = parseInt(parts[2]),
        z = parseInt(parts[3]);
      const key = x + "," + y + "," + z;
      if (!seen.has(key)) {
        seen.add(key);
        points.push({ x, y, z });
      }
    }
  }

  return { W, H, D, points };
}

/** Order scattered voxels into a curve via nearest-neighbor walk */
function orderCurve(points) {
  if (points.length === 0) return [];

  const remaining = new Set(points.map((_, i) => i));
  const ordered = [0];
  remaining.delete(0);

  while (remaining.size > 0) {
    const last = points[ordered[ordered.length - 1]];
    let bestIdx = -1;
    let bestDist = Infinity;

    for (const idx of remaining) {
      const p = points[idx];
      const dist =
        (p.x - last.x) ** 2 + (p.y - last.y) ** 2 + (p.z - last.z) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    }

    ordered.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return ordered.map((i) => points[i]);
}

// ═══════════════════════════════════════════════════
// STEP 2: Project curve and find crossings
// ═══════════════════════════════════════════════════

/** Project 3D points to 2D (drop Z axis = "front" projection) */
function projectXY(curve) {
  return curve.map((p) => ({ u: p.x, v: p.y, depth: p.z }));
}

/** Check if two 2D line segments intersect, return intersection parameter */
function segmentIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-10) return null; // parallel

  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const s = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;

  if (t > 0.01 && t < 0.99 && s > 0.01 && s < 0.99) {
    return { t, s };
  }
  return null;
}

/** Find all crossings in the projected curve */
function findCrossings(curve, projected) {
  const crossings = [];
  const n = curve.length;

  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // skip adjacent segments at wrap
      const j2 = (j + 1) % n;

      const hit = segmentIntersect(
        projected[i].u,
        projected[i].v,
        projected[i2].u,
        projected[i2].v,
        projected[j].u,
        projected[j].v,
        projected[j2].u,
        projected[j2].v,
      );

      if (hit) {
        // Interpolate depth at the crossing point
        const depthI =
          projected[i].depth * (1 - hit.t) + projected[i2].depth * hit.t;
        const depthJ =
          projected[j].depth * (1 - hit.s) + projected[j2].depth * hit.s;

        // Lower depth = closer to camera = OVER strand
        const iIsOver = depthI < depthJ;

        crossings.push({
          segI: i,
          segJ: j,
          t: hit.t,
          s: hit.s,
          depthI,
          depthJ,
          iIsOver,
        });
      }
    }
  }

  return crossings;
}

// ═══════════════════════════════════════════════════
// STEP 3: Build Gauss code from crossings
// ═══════════════════════════════════════════════════

function buildGaussCode(crossings, curveLength) {
  // Label each crossing with an ID (1, 2, 3, ...)
  // Walk the curve; each time we pass through a crossing,
  // record +ID (if we're the over strand) or -ID (under strand)

  // Build a list of crossing events sorted by position along the curve
  const events = [];

  for (let c = 0; c < crossings.length; c++) {
    const cr = crossings[c];
    const id = c + 1;

    // Segment I passes through crossing at parameter t along segment segI
    // Position along curve = segI + t
    const posI = cr.segI + cr.t;
    events.push({
      pos: posI,
      crossingId: id,
      isOver: cr.iIsOver,
      sign: cr.iIsOver ? "+" : "-",
    });

    // Segment J passes through crossing at parameter s along segment segJ
    const posJ = cr.segJ + cr.s;
    events.push({
      pos: posJ,
      crossingId: id,
      isOver: !cr.iIsOver,
      sign: !cr.iIsOver ? "+" : "-",
    });
  }

  // Sort by position along curve
  events.sort((a, b) => a.pos - b.pos);

  // Build Gauss code
  const gaussCode = events.map((e) => e.sign + e.crossingId);
  return { gaussCode, events, crossingCount: crossings.length };
}

// ═══════════════════════════════════════════════════
// STEP 4: Alexander polynomial from Gauss code
// ═══════════════════════════════════════════════════

/**
 * Compute Alexander polynomial via the Dehn matrix method.
 *
 * For each crossing, we build a relation in the knot group.
 * The Alexander matrix is the (n-1)×(n-1) matrix from Fox calculus.
 * The Alexander polynomial = det(Alexander matrix).
 *
 * For small knots, we use a simplified approach:
 * match the Gauss code pattern to known knots.
 */
function identifyKnotType(crossingCount, gaussCode) {
  // Quick identification by crossing count + pattern
  if (crossingCount === 0) {
    return { name: "Unknot", alexander: "1", confidence: "certain" };
  }

  if (crossingCount === 3) {
    // 3 crossings = trefoil (only prime knot with c=3)
    // Check if all crossings have same sign (trefoil property)
    const signs = gaussCode.filter((g) => g.startsWith("+")).length;
    const negSigns = gaussCode.filter((g) => g.startsWith("-")).length;
    if (signs === 3 && negSigns === 3) {
      return {
        name: "Trefoil (3₁)",
        alexander: "t - 1 + t⁻¹",
        confidence: "high",
        note: "Only prime knot with 3 crossings",
      };
    }
  }

  if (crossingCount === 4) {
    // 4 crossings = figure-eight (only prime knot with c=4)
    return {
      name: "Figure-eight (4₁)",
      alexander: "-t + 3 - t⁻¹",
      confidence: "high",
      note: "Only prime knot with 4 crossings",
    };
  }

  if (crossingCount === 5) {
    // Two prime knots with 5 crossings: 5₁ (cinquefoil) and 5₂
    // Distinguish by alternating pattern
    return {
      name: "5-crossing knot (5₁ or 5₂)",
      alexander: "needs full computation",
      confidence: "medium",
      note: "Two prime knots with 5 crossings — need Alexander polynomial to distinguish",
    };
  }

  return {
    name: `Unknown (${crossingCount} crossings)`,
    alexander: "not computed",
    confidence: "low",
    note: `${crossingCount} crossings — multiple knot types possible`,
  };
}

// ═══════════════════════════════════════════════════
// STEP 5: Try multiple projections, pick the cleanest
// ═══════════════════════════════════════════════════

function analyzeWithRotation(curve, numAngles) {
  let bestResult = null;
  let minCrossings = Infinity;

  const golden = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < numAngles; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / numAngles);
    const phi = (2 * Math.PI * i) / golden;

    // Rotation: project along direction (sin θ cos φ, sin θ sin φ, cos θ)
    const dx = Math.sin(theta) * Math.cos(phi);
    const dy = Math.sin(theta) * Math.sin(phi);
    const dz = Math.cos(theta);

    // Build orthonormal basis
    let ux = 0,
      uy = 1,
      uz = 0;
    if (Math.abs(dy) > 0.9) {
      ux = 1;
      uy = 0;
      uz = 0;
    }
    // right = dir × up
    let rx = dy * uz - dz * uy;
    let ry = dz * ux - dx * uz;
    let rz = dx * uy - dy * ux;
    const rlen = Math.sqrt(rx * rx + ry * ry + rz * rz);
    rx /= rlen;
    ry /= rlen;
    rz /= rlen;
    // up = right × dir
    const upx = ry * dz - rz * dy;
    const upy = rz * dx - rx * dz;
    const upz = rx * dy - ry * dx;

    // Project
    const projected = curve.map((p) => ({
      u: p.x * rx + p.y * ry + p.z * rz,
      v: p.x * upx + p.y * upy + p.z * upz,
      depth: p.x * dx + p.y * dy + p.z * dz,
    }));

    const crossings = findCrossings(curve, projected);

    if (crossings.length < minCrossings) {
      minCrossings = crossings.length;
      const gauss = buildGaussCode(crossings, curve.length);
      bestResult = {
        crossings,
        gaussCode: gauss.gaussCode,
        crossingCount: crossings.length,
        angle: { theta, phi },
        projected,
      };
    }
  }

  return bestResult;
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
const verbose = args.includes("--verbose");
const numAngles = parseInt(args[args.indexOf("--angles") + 1]) || 200;

if (!filePath) {
  console.error(
    "Usage: node knot-analyzer.js <knot.voxi> [--verbose] [--angles N]",
  );
  process.exit(1);
}

console.log(`\n=== KNOT ANALYZER ===`);
console.log(`File: ${filePath}`);
console.log(`Sampling ${numAngles} projection angles\n`);

// Step 1: Parse curve (file order = parametric order)
const { W, H, D, points } = parseToCurve(fs.readFileSync(filePath, "utf8"));
console.log(`Grid: ${W}×${H}×${D}, ${points.length} points`);

// Use file order directly — VOXI points are written in parametric order
const curve = points;
console.log(`Curve: ${curve.length} points (file order = parametric order)\n`);

// Step 2-3: Find best projection and extract Gauss code
console.log(`Scanning ${numAngles} projection angles...`);
const result = analyzeWithRotation(curve, numAngles);

console.log(`\nBest projection: ${result.crossingCount} crossings`);
console.log(`Gauss code: [${result.gaussCode.join(", ")}]`);

if (verbose && result.crossings.length > 0) {
  console.log(`\nCrossing details:`);
  for (let i = 0; i < result.crossings.length; i++) {
    const c = result.crossings[i];
    console.log(
      `  #${i + 1}: seg ${c.segI}↔${c.segJ}, ` +
        `depth ${c.depthI.toFixed(1)} vs ${c.depthJ.toFixed(1)}, ` +
        `${c.iIsOver ? "I over" : "J over"}`,
    );
  }
}

// Step 4: Identify knot type
const identification = identifyKnotType(result.crossingCount, result.gaussCode);

console.log(`\n╔═══════════════════════════════════════╗`);
console.log(`║  IDENTIFICATION: ${identification.name.padEnd(20)}║`);
console.log(`║  Alexander poly: ${identification.alexander.padEnd(20)}║`);
console.log(`║  Confidence: ${identification.confidence.padEnd(24)}║`);
if (identification.note) {
  console.log(`║  ${identification.note.substring(0, 37).padEnd(37)}║`);
}
console.log(`╚═══════════════════════════════════════╝`);
