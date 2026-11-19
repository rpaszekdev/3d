/**
 * cube-vs-antiprism.js — WHY does the cube lose to the square antiprism for N=8?
 *
 * Constructs both configurations analytically, compares energies,
 * and sweeps the twist angle from 0 (cube) to pi/4 (antiprism) to
 * find the exact energy minimum.
 *
 * Uses minds-eye-v2.js for all visualizations.
 */

import { sketch, plot, grid, table, signal } from '../../minds-eye-v2.js';
import { writeFileSync, mkdirSync } from 'fs';

// ═══════════════════════════════════════════════════════════════
// GEOMETRY
// ═══════════════════════════════════════════════════════════════

/** Cube inscribed in unit sphere: vertices at (+-1/sqrt3, +-1/sqrt3, +-1/sqrt3) */
function makeCube() {
  const s = 1 / Math.sqrt(3);
  const pts = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        pts.push([sx * s, sy * s, sz * s]);
      }
    }
  }
  return pts;
}

/**
 * Square antiprism on unit sphere.
 * Top ring of 4 at latitude +asin(h), bottom ring at -asin(h),
 * bottom rotated by `twist` radians.
 * All points projected onto unit sphere.
 *
 * @param {number} h — z-coordinate of top/bottom ring (before normalization)
 * @param {number} twist — rotation of bottom ring relative to top (radians)
 */
function makeAntiprism(h, twist) {
  const pts = [];
  const r = Math.sqrt(1 - h * h); // radius of ring at height h on unit sphere
  for (let k = 0; k < 4; k++) {
    const angle = (2 * Math.PI * k) / 4;
    // top ring
    pts.push(normalize([r * Math.cos(angle), r * Math.sin(angle), h]));
    // bottom ring (rotated by twist)
    pts.push(normalize([r * Math.cos(angle + twist), r * Math.sin(angle + twist), -h]));
  }
  return pts;
}

/**
 * Twisted cube: start with cube, then twist top face relative to bottom by `twist`.
 * Top 4 = those with z > 0, bottom 4 = z < 0.
 * We parameterize as two rings at height h, twist angle theta.
 */
function makeTwistedConfig(h, twist) {
  return makeAntiprism(h, Math.PI / 4 + twist);
  // When twist=0 and h=1/sqrt(3), the base offset pi/4 gives us something
  // close to the antiprism. But let's be more explicit.
}

function normalize(v) {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1];
}

function dist(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function totalEnergy(points) {
  let E = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      E += 1 / dist(points[i], points[j]);
    }
  }
  return E;
}

/** Get sorted pairwise distances */
function pairwiseDists(points) {
  const dists = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      dists.push(dist(points[i], points[j]));
    }
  }
  return dists.sort((a, b) => a - b);
}

/** Group distances by tolerance */
function groupDists(dists, tol = 0.0001) {
  const groups = [];
  let count = 1;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] - dists[i - 1] > tol) {
      groups.push({ dist: dists[i - 1], count });
      count = 1;
    } else {
      count++;
    }
  }
  groups.push({ dist: dists[dists.length - 1], count });
  return groups;
}

// ═══════════════════════════════════════════════════════════════
// OPTIMIZE h for the antiprism (twist fixed at pi/4)
// ═══════════════════════════════════════════════════════════════

function optimizeH(twist = Math.PI / 4) {
  let bestH = 0.5;
  let bestE = Infinity;

  // Coarse scan
  for (let h = 0.1; h <= 0.95; h += 0.01) {
    const pts = makeAntiprism(h, twist);
    const E = totalEnergy(pts);
    if (E < bestE) { bestE = E; bestH = h; }
  }

  // Fine scan around best
  const lo = Math.max(0.01, bestH - 0.02);
  const hi = Math.min(0.99, bestH + 0.02);
  for (let h = lo; h <= hi; h += 0.0001) {
    const pts = makeAntiprism(h, twist);
    const E = totalEnergy(pts);
    if (E < bestE) { bestE = E; bestH = h; }
  }

  return { h: bestH, energy: bestE };
}

// ═══════════════════════════════════════════════════════════════
// JOINTLY optimize h AND twist
// ═══════════════════════════════════════════════════════════════

function optimizeHAndTwist() {
  let bestH = 0.5;
  let bestTwist = Math.PI / 4;
  let bestE = Infinity;

  // Coarse 2D scan
  for (let h = 0.2; h <= 0.9; h += 0.02) {
    for (let tw = 0.0; tw <= Math.PI / 2; tw += 0.02) {
      const pts = makeAntiprism(h, tw);
      const E = totalEnergy(pts);
      if (E < bestE) { bestE = E; bestH = h; bestTwist = tw; }
    }
  }

  // Fine 2D scan
  for (let h = bestH - 0.03; h <= bestH + 0.03; h += 0.001) {
    for (let tw = bestTwist - 0.05; tw <= bestTwist + 0.05; tw += 0.001) {
      if (h <= 0 || h >= 1) continue;
      const pts = makeAntiprism(h, tw);
      const E = totalEnergy(pts);
      if (E < bestE) { bestE = E; bestH = h; bestTwist = tw; }
    }
  }

  return { h: bestH, twist: bestTwist, energy: bestE };
}

// ═══════════════════════════════════════════════════════════════
// MOLLWEIDE POTENTIAL FIELD
// ═══════════════════════════════════════════════════════════════

function potentialField(points, W = 60, H = 30) {
  const matrix = [];
  for (let row = 0; row < H; row++) {
    const lat = Math.PI * (0.5 - row / (H - 1));
    const matRow = [];
    for (let col = 0; col < W; col++) {
      const lon = 2 * Math.PI * (col / (W - 1)) - Math.PI;
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.cos(lat) * Math.sin(lon);
      const z = Math.sin(lat);

      let potential = 0;
      for (const p of points) {
        const d = Math.sqrt((x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2);
        potential += 1 / Math.max(d, 0.01);
      }
      matRow.push(potential);
    }
    matrix.push(matRow);
  }
  return matrix;
}

// ═══════════════════════════════════════════════════════════════
// VOXI EXPORT
// ═══════════════════════════════════════════════════════════════

function toVOXI(points, label, sphereRadius = 12) {
  const lines = [];
  const R = sphereRadius;
  lines.push(`# ${label} N=${points.length} E=${totalEnergy(points).toFixed(6)}`);
  lines.push(`V ${R * 2 + 1}`);
  lines.push('');

  const colors = ['c', '1', '9', 'a', '2', 'd', '3', 'b'];
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    const vx = Math.round(R + x * R * 0.9);
    const vy = Math.round(R + y * R * 0.9);
    const vz = Math.round(R + z * R * 0.9);
    const color = colors[i % colors.length];

    lines.push(`# Charge ${i}`);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 1) {
            lines.push(`B ${vx + dx} ${vy + dy} ${vz + dz} ${color}`);
          }
        }
      }
    }
  }

  // Wireframe sphere
  lines.push('');
  lines.push('# Sphere wireframe');
  for (let angle = 0; angle < 2 * Math.PI; angle += 0.15) {
    const ex = Math.round(R + Math.cos(angle) * R * 0.9);
    const ey = Math.round(R + Math.sin(angle) * R * 0.9);
    const mz = Math.round(R + Math.sin(angle) * R * 0.9);
    lines.push(`B ${ex} ${ey} ${R} 8`);
    lines.push(`B ${ex} ${R} ${mz} 8`);
    lines.push(`B ${R} ${ey} ${mz} 8`);
  }

  // Edges between nearby points
  lines.push('');
  lines.push('# Edges');
  const dists = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      dists.push({ i, j, d: dist(points[i], points[j]) });
    }
  }
  dists.sort((a, b) => a.d - b.d);
  // Draw edges for nearest neighbors (first ~16 shortest)
  const edgeCount = Math.min(16, dists.length);
  for (let e = 0; e < edgeCount; e++) {
    const { i, j } = dists[e];
    const [x1, y1, z1] = points[i];
    const [x2, y2, z2] = points[j];
    const steps = 10;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const mx = x1 + (x2 - x1) * t;
      const my = y1 + (y2 - y1) * t;
      const mz = z1 + (z2 - z1) * t;
      const vx = Math.round(R + mx * R * 0.9);
      const vy = Math.round(R + my * R * 0.9);
      const vz = Math.round(R + mz * R * 0.9);
      lines.push(`B ${vx} ${vy} ${vz} 7`);
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// SKETCH: 2D projection of points on sphere
// ═══════════════════════════════════════════════════════════════

function renderConfig(points, label, W = 40, H = 20) {
  const cmds = [];

  // Sphere outline
  cmds.push({ type: 'circle', cx: W / 2, cy: H / 2, r: Math.min(W, H) / 2 - 1, char: '.' });

  // Points with labels
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    // Front view (XY), depth = Z
    const px = Math.round(W / 2 + x * (W / 2 - 2));
    const py = Math.round(H / 2 - y * (H / 2 - 1));
    const ch = z > 0.1 ? '@' : z > -0.1 ? 'O' : 'o';
    cmds.push({ type: 'point', x: px, y: py, char: ch });
    // label
    if (px + 2 < W) {
      cmds.push({ type: 'text', x: px + 1, y: py, text: String(i) });
    }
  }

  // Title
  cmds.push({ type: 'text', x: 1, y: 0, text: label.substring(0, W - 2) });

  return sketch(W, H, cmds);
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log('='.repeat(70));
console.log('  CUBE vs SQUARE ANTIPRISM — Thomson Problem N=8');
console.log('  WHY does the cube lose?');
console.log('='.repeat(70));
console.log('');

// --- 1. Build the cube ---
const cube = makeCube();
const cubeE = totalEnergy(cube);
console.log(`CUBE energy:          ${cubeE.toFixed(6)}`);

// --- 2. Optimize the antiprism ---
console.log('\nOptimizing antiprism (h and twist jointly)...');
const optResult = optimizeHAndTwist();
console.log(`Optimal h:            ${optResult.h.toFixed(6)}`);
console.log(`Optimal twist:        ${optResult.twist.toFixed(6)} rad = ${(optResult.twist * 180 / Math.PI).toFixed(4)} deg`);
console.log(`pi/4 =                ${(Math.PI / 4).toFixed(6)} rad = 45.0000 deg`);
console.log(`Twist offset from 45: ${((optResult.twist - Math.PI / 4) * 180 / Math.PI).toFixed(6)} deg`);
console.log(`Antiprism energy:     ${optResult.energy.toFixed(6)}`);
console.log(`Known best N=8:       19.675288`);

const antiprism = makeAntiprism(optResult.h, optResult.twist);
const antiE = totalEnergy(antiprism);

console.log(`\nEnergy difference:    ${(cubeE - antiE).toFixed(6)} (cube is HIGHER by this much)`);
console.log(`Relative difference:  ${((cubeE - antiE) / antiE * 100).toFixed(4)}%`);

// --- 3. SKETCH: Both configurations ---
console.log('\n' + '─'.repeat(70));
console.log('VISUALIZATION 1: Front-view sketches');
console.log('─'.repeat(70));
console.log('\n--- CUBE (front XY view) ---');
console.log(renderConfig(cube, 'CUBE E=' + cubeE.toFixed(4)));
console.log('\n--- ANTIPRISM (front XY view) ---');
console.log(renderConfig(antiprism, 'ANTIPRISM E=' + antiE.toFixed(4)));

// Top view
console.log('\n--- CUBE (top XZ view) ---');
const cubeTopCmds = [];
cubeTopCmds.push({ type: 'circle', cx: 20, cy: 10, r: 8, char: '.' });
for (let i = 0; i < cube.length; i++) {
  const [x, y, z] = cube[i];
  const px = Math.round(20 + x * 17);
  const py = Math.round(10 - z * 8);
  cubeTopCmds.push({ type: 'point', x: px, y: py, char: '@' });
  if (px + 2 < 40) cubeTopCmds.push({ type: 'text', x: px + 1, y: py, text: String(i) });
}
cubeTopCmds.push({ type: 'text', x: 1, y: 0, text: 'CUBE top (XZ)' });
console.log(sketch(40, 20, cubeTopCmds));

console.log('\n--- ANTIPRISM (top XZ view) ---');
const apTopCmds = [];
apTopCmds.push({ type: 'circle', cx: 20, cy: 10, r: 8, char: '.' });
for (let i = 0; i < antiprism.length; i++) {
  const [x, y, z] = antiprism[i];
  const px = Math.round(20 + x * 17);
  const py = Math.round(10 - z * 8);
  apTopCmds.push({ type: 'point', x: px, y: py, char: '@' });
  if (px + 2 < 40) apTopCmds.push({ type: 'text', x: px + 1, y: py, text: String(i) });
}
apTopCmds.push({ type: 'text', x: 1, y: 0, text: 'ANTIPRISM top (XZ)' });
console.log(sketch(40, 20, apTopCmds));

// --- 4. GRID: Potential fields ---
console.log('\n' + '─'.repeat(70));
console.log('VISUALIZATION 2: Potential fields (Mollweide projection)');
console.log('─'.repeat(70));

console.log('\n--- CUBE potential field ---');
const cubeField = potentialField(cube);
console.log(grid(cubeField, { title: 'Cube V(theta,phi)', chars: ' .:-=+*#%@' }));

console.log('\n--- ANTIPRISM potential field ---');
const apField = potentialField(antiprism);
console.log(grid(apField, { title: 'Antiprism V(theta,phi)', chars: ' .:-=+*#%@' }));

// --- 5. TABLE: Distance comparison ---
console.log('\n' + '─'.repeat(70));
console.log('VISUALIZATION 3: Distance and energy comparison');
console.log('─'.repeat(70));

const cubeDists = pairwiseDists(cube);
const apDists = pairwiseDists(antiprism);
const cubeGroups = groupDists(cubeDists);
const apGroups = groupDists(apDists);

console.log('\n');
console.log(table(
  ['Property', 'Cube', 'Antiprism', 'Winner'],
  [
    ['Total Energy', cubeE.toFixed(6), antiE.toFixed(6), antiE < cubeE ? 'ANTIPRISM' : 'CUBE'],
    ['Min distance', cubeDists[0].toFixed(6), apDists[0].toFixed(6), apDists[0] > cubeDists[0] ? 'ANTIPRISM' : 'CUBE'],
    ['Max distance', cubeDists.at(-1).toFixed(6), apDists.at(-1).toFixed(6), '—'],
    ['Distinct dists', String(cubeGroups.length), String(apGroups.length), '—'],
    ['Spread (max-min)', (cubeDists.at(-1) - cubeDists[0]).toFixed(6), (apDists.at(-1) - apDists[0]).toFixed(6), '—'],
  ],
  { title: 'Cube vs Antiprism — Key Metrics' }
));

console.log('\n--- Cube distance groups ---');
console.log(table(
  ['Distance', 'Count', 'Pair type'],
  cubeGroups.map((g, i) => [g.dist.toFixed(6), String(g.count), i === 0 ? 'edge' : i === 1 ? 'face diag' : 'space diag']),
  { title: 'Cube: 3 distinct distances (high symmetry)' }
));

console.log('\n--- Antiprism distance groups ---');
console.log(table(
  ['Distance', 'Count', 'Description'],
  apGroups.map((g, i) => [g.dist.toFixed(6), String(g.count), `group ${i + 1}`]),
  { title: 'Antiprism distance groups' }
));

// --- 6. PLOT: The KEY visualization — energy vs twist angle ---
console.log('\n' + '─'.repeat(70));
console.log('VISUALIZATION 4: Energy landscape — twist angle sweep');
console.log('This is THE key insight: what happens as we twist the cube.');
console.log('─'.repeat(70));

// For each twist angle, optimize h, then record energy
const twistSweep = [];
const nSteps = 200;
for (let step = 0; step <= nSteps; step++) {
  const twist = (step / nSteps) * (Math.PI / 2); // 0 to pi/2
  const { h, energy } = optimizeH(twist);
  twistSweep.push({
    twistDeg: twist * 180 / Math.PI,
    twistRad: twist,
    h,
    energy
  });
}

// Find minimum
let minEntry = twistSweep[0];
for (const entry of twistSweep) {
  if (entry.energy < minEntry.energy) minEntry = entry;
}

console.log(`\nEnergy minimum found at twist = ${minEntry.twistDeg.toFixed(4)} deg (${minEntry.twistRad.toFixed(6)} rad)`);
console.log(`Optimal h at minimum:           ${minEntry.h.toFixed(6)}`);
console.log(`Energy at minimum:              ${minEntry.energy.toFixed(6)}`);
console.log(`Is minimum exactly at 45 deg?   ${Math.abs(minEntry.twistDeg - 45) < 0.5 ? 'YES (within 0.5 deg)' : 'NO'}`);

// Plot energy vs twist
const plotData = twistSweep.map(e => ({ x: e.twistDeg, y: e.energy }));

console.log('\n');
console.log(plot(
  [
    { data: plotData, char: '*', label: 'E(twist)' },
    { data: [{ x: 0, y: cubeE }], char: 'C', label: 'cube (0 deg)' },
    { data: [{ x: minEntry.twistDeg, y: minEntry.energy }], char: 'M', label: 'minimum' },
    { data: [{ x: 45, y: twistSweep.find(e => Math.abs(e.twistDeg - 45) < 0.3)?.energy ?? minEntry.energy }], char: 'A', label: 'antiprism (45 deg)' },
  ],
  {
    title: 'Energy vs Twist Angle (h optimized at each angle)',
    xLabel: 'twist (degrees)',
    yLabel: 'Energy',
    width: 70,
    height: 25,
  }
));

// Also plot h vs twist
const hPlotData = twistSweep.map(e => ({ x: e.twistDeg, y: e.h }));
console.log('\n');
console.log(plot(
  [{ data: hPlotData, char: '*', label: 'optimal h(twist)' }],
  {
    title: 'Optimal ring height h vs twist angle',
    xLabel: 'twist (degrees)',
    yLabel: 'h',
    width: 70,
    height: 15,
  }
));

// --- 7. Fine sweep near 45 degrees ---
console.log('\n' + '─'.repeat(70));
console.log('FINE SWEEP: Zoom into 40-50 degrees');
console.log('─'.repeat(70));

const fineSweep = [];
for (let deg = 40; deg <= 50; deg += 0.1) {
  const twist = deg * Math.PI / 180;
  const { h, energy } = optimizeH(twist);
  fineSweep.push({ deg, h, energy });
}

let fineMin = fineSweep[0];
for (const e of fineSweep) {
  if (e.energy < fineMin.energy) fineMin = e;
}

console.log(`Fine minimum at: ${fineMin.deg.toFixed(2)} deg, h=${fineMin.h.toFixed(6)}, E=${fineMin.energy.toFixed(6)}`);

const finePlotData = fineSweep.map(e => ({ x: e.deg, y: e.energy }));
console.log('\n');
console.log(plot(
  [
    { data: finePlotData, char: '*', label: 'E(twist) fine' },
    { data: [{ x: 45, y: fineSweep.find(e => Math.abs(e.deg - 45) < 0.15)?.energy ?? fineMin.energy }], char: 'X', label: '45 deg exact' },
  ],
  {
    title: 'Energy near 45 degrees (zoomed)',
    xLabel: 'twist (degrees)',
    yLabel: 'Energy',
    width: 70,
    height: 20,
  }
));

// --- 8. SIGNAL: Energy convergence as we deform cube to antiprism ---
console.log('\n' + '─'.repeat(70));
console.log('Energy trajectory: cube -> antiprism');
console.log('─'.repeat(70));

const energyValues = twistSweep.map(e => e.energy);
console.log(signal(energyValues, {
  label: 'Energy as twist goes 0 -> 90 deg',
  width: 70,
  height: 15,
}));

// --- 9. THE PHYSICAL INSIGHT ---
console.log('\n' + '='.repeat(70));
console.log('  ANALYSIS: WHY THE CUBE LOSES');
console.log('='.repeat(70));

console.log(`
CUBE (twist = 0 deg):
  - 3 distinct distances: edge=${cubeGroups[0]?.dist.toFixed(4)}, face-diag=${cubeGroups[1]?.dist.toFixed(4)}, space-diag=${cubeGroups[2]?.dist.toFixed(4)}
  - 12 edges, 12 face diagonals, 4 space diagonals  (28 total pairs)
  - Energy: ${cubeE.toFixed(6)}

SQUARE ANTIPRISM (twist ~ 45 deg):
  - ${apGroups.length} distinct distances
  - Energy: ${antiE.toFixed(6)}

ENERGY GAIN: ${(cubeE - antiE).toFixed(6)} (${((cubeE - antiE) / antiE * 100).toFixed(4)}%)

KEY INSIGHT:
  The cube has 4 space diagonals of length ${cubeGroups[2]?.dist.toFixed(4)} (= 2.0 for unit sphere).
  These are the LONGEST possible distances and contribute LEAST to energy (1/d).

  But the cube also has 12 edges of length ${cubeGroups[0]?.dist.toFixed(4)}.
  By twisting to ${minEntry.twistDeg.toFixed(2)} deg, the antiprism:
  - INCREASES the minimum distance from ${cubeDists[0].toFixed(4)} to ${apDists[0].toFixed(4)}
  - Sacrifices some of the "free" long diagonal distance
  - But the SHORT distances matter MORE (1/d grows fast for small d)

  The minimum is at twist = ${minEntry.twistDeg.toFixed(4)} deg
  ${Math.abs(minEntry.twistDeg - 45) < 0.5 ? 'This IS essentially 45 degrees (the square antiprism).' : `This is NOT exactly 45 degrees -- it is offset by ${(minEntry.twistDeg - 45).toFixed(4)} deg.`}
`);

// --- 10. Export VOXI files ---
console.log('─'.repeat(70));
console.log('Exporting VOXI files...');
console.log('─'.repeat(70));

const sketchDir = '/Users/robertpaszek/Desktop/Research/spatial-reasoning-dsl/voxi-math/problems/thomson-problem/sketches';

const cubeVoxi = toVOXI(cube, 'Cube');
writeFileSync(`${sketchDir}/cube-n8.voxi`, cubeVoxi);
console.log(`Saved: ${sketchDir}/cube-n8.voxi`);

const apVoxi = toVOXI(antiprism, 'SquareAntiprism');
writeFileSync(`${sketchDir}/antiprism-n8.voxi`, apVoxi);
console.log(`Saved: ${sketchDir}/antiprism-n8.voxi`);

// Save twist sweep data
const sweepDataPath = '/Users/robertpaszek/Desktop/Research/spatial-reasoning-dsl/voxi-math/problems/thomson-problem/data/cube-vs-antiprism-sweep.json';
writeFileSync(sweepDataPath, JSON.stringify({
  cubeEnergy: cubeE,
  antiprismEnergy: antiE,
  optimalTwistDeg: minEntry.twistDeg,
  optimalTwistRad: minEntry.twistRad,
  optimalH: minEntry.h,
  sweep: twistSweep,
}, null, 2));
console.log(`Saved: ${sweepDataPath}`);

console.log('\nDone.');
