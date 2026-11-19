/**
 * simplify-3d.js — 3D knot simplification by geometric moves.
 *
 * Repeatedly applies safe local moves to reduce a knot curve:
 *   1. STRAIGHTEN — remove nearly-collinear middle points
 *   2. SHORTCUT — replace long path with short one if clear
 *   3. PULL TIGHT — move points toward neighbor centroid
 *
 * Safety: every move checks that the swept triangle doesn't
 * intersect any other segment of the curve (preserves knot type).
 *
 * If the curve simplifies to a near-circle → UNKNOTTED.
 * If it gets stuck with crossings remaining → probably KNOTTED.
 */

// ═══ Geometry utilities ═══

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function len(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
function dist(a, b) {
  return len(sub(a, b));
}
function normalize(v) {
  const l = len(v);
  return l > 1e-12 ? scale(v, 1 / l) : v;
}

/**
 * Check if triangle (p0, p1, p2) intersects segment (a, b).
 * Uses Möller–Trumbore ray-triangle intersection.
 */
function triangleSegmentIntersect(p0, p1, p2, a, b) {
  const dir = sub(b, a);
  const e1 = sub(p1, p0);
  const e2 = sub(p2, p0);
  const h = cross(dir, e2);
  const det = dot(e1, h);

  if (Math.abs(det) < 1e-10) return false;

  const invDet = 1 / det;
  const s = sub(a, p0);
  const u = dot(s, h) * invDet;
  if (u < -0.001 || u > 1.001) return false;

  const q = cross(s, e1);
  const v = dot(dir, q) * invDet;
  if (v < -0.001 || u + v > 1.001) return false;

  const t = dot(e2, q) * invDet;
  // t is parameter along segment [a,b]: 0 = at a, 1 = at b
  return t > 0.01 && t < 0.99;
}

/**
 * Check if moving point from `old` to `new` position sweeps a triangle
 * that intersects any segment of the curve (excluding neighbors).
 *
 * The swept region when moving point curve[idx] from old to new is
 * two triangles: (prev, old, new) and (old, new, next).
 */
function isMoveValid(curve, idx, newPos) {
  const n = curve.length;
  const prev = curve[(idx - 1 + n) % n];
  const curr = curve[idx];
  const next = curve[(idx + 1) % n];

  // Two triangles swept by the move
  const tri1 = [prev, curr, newPos];
  const tri2 = [curr, newPos, next];

  // Check all non-adjacent segments
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    // Skip segments adjacent to idx (they share a vertex)
    if (
      i === idx ||
      i2 === idx ||
      i === (idx - 1 + n) % n ||
      i === (idx + 1) % n
    )
      continue;
    if (i2 === (idx - 1 + n) % n || i2 === (idx + 1) % n) continue;

    const segA = curve[i];
    const segB = curve[i2];

    if (triangleSegmentIntersect(tri1[0], tri1[1], tri1[2], segA, segB))
      return false;
    if (triangleSegmentIntersect(tri2[0], tri2[1], tri2[2], segA, segB))
      return false;
  }
  return true;
}

// ═══ Simplification moves ═══

/** Move 1: Remove nearly-collinear middle points */
function straighten(curve, threshold = 0.02) {
  let removed = 0;
  let i = 0;
  while (i < curve.length && curve.length > 4) {
    const n = curve.length;
    const prev = curve[(i - 1 + n) % n];
    const curr = curve[i];
    const next = curve[(i + 1) % n];

    // How far is curr from the line prev→next?
    const d = dist(prev, next);
    if (d < 1e-10) {
      i++;
      continue;
    }
    const t = Math.max(
      0,
      Math.min(1, dot(sub(curr, prev), sub(next, prev)) / (d * d)),
    );
    const closest = add(prev, scale(sub(next, prev), t));
    const deviation = dist(curr, closest);

    if (deviation / d < threshold) {
      // Nearly collinear — check if removal is safe
      if (isMoveValid(curve, i, closest)) {
        curve.splice(i, 1);
        removed++;
        continue; // don't increment i — next point shifted down
      }
    }
    i++;
  }
  return removed;
}

/** Move 2: Pull points toward neighbor centroid (tighten the elastic) */
function pullTight(curve, strength = 0.3) {
  let moved = 0;
  const n = curve.length;
  const newPositions = [];

  for (let i = 0; i < n; i++) {
    const prev = curve[(i - 1 + n) % n];
    const next = curve[(i + 1) % n];
    const centroid = scale(add(prev, next), 0.5);
    const newPos = add(curve[i], scale(sub(centroid, curve[i]), strength));

    if (isMoveValid(curve, i, newPos)) {
      newPositions.push(newPos);
      moved++;
    } else {
      newPositions.push(curve[i]); // keep original
    }
  }

  for (let i = 0; i < n; i++) curve[i] = newPositions[i];
  return moved;
}

/** Move 3: Shortcut — if two non-adjacent points are close, replace the path */
function shortcut(curve, maxDist = 2.0) {
  let shortcuts = 0;

  for (let i = 0; i < curve.length && curve.length > 6; i++) {
    for (let skip = 3; skip < Math.min(curve.length / 3, 15); skip++) {
      if (i + skip >= curve.length) break;
      const j = i + skip; // no wrap-around to keep indexing simple
      const d = dist(curve[i], curve[j]);

      if (d < maxDist) {
        let safe = true;
        // The swept surface when removing i+1...j-1 is a FAN of triangles:
        // (curve[i], curve[i+1], curve[i+2]),
        // (curve[i], curve[i+2], curve[i+3]),
        // ...
        // (curve[i], curve[j-1], curve[j])
        // Check EVERY triangle against every non-adjacent segment

        for (let k = 0; k < curve.length - 1 && safe; k++) {
          if (k >= i && k <= j) continue;
          const k2 = k + 1;
          if (k2 >= i && k2 <= j) continue;
          if (k >= curve.length || k2 >= curve.length) continue;

          // Check each fan triangle
          for (let f = i + 1; f < j && safe; f++) {
            if (
              triangleSegmentIntersect(
                curve[i],
                curve[f],
                curve[f + 1 <= j ? f + 1 : j],
                curve[k],
                curve[k2],
              )
            ) {
              safe = false;
            }
          }
          // Also check the final closing triangle
          if (
            safe &&
            triangleSegmentIntersect(
              curve[i],
              curve[j - 1],
              curve[j],
              curve[k],
              curve[k2],
            )
          ) {
            safe = false;
          }
        }

        if (safe) {
          curve.splice(i + 1, j - i - 1);
          shortcuts++;
          break;
        }
      }
    }
  }
  return shortcuts;
}

// ═══ Main simplification loop ═══

export function simplifyKnot(curve, options = {}) {
  const maxIter = options.maxIterations ?? 200;
  const verbose = options.verbose ?? false;

  const history = [
    {
      iter: 0,
      points: curve.length,
      totalLength: totalLength(curve),
    },
  ];

  if (verbose)
    console.log(
      `Start: ${curve.length} points, length=${totalLength(curve).toFixed(2)}`,
    );

  for (let iter = 1; iter <= maxIter; iter++) {
    const before = curve.length;

    // Apply moves in sequence
    const straightened = straighten(curve);
    const pulled = pullTight(curve);
    const shortcuts = shortcut(curve);

    const after = curve.length;
    const tl = totalLength(curve);

    history.push({
      iter,
      points: after,
      totalLength: tl,
      straightened,
      pulled,
      shortcuts,
    });

    if (verbose && (straightened > 0 || shortcuts > 0)) {
      console.log(
        `Iter ${iter}: ${after} pts (removed ${before - after}), len=${tl.toFixed(2)}, straight=${straightened}, short=${shortcuts}`,
      );
    }

    // Convergence check — but don't stop if pull-tight is still shrinking
    if (after === before && shortcuts === 0 && straightened === 0) {
      // Try harder: increase collinearity threshold
      const extra = straighten(curve, 0.1);
      if (extra === 0) {
        // Still stuck? Pull tighter and try more straightening
        pullTight(curve, 0.5);
        const extra2 = straighten(curve, 0.15);
        if (extra2 === 0) {
          if (verbose)
            console.log(`Converged at iter ${iter}: ${curve.length} points`);
          break;
        }
      }
    }

    // Success check: if only 3-4 points remain, it's a triangle = unknot
    if (curve.length <= 4) {
      if (verbose) console.log(`Simplified to ${curve.length} points → UNKNOT`);
      break;
    }
  }

  // Check if the remaining curve is convex and planar = topological circle = unknot
  const isConvexPlanar = checkConvexPlanar(curve);

  return {
    finalPoints: curve.length,
    finalLength: totalLength(curve),
    history,
    isSimplified: curve.length <= 6 || isConvexPlanar,
    isConvexPlanar,
  };
}

/** Check if a polygon is convex and approximately planar = topological circle */
function checkConvexPlanar(curve) {
  if (curve.length < 3) return true;

  // Check planarity: all points should lie near the plane defined by first 3 points
  const n0 = cross(sub(curve[1], curve[0]), sub(curve[2], curve[0]));
  const nl = len(n0);
  if (nl < 1e-10) return true; // degenerate
  const normal = scale(n0, 1 / nl);

  let maxDeviation = 0;
  for (let i = 3; i < curve.length; i++) {
    const d = Math.abs(dot(sub(curve[i], curve[0]), normal));
    if (d > maxDeviation) maxDeviation = d;
  }

  const span = totalLength(curve);
  const planar = maxDeviation / span < 0.1; // within 10% of plane

  // Check convexity: all cross products of consecutive edges point same direction
  if (!planar) return false;

  let positiveCount = 0,
    negativeCount = 0;
  for (let i = 0; i < curve.length; i++) {
    const a = curve[i];
    const b = curve[(i + 1) % curve.length];
    const c = curve[(i + 2) % curve.length];
    const cp = cross(sub(b, a), sub(c, b));
    const sign = dot(cp, normal);
    if (sign > 0) positiveCount++;
    else if (sign < 0) negativeCount++;
  }

  // Convex if all cross products have same sign
  return positiveCount === 0 || negativeCount === 0;
}

function totalLength(curve) {
  let total = 0;
  for (let i = 0; i < curve.length; i++) {
    total += dist(curve[i], curve[(i + 1) % curve.length]);
  }
  return total;
}

// ═══ CLI ═══

import fs from "fs";

const args = process.argv.slice(2);
if (args.length > 0) {
  const paramName = args[0];
  const verbose = args.includes("--verbose");

  // Generate curve
  const knots = {
    unknot: (t) => ({ x: 5 * Math.cos(t), y: 0, z: 5 * Math.sin(t) }),
    trefoil: (t) => ({
      x: Math.sin(t) + 2 * Math.sin(2 * t),
      y: Math.cos(t) - 2 * Math.cos(2 * t),
      z: -Math.sin(3 * t),
    }),
    "figure-8": (t) => ({
      x: (2 + Math.cos(2 * t)) * Math.cos(3 * t),
      y: (2 + Math.cos(2 * t)) * Math.sin(3 * t),
      z: Math.sin(4 * t),
    }),
  };

  const fn = knots[paramName];
  if (!fn) {
    console.error(
      "Unknown knot: " +
        paramName +
        ". Available: " +
        Object.keys(knots).join(", "),
    );
    process.exit(1);
  }

  const numPoints = parseInt(args[1]) || 200;
  const curve = [];
  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * 2 * Math.PI;
    curve.push(fn(t));
  }

  console.log(`\nSimplifying ${paramName} (${numPoints} points)...\n`);
  const result = simplifyKnot(curve, { verbose: true, maxIterations: 300 });

  console.log(`\n════════════════════════════════════`);
  console.log(`Result: ${result.finalPoints} points remaining`);
  if (result.isSimplified) {
    if (result.isConvexPlanar) {
      console.log("→ UNKNOTTED (simplified to convex planar polygon)");
    } else {
      console.log("→ UNKNOTTED (simplified to ≤6 points)");
    }
  } else {
    console.log("→ STUCK — could not simplify further");
    console.log("  (likely KNOTTED if invariants confirm)");
  }
  console.log(`════════════════════════════════════`);
}
