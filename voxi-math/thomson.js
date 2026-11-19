/**
 * thomson.js — Thomson Problem solver + Mind's Eye visualization.
 *
 * Place N charges on a unit sphere to minimize Coulomb energy.
 * Uses gradient descent with projection + simulated annealing.
 * Visualizes configurations on sphere via multiple projections.
 */

import { sketch, plot, grid, table, signal, diagram } from './minds-eye-v2.js';

// ═══ Core geometry ═══

function randomSpherePoint() {
  // Marsaglia method — uniform on S²
  let x, y, s;
  do {
    x = 2 * Math.random() - 1;
    y = 2 * Math.random() - 1;
    s = x * x + y * y;
  } while (s >= 1);
  const z = 1 - 2 * s;
  const r = 2 * Math.sqrt(1 - s);
  return [r * x, r * y, z];
}

function dist(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalize(v) {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1];
}

// ═══ Energy and forces ═══

function totalEnergy(points) {
  let E = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      E += 1 / dist(points[i], points[j]);
    }
  }
  return E;
}

/** Compute tangential force on each point (negative gradient projected onto sphere) */
function forces(points) {
  const N = points.length;
  const F = points.map(() => [0, 0, 0]);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      const dz = points[i][2] - points[j][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const d3 = d * d * d;
      // Coulomb repulsion: F = (rᵢ - rⱼ)/|rᵢ - rⱼ|³
      F[i][0] += dx / d3;
      F[i][1] += dy / d3;
      F[i][2] += dz / d3;
    }
    // Project to tangent plane: F_tan = F - (F·n)n where n = point itself
    const dot = F[i][0] * points[i][0] + F[i][1] * points[i][1] + F[i][2] * points[i][2];
    F[i][0] -= dot * points[i][0];
    F[i][1] -= dot * points[i][1];
    F[i][2] -= dot * points[i][2];
  }
  return F;
}

// ═══ Solvers ═══

/** Gradient descent on the sphere */
function gradientDescent(points, opts = {}) {
  const maxIter = opts.maxIter ?? 2000;
  const dt0 = opts.dt ?? 0.01;
  const tol = opts.tol ?? 1e-12;

  const history = [];
  let E = totalEnergy(points);
  history.push(E);

  for (let iter = 0; iter < maxIter; iter++) {
    const F = forces(points);
    const dt = dt0 / (1 + iter * 0.001); // Decaying step size

    // Move each point along force, then project back to sphere
    let maxF = 0;
    for (let i = 0; i < points.length; i++) {
      const fm = Math.sqrt(F[i][0] ** 2 + F[i][1] ** 2 + F[i][2] ** 2);
      if (fm > maxF) maxF = fm;

      points[i][0] += dt * F[i][0];
      points[i][1] += dt * F[i][1];
      points[i][2] += dt * F[i][2];
      points[i] = normalize(points[i]);
    }

    const newE = totalEnergy(points);
    history.push(newE);

    if (maxF < tol) break;
    E = newE;
  }

  return { points, energy: totalEnergy(points), history };
}

/** Simulated annealing — escape local minima */
function simulatedAnnealing(points, opts = {}) {
  const maxIter = opts.maxIter ?? 50000;
  const T0 = opts.T0 ?? 0.1;
  const cooling = opts.cooling ?? 0.9999;

  // First do gradient descent to get near a minimum
  gradientDescent(points, { maxIter: 500, dt: 0.01 });

  let E = totalEnergy(points);
  let bestE = E;
  let bestPoints = points.map(p => [...p]);
  const history = [E];

  let T = T0;
  for (let iter = 0; iter < maxIter; iter++) {
    // Pick a random point and perturb it
    const idx = Math.floor(Math.random() * points.length);
    const old = [...points[idx]];

    // Random tangent perturbation
    const perturbSize = T * 0.5;
    const dx = (Math.random() - 0.5) * perturbSize;
    const dy = (Math.random() - 0.5) * perturbSize;
    const dz = (Math.random() - 0.5) * perturbSize;
    points[idx] = normalize([old[0] + dx, old[1] + dy, old[2] + dz]);

    const newE = totalEnergy(points);
    const dE = newE - E;

    if (dE < 0 || Math.random() < Math.exp(-dE / T)) {
      E = newE;
      if (E < bestE) {
        bestE = E;
        bestPoints = points.map(p => [...p]);
      }
    } else {
      points[idx] = old; // Reject
    }

    T *= cooling;
    if (iter % 1000 === 0) history.push(E);
  }

  // Restore best and polish with gradient descent
  for (let i = 0; i < points.length; i++) points[i] = [...bestPoints[i]];
  gradientDescent(points, { maxIter: 2000, dt: 0.005 });

  return { points, energy: totalEnergy(points), history };
}

// ═══ Visualization ═══

/** Project sphere points to 2D for ASCII rendering.
 * viewDir: 'front' (XY), 'top' (XZ), 'side' (YZ) */
function projectPoints(points, viewDir = 'front') {
  return points.map(([x, y, z]) => {
    switch (viewDir) {
      case 'front': return { u: x, v: y, depth: z };
      case 'top':   return { u: x, v: z, depth: -y };
      case 'side':  return { u: z, v: y, depth: x };
      default:      return { u: x, v: y, depth: z };
    }
  });
}

/** Render points on sphere as ASCII sketch — 3 orthogonal views */
function renderSphereConfig(points, label = '') {
  const views = ['front', 'top', 'side'];
  const viewLabels = ['Front (XY)', 'Top (XZ)', 'Side (ZY)'];
  const results = [];

  for (let vi = 0; vi < views.length; vi++) {
    const projected = projectPoints(points, views[vi]);
    const W = 30, H = 16;
    const cmds = [];

    // Draw sphere outline (circle)
    cmds.push({ type: 'circle', cx: W / 2, cy: H / 2, r: Math.min(W, H) / 2 - 1, char: '.' });

    // Draw points — size/char by depth
    for (let i = 0; i < projected.length; i++) {
      const { u, v, depth } = projected[i];
      const px = Math.round(W / 2 + u * (W / 2 - 2));
      const py = Math.round(H / 2 - v * (H / 2 - 1));

      // Depth encoding: front = bright, back = dim
      const char = depth > 0.3 ? '@' : depth > -0.3 ? 'o' : '.';
      if (px >= 0 && px < W && py >= 0 && py < H) {
        cmds.push({ type: 'text', x: px, y: py, text: char });
        // Label with index if small N
        if (points.length <= 12 && depth > -0.3) {
          const lbl = i.toString(16);
          if (px + 1 < W) cmds.push({ type: 'text', x: px + 1, y: py, text: lbl });
        }
      }
    }

    results.push(`--- ${viewLabels[vi]} ---`);
    results.push(sketch(W, H, cmds));
  }

  const header = label ? `=== ${label} (N=${points.length}, E=${totalEnergy(points).toFixed(4)}) ===` : '';
  return [header, ...results].join('\n');
}

/** Render the Voronoi-like nearest-charge map on the sphere surface */
function renderChargeField(points) {
  // Mollweide-like projection: longitude x latitude → 2D grid
  const W = 50, H = 25;
  const matrix = [];

  for (let row = 0; row < H; row++) {
    const lat = Math.PI * (0.5 - row / (H - 1)); // +π/2 to -π/2
    const matRow = [];
    for (let col = 0; col < W; col++) {
      const lon = 2 * Math.PI * (col / (W - 1)) - Math.PI; // -π to +π

      // Sphere point
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.cos(lat) * Math.sin(lon);
      const z = Math.sin(lat);

      // Find nearest charge and potential at this point
      let minDist = Infinity;
      let potential = 0;
      for (const p of points) {
        const d = Math.sqrt((x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2);
        if (d < minDist) minDist = d;
        potential += 1 / Math.max(d, 0.01);
      }
      matRow.push(potential);
    }
    matrix.push(matRow);
  }

  return grid(matrix, { label: `Potential field on S² (N=${points.length})`, chars: ' ·░▒▓█' });
}

/** Render force field on sphere surface */
function renderForceField(points) {
  const W = 40, H = 20;
  // Use vectorField on lat/lon coordinates
  const fn = (col, row) => {
    const lat = Math.PI * (0.5 - row / (H - 1));
    const lon = 2 * Math.PI * (col / (W - 1)) - Math.PI;

    const x = Math.cos(lat) * Math.cos(lon);
    const y = Math.cos(lat) * Math.sin(lon);
    const z = Math.sin(lat);

    // Compute force at this surface point
    let fx = 0, fy = 0, fz = 0;
    for (const p of points) {
      const dx = x - p[0], dy = y - p[1], dz = z - p[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 0.05) continue;
      const d3 = d * d * d;
      fx += dx / d3; fy += dy / d3; fz += dz / d3;
    }

    // Project force to tangent plane (remove radial component)
    const dot = fx * x + fy * y + fz * z;
    fx -= dot * x; fy -= dot * y; fz -= dot * z;

    // Convert tangent force to lat/lon components
    // d/dlon direction: (-sin(lon), cos(lon), 0) * cos(lat)
    // d/dlat direction: (-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat))
    const flonDir = [-Math.sin(lon), Math.cos(lon), 0];
    const flatDir = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];

    const flon = fx * flonDir[0] + fy * flonDir[1] + fz * flonDir[2];
    const flat = fx * flatDir[0] + fy * flatDir[1] + fz * flatDir[2];

    return [flon, -flat]; // negative flat because row increases downward
  };

  // Manual vector field rendering
  const arrows = '↑↗→↘↓↙←↖';
  const canvas = Array.from({ length: H }, () => Array(W).fill(' '));

  for (let row = 0; row < H; row += 2) {
    for (let col = 0; col < W; col += 2) {
      const [vx, vy] = fn(col, row);
      const mag = Math.sqrt(vx * vx + vy * vy);
      if (mag < 0.1) { canvas[row][col] = '·'; continue; }

      const angle = Math.atan2(-vy, vx); // screen coords
      const idx = Math.round(((angle + Math.PI) / (2 * Math.PI)) * 8) % 8;
      // Map: 0=← 1=↙ 2=↓ 3=↘ 4=→ 5=↗ 6=↑ 7=↖
      const arrowMap = [4, 5, 6, 7, 0, 1, 2, 3]; // remap angle→arrow index
      canvas[row][col] = mag > 5 ? '█' : arrows[arrowMap[idx]];
    }
  }

  const lines = [`Force field on S² (N=${points.length})`];
  for (const row of canvas) lines.push(row.join(''));
  return lines.join('\n');
}

// ═══ Analysis ═══

/** Compute all pairwise distances and their distribution */
function pairwiseAnalysis(points) {
  const dists = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      dists.push(dist(points[i], points[j]));
    }
  }
  dists.sort((a, b) => a - b);

  // Histogram of distances
  const bins = 20;
  const minD = dists[0], maxD = dists[dists.length - 1];
  const binWidth = (maxD - minD) / bins;
  const histogram = new Array(bins).fill(0);
  for (const d of dists) {
    const bin = Math.min(bins - 1, Math.floor((d - minD) / binWidth));
    histogram[bin]++;
  }

  return {
    min: minD,
    max: maxD,
    mean: dists.reduce((a, b) => a + b, 0) / dists.length,
    distances: dists,
    histogram,
    histogramBins: Array.from({ length: bins }, (_, i) => minD + (i + 0.5) * binWidth),
  };
}

/** Detect symmetry group (approximate) */
function detectSymmetry(points) {
  const analysis = pairwiseAnalysis(points);
  const dists = analysis.distances;

  // Count distinct distances (within tolerance)
  const tol = 0.001;
  const distinct = [];
  let count = 1;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] - dists[i - 1] > tol) {
      distinct.push({ dist: dists[i - 1], count });
      count = 1;
    } else {
      count++;
    }
  }
  distinct.push({ dist: dists[dists.length - 1], count });

  // Kissing number: number of nearest neighbors per point
  const nearestDist = dists[0];
  const nearNeighbors = dists.filter(d => d < nearestDist * 1.05).length;
  const kissing = Math.round(nearNeighbors * 2 / points.length);

  return {
    distinctDistances: distinct.length,
    distanceGroups: distinct,
    kissing,
    minDist: analysis.min,
    maxDist: analysis.max,
    isRegular: distinct.length <= 3, // Few distinct distances → high symmetry
  };
}

// ═══ Multi-start solver ═══

function solveThomson(N, opts = {}) {
  const starts = opts.starts ?? 20;
  const method = opts.method ?? 'hybrid'; // 'gd', 'sa', 'hybrid'
  const verbose = opts.verbose ?? false;

  let bestPoints = null;
  let bestEnergy = Infinity;
  const allEnergies = [];

  for (let s = 0; s < starts; s++) {
    // Random initial configuration
    const points = Array.from({ length: N }, () => randomSpherePoint());

    let result;
    if (method === 'gd') {
      result = gradientDescent(points, { maxIter: 5000, dt: 0.01 });
    } else if (method === 'sa') {
      result = simulatedAnnealing(points, { maxIter: 100000, T0: 0.5, cooling: 0.99995 });
    } else {
      // Hybrid: SA then GD polish
      result = simulatedAnnealing(points, { maxIter: 30000, T0: 0.2, cooling: 0.9999 });
      result = gradientDescent(result.points, { maxIter: 5000, dt: 0.005 });
    }

    const E = totalEnergy(result.points);
    allEnergies.push(E);

    if (verbose) {
      console.log(`  Start ${s + 1}/${starts}: E = ${E.toFixed(6)}`);
    }

    if (E < bestEnergy) {
      bestEnergy = E;
      bestPoints = result.points.map(p => [...p]);
    }
  }

  return {
    points: bestPoints,
    energy: bestEnergy,
    allEnergies,
    N,
  };
}

// ═══ VOXI export ═══

/** Export sphere configuration as VOXI code for 3D rendering */
function toVOXI(points, sphereRadius = 12) {
  const lines = [];
  const R = sphereRadius;

  // Sphere outline — draw equator and meridians using dim voxels
  lines.push(`# Thomson N=${points.length} E=${totalEnergy(points).toFixed(4)}`);
  lines.push(`V ${R * 2 + 1}`);
  lines.push('');

  // Each charge gets a bright colored cluster
  const colors = 'c19a2d3b5e6f'.split(''); // 12 distinct colors
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    const vx = Math.round(R + x * R * 0.9);
    const vy = Math.round(R + y * R * 0.9);
    const vz = Math.round(R + z * R * 0.9);
    const color = colors[i % colors.length];

    // 3x3x3 cluster for visibility
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

  // Wireframe sphere: draw points on great circles
  lines.push('');
  lines.push('# Sphere wireframe');
  for (let angle = 0; angle < 2 * Math.PI; angle += 0.15) {
    // Equator
    const ex = Math.round(R + Math.cos(angle) * R * 0.9);
    const ey = Math.round(R + Math.sin(angle) * R * 0.9);
    lines.push(`B ${ex} ${ey} ${R} 8`);
    // Meridian XZ
    const mz = Math.round(R + Math.sin(angle) * R * 0.9);
    lines.push(`B ${ex} ${R} ${mz} 8`);
    // Meridian YZ
    lines.push(`B ${R} ${ey} ${mz} 8`);
  }

  return lines.join('\n');
}

// ═══ CLI ═══

const args = process.argv.slice(2);
const N = parseInt(args[0]) || 8;
const starts = parseInt(args[1]) || 20;
const verbose = args.includes('--verbose') || args.includes('-v');

console.log(`\n${'═'.repeat(60)}`);
console.log(`  THOMSON PROBLEM — N = ${N}`);
console.log(`${'═'.repeat(60)}\n`);

// Known energies for verification
const known = {
  2: 0.5, 3: 1.732051, 4: 3.674234, 5: 6.474691,
  6: 9.985281, 7: 14.452978, 8: 19.675288, 9: 25.759987,
  10: 32.716949, 11: 40.596450, 12: 49.165253,
  13: 58.853230, 14: 69.306363, 15: 80.670244,
  16: 92.911655, 17: 106.050404, 18: 120.084468,
  20: 150.881568, 24: 220.200509, 32: 412.261274,
  48: 1055.182314, 64: 1963.449898,
};

console.log(`Solving with ${starts} random starts (hybrid SA+GD)...\n`);
const result = solveThomson(N, { starts, method: 'hybrid', verbose });

console.log(`\n${'─'.repeat(40)}`);
console.log(`Best energy: ${result.energy.toFixed(6)}`);
if (known[N]) {
  const gap = ((result.energy - known[N]) / known[N] * 100);
  console.log(`Known best:  ${known[N].toFixed(6)} ${gap < 0.001 ? '✓ MATCHED' : `(gap: ${gap.toFixed(4)}%)`}`);
}
console.log(`${'─'.repeat(40)}\n`);

// ═══ Visualize ═══

// 1. Three orthogonal views of the configuration
console.log(renderSphereConfig(result.points, `Thomson N=${N}`));
console.log('');

// 2. Potential field on sphere surface
console.log(renderChargeField(result.points));
console.log('');

// 3. Symmetry analysis
const sym = detectSymmetry(result.points);
console.log(`Symmetry analysis:`);
console.log(`  Distinct distances: ${sym.distinctDistances}`);
console.log(`  Kissing number: ${sym.kissing}`);
console.log(`  Min distance: ${sym.minDist.toFixed(6)}`);
console.log(`  Max distance: ${sym.maxDist.toFixed(6)}`);
console.log(`  Regular: ${sym.isRegular ? 'YES (high symmetry)' : 'NO (irregular)'}`);
console.log('');

// 4. Distance distribution
const analysis = pairwiseAnalysis(result.points);
console.log(signal(analysis.histogram, {
  label: 'Pairwise distance histogram',
  width: 40,
  height: 10,
}));
console.log('');

// 5. Energy landscape across starts
console.log(signal(result.allEnergies.sort((a, b) => a - b), {
  label: 'Energy across random starts (sorted)',
  width: 40,
  height: 8,
}));
console.log('');

// 6. Distance groups table
const rows = sym.distanceGroups.slice(0, 10).map(g => [g.dist.toFixed(6), g.count.toString()]);
console.log(table(['Distance', 'Count'], rows, { label: 'Distinct distance groups' }));

// 7. Force field
console.log('');
console.log(renderForceField(result.points));

// 8. Export VOXI
const voxi = toVOXI(result.points);
const fs = await import('fs');
const voxiPath = `/Users/robertpaszek/Desktop/Research/spatial-reasoning-dsl/voxi-math/problems/thomson-problem/sketches/thomson-n${N}.voxi`;
fs.writeFileSync(voxiPath, voxi);
console.log(`\nVOXI saved: ${voxiPath}`);

// Save data
const dataPath = `/Users/robertpaszek/Desktop/Research/spatial-reasoning-dsl/voxi-math/problems/thomson-problem/data/thomson-n${N}.json`;
fs.writeFileSync(dataPath, JSON.stringify({
  N,
  energy: result.energy,
  knownEnergy: known[N] ?? null,
  points: result.points,
  symmetry: sym,
  pairwise: { min: analysis.min, max: analysis.max, mean: analysis.mean },
  allEnergies: result.allEnergies,
}, null, 2));
console.log(`Data saved: ${dataPath}`);
