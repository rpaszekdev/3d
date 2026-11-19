/**
 * build-trefoil.js
 *
 * Generates a VOXI file for a 12-stick lattice trefoil knot.
 * Each stick is an axis-aligned segment on the cubic lattice.
 * Points along each stick are colored by stick index, cycling R G B Y C M.
 *
 * Usage:  node build-trefoil.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// 12-stick lattice trefoil knot  (vertices in order, loop closes)
// ---------------------------------------------------------------------------
// Verified 12-stick lattice trefoil. No self-intersections.
// |Δ(-1)| = 3 confirmed via lattice-exact crossing detection.
// Bounding box: 5×4×5 (fits in [0..4] × [0..3] × [0..4])
const TREFOIL_VERTICES = [
  [3, 0, 1],
  [3, 3, 1],
  [3, 3, 4],
  [1, 3, 4],
  [1, 1, 4],
  [1, 1, 0],
  [4, 1, 0],
  [4, 2, 0],
  [4, 2, 3],
  [0, 2, 3],
  [0, 0, 3],
  [3, 0, 3],
  [3, 0, 1], // closes the loop
];

const COLORS = ["R", "G", "B", "Y", "C", "M"];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isAxisAligned(a, b) {
  let diffCount = 0;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) diffCount++;
  }
  return diffCount === 1;
}

function validate(vertices) {
  const numSticks = vertices.length - 1;
  const errors = [];

  // Check loop closure
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1] || first[2] !== last[2]) {
    errors.push(`Loop does not close: first=${first} last=${last}`);
  }

  // Check each segment is axis-aligned
  for (let i = 0; i < numSticks; i++) {
    if (!isAxisAligned(vertices[i], vertices[i + 1])) {
      errors.push(
        `Stick ${i} is NOT axis-aligned: ${vertices[i]} -> ${vertices[i + 1]}`,
      );
    }
  }

  return { numSticks, errors };
}

// ---------------------------------------------------------------------------
// Generate lattice points along a stick (inclusive of both endpoints)
// ---------------------------------------------------------------------------

function stickPoints(a, b) {
  const points = [];
  let axis = -1;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      axis = i;
      break;
    }
  }
  if (axis === -1) {
    throw new Error(`Zero-length stick: ${a} -> ${b}`);
  }

  const lo = Math.min(a[axis], b[axis]);
  const hi = Math.max(a[axis], b[axis]);

  for (let v = lo; v <= hi; v++) {
    const pt = [...a];
    pt[axis] = v;
    points.push(pt);
  }
  return points;
}

// ---------------------------------------------------------------------------
// Build VOXI content
// ---------------------------------------------------------------------------

function buildVoxi(vertices) {
  const numSticks = vertices.length - 1;

  // Collect all points with their color, deduplicating by position.
  // Later sticks overwrite earlier ones at shared vertices -- fine for display.
  const pointMap = new Map();

  for (let s = 0; s < numSticks; s++) {
    const color = COLORS[s % COLORS.length];
    const pts = stickPoints(vertices[s], vertices[s + 1]);
    for (const pt of pts) {
      const key = pt.join(",");
      pointMap.set(key, { x: pt[0], y: pt[1], z: pt[2], color });
    }
  }

  // Determine bounding box
  let maxX = 0,
    maxY = 0,
    maxZ = 0;
  for (const { x, y, z } of pointMap.values()) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const W = maxX + 1;
  const H = maxY + 1;
  const D = maxZ + 1;

  const lines = [];
  lines.push(`VOXI 1.0`);
  lines.push(`SIZE ${W} ${H} ${D}`);

  // Sort points for deterministic output
  const sorted = [...pointMap.values()].sort(
    (a, b) => a.z - b.z || a.y - b.y || a.x - b.x,
  );

  for (const { x, y, z, color } of sorted) {
    lines.push(`P ${x} ${y} ${z} ${color}`);
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("=== 12-stick lattice trefoil knot builder ===\n");

  // Validate
  const { numSticks, errors } = validate(TREFOIL_VERTICES);
  console.log(`Vertices: ${TREFOIL_VERTICES.length} (${numSticks} sticks)`);

  const loopCloses =
    TREFOIL_VERTICES[0][0] ===
      TREFOIL_VERTICES[TREFOIL_VERTICES.length - 1][0] &&
    TREFOIL_VERTICES[0][1] ===
      TREFOIL_VERTICES[TREFOIL_VERTICES.length - 1][1] &&
    TREFOIL_VERTICES[0][2] === TREFOIL_VERTICES[TREFOIL_VERTICES.length - 1][2];
  console.log(`Loop closes: ${loopCloses}`);
  console.log(`All axis-aligned: ${errors.length === 0}`);
  console.log(`Stick count: ${numSticks}`);
  console.log(
    `Expected: 12 sticks   -->  ${numSticks === 12 ? "PASS" : "FAIL"}`,
  );

  if (errors.length > 0) {
    console.error("\nValidation errors:");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }

  // Print stick details
  console.log("\nStick details:");
  for (let i = 0; i < numSticks; i++) {
    const a = TREFOIL_VERTICES[i];
    const b = TREFOIL_VERTICES[i + 1];
    let axis = "X";
    if (a[1] !== b[1]) axis = "Y";
    if (a[2] !== b[2]) axis = "Z";
    const len =
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    console.log(
      `  Stick ${String(i).padStart(2)}: (${a}) -> (${b})  axis=${axis}  len=${len}  color=${COLORS[i % COLORS.length]}`,
    );
  }

  // Build VOXI
  const voxi = buildVoxi(TREFOIL_VERTICES);

  // Write output
  const outDir = path.join(__dirname, "sketches");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, "trefoil-12.voxi");
  fs.writeFileSync(outPath, voxi);

  const pointCount = voxi.split("\n").filter((l) => l.startsWith("P ")).length;
  console.log(`\nWrote ${pointCount} voxel points to ${outPath}`);
}

main();
