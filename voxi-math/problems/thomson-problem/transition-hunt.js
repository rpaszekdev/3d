/**
 * transition-hunt.js — Find where the Thomson optimal configuration
 * undergoes structural transitions.
 *
 * Key idea: As N increases by 1, does the optimal config change smoothly
 * (one point added to the existing structure) or discontinuously
 * (entire structure reorganizes)?
 *
 * We detect this by:
 * 1. Solving N and N+1
 * 2. For N+1, try TWO strategies:
 *    a. ADDITIVE: take optimal N config, add 1 random point, relax
 *    b. FRESH: solve N+1 from scratch
 * 3. If FRESH beats ADDITIVE consistently, there's a structural transition
 *
 * Visualize the transition map using Mind's Eye.
 */

import { signal, plot, grid, table, sketch, diagram } from '../../minds-eye-v2.js';

// ═══ Core (duplicated from thomson.js for standalone use) ═══

function randomSpherePoint() {
  let x, y, s;
  do { x = 2 * Math.random() - 1; y = 2 * Math.random() - 1; s = x * x + y * y; } while (s >= 1);
  return normalize([2 * Math.sqrt(1 - s) * x, 2 * Math.sqrt(1 - s) * y, 1 - 2 * s]);
}

function normalize(v) {
  const l = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1];
}

function totalEnergy(points) {
  let E = 0;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i][0] - points[j][0], dy = points[i][1] - points[j][1], dz = points[i][2] - points[j][2];
      E += 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  return E;
}

function forces(points) {
  const N = points.length;
  const F = points.map(() => [0, 0, 0]);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = points[i][0] - points[j][0], dy = points[i][1] - points[j][1], dz = points[i][2] - points[j][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const d3 = d * d * d;
      F[i][0] += dx / d3; F[i][1] += dy / d3; F[i][2] += dz / d3;
    }
    const dot = F[i][0] * points[i][0] + F[i][1] * points[i][1] + F[i][2] * points[i][2];
    F[i][0] -= dot * points[i][0]; F[i][1] -= dot * points[i][1]; F[i][2] -= dot * points[i][2];
  }
  return F;
}

function gradientDescent(points, opts = {}) {
  const maxIter = opts.maxIter ?? 3000;
  const dt0 = opts.dt ?? 0.01;
  for (let iter = 0; iter < maxIter; iter++) {
    const F = forces(points);
    const dt = dt0 / (1 + iter * 0.001);
    let maxF = 0;
    for (let i = 0; i < points.length; i++) {
      const fm = Math.sqrt(F[i][0] ** 2 + F[i][1] ** 2 + F[i][2] ** 2);
      if (fm > maxF) maxF = fm;
      points[i] = normalize([points[i][0] + dt * F[i][0], points[i][1] + dt * F[i][1], points[i][2] + dt * F[i][2]]);
    }
    if (maxF < 1e-10) break;
  }
  return points;
}

function simulatedAnnealing(points, opts = {}) {
  const maxIter = opts.maxIter ?? 20000;
  const T0 = opts.T0 ?? 0.15;
  const cooling = opts.cooling ?? 0.9999;
  gradientDescent(points, { maxIter: 500 });
  let E = totalEnergy(points);
  let bestE = E, bestPoints = points.map(p => [...p]);
  let T = T0;
  for (let iter = 0; iter < maxIter; iter++) {
    const idx = Math.floor(Math.random() * points.length);
    const old = [...points[idx]];
    const s = T * 0.5;
    points[idx] = normalize([old[0] + (Math.random() - 0.5) * s, old[1] + (Math.random() - 0.5) * s, old[2] + (Math.random() - 0.5) * s]);
    const newE = totalEnergy(points);
    if (newE < E || Math.random() < Math.exp(-(newE - E) / T)) {
      E = newE;
      if (E < bestE) { bestE = E; bestPoints = points.map(p => [...p]); }
    } else { points[idx] = old; }
    T *= cooling;
  }
  for (let i = 0; i < points.length; i++) points[i] = [...bestPoints[i]];
  gradientDescent(points, { maxIter: 3000, dt: 0.005 });
  return points;
}

function solveN(N, starts = 10) {
  let bestE = Infinity, bestP = null;
  for (let s = 0; s < starts; s++) {
    const pts = Array.from({ length: N }, () => randomSpherePoint());
    simulatedAnnealing(pts);
    const E = totalEnergy(pts);
    if (E < bestE) { bestE = E; bestP = pts.map(p => [...p]); }
  }
  return { points: bestP, energy: bestE };
}

/** Add one point to existing config, then relax */
function additiveStep(basePoints) {
  const points = basePoints.map(p => [...p]);
  // Find the point on sphere farthest from all existing points (deepest hole)
  let bestPoint = null, bestMinDist = -1;
  for (let trial = 0; trial < 500; trial++) {
    const candidate = randomSpherePoint();
    let minDist = Infinity;
    for (const p of points) {
      const d = Math.sqrt((candidate[0] - p[0]) ** 2 + (candidate[1] - p[1]) ** 2 + (candidate[2] - p[2]) ** 2);
      if (d < minDist) minDist = d;
    }
    if (minDist > bestMinDist) { bestMinDist = minDist; bestPoint = candidate; }
  }
  points.push(bestPoint);
  gradientDescent(points, { maxIter: 5000, dt: 0.005 });
  return { points, energy: totalEnergy(points) };
}

// ═══ Pairwise distance analysis ═══

function distinctDistances(points, tol = 0.001) {
  const dists = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i][0] - points[j][0], dy = points[i][1] - points[j][1], dz = points[i][2] - points[j][2];
      dists.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  dists.sort((a, b) => a - b);
  let count = 1;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] - dists[i - 1] > tol) count++;
  }
  return count;
}

// ═══ Main analysis ═══

console.log('═══ TRANSITION HUNT ═══\n');
console.log('For each N: solve fresh, solve by adding to N-1 config, compare.\n');

const known = {
  2: 0.5, 3: 1.732051, 4: 3.674234, 5: 6.474691, 6: 9.985281,
  7: 14.452978, 8: 19.675288, 9: 25.759987, 10: 32.716949,
  11: 40.596450, 12: 49.165253, 13: 58.853230, 14: 69.306363,
  15: 80.670244, 16: 92.911655, 17: 106.050404, 18: 120.084468,
  20: 150.881568, 24: 220.200509,
};

const results = [];
let prevBest = null;

for (let N = 3; N <= 18; N++) {
  process.stdout.write(`N=${N}... `);

  // Strategy A: solve fresh (10 starts)
  const fresh = solveN(N, 8);

  // Strategy B: add to previous best (if available)
  let additive = null;
  if (prevBest) {
    let bestAddE = Infinity, bestAddP = null;
    for (let trial = 0; trial < 5; trial++) {
      const result = additiveStep(prevBest);
      if (result.energy < bestAddE) { bestAddE = result.energy; bestAddP = result.points; }
    }
    additive = { energy: bestAddE, points: bestAddP };
  }

  const bestEnergy = additive ? Math.min(fresh.energy, additive.energy) : fresh.energy;
  const bestPoints = additive && additive.energy < fresh.energy ? additive.points : fresh.points;
  const isTransition = additive && fresh.energy < additive.energy - 0.001;
  const gap = known[N] ? ((bestEnergy - known[N]) / known[N] * 100) : null;

  results.push({
    N,
    freshE: fresh.energy,
    additiveE: additive?.energy ?? null,
    bestE: bestEnergy,
    knownE: known[N] ?? null,
    gap,
    distinctDist: distinctDistances(bestPoints),
    transition: isTransition,
  });

  console.log(
    `fresh=${fresh.energy.toFixed(4)} ` +
    (additive ? `add=${additive.energy.toFixed(4)} ` : '') +
    (isTransition ? '*** TRANSITION ***' : '') +
    (gap !== null ? ` (gap: ${gap.toFixed(3)}%)` : '')
  );

  prevBest = bestPoints;
}

// ═══ Visualize results ═══

console.log('\n');

// 1. Table of results
const rows = results.map(r => [
  r.N.toString(),
  r.freshE.toFixed(4),
  r.additiveE?.toFixed(4) ?? '—',
  r.knownE?.toFixed(4) ?? '—',
  r.gap?.toFixed(3) + '%' ?? '—',
  r.distinctDist.toString(),
  r.transition ? '*** YES ***' : '',
]);
console.log(table(
  ['N', 'Fresh E', 'Add E', 'Known E', 'Gap', 'Dist#', 'Transition?'],
  rows,
  { label: 'Thomson Transition Hunt' }
));

console.log('');

// 2. Energy gap plot
const gaps = results.filter(r => r.gap !== null).map(r => r.gap);
const gapNs = results.filter(r => r.gap !== null).map(r => r.N);
console.log(signal(gaps, { label: 'Energy gap % (solver vs known)', width: 50, height: 10 }));

console.log('');

// 3. Fresh vs Additive comparison
const freshEs = results.filter(r => r.additiveE !== null).map(r => r.freshE);
const addEs = results.filter(r => r.additiveE !== null).map(r => r.additiveE);
const diffs = results.filter(r => r.additiveE !== null).map(r => r.additiveE - r.freshE);
console.log(signal(diffs, {
  label: 'Additive - Fresh energy (positive = fresh wins = TRANSITION)',
  width: 50, height: 10
}));

console.log('');

// 4. Distinct distances (symmetry measure)
const distCounts = results.map(r => r.distinctDist);
console.log(signal(distCounts, { label: 'Distinct distances vs N (lower = more symmetric)', width: 50, height: 10 }));

// 5. Transition diagram
const nodes = results.map(r => ({
  id: `N${r.N}`,
  label: `${r.N}${r.transition ? '*' : ''}`,
}));
const edges = [];
for (let i = 0; i < results.length - 1; i++) {
  edges.push({
    from: `N${results[i].N}`,
    to: `N${results[i + 1].N}`,
    label: results[i + 1].transition ? 'BREAK' : '',
  });
}
console.log('');
console.log(diagram(nodes, edges, { label: 'Structure continuity chain', style: 'list' }));
