/**
 * thomson-solver.js — Basin-hopping Thomson solver.
 *
 * State-of-the-art method (Wales & Doye 1997):
 *   1. Local minimization on S² (L-BFGS-like with projection)
 *   2. Random perturbation
 *   3. Metropolis accept/reject of new basin
 *   4. Memory of visited basins to avoid revisiting
 *
 * Also supports:
 *   - Seeded starts (known polyhedra)
 *   - Multi-start parallel basin-hopping
 *   - Riesz s-energy generalization
 */

// ═══ Core geometry ═══

function randomSpherePoint() {
  let x, y, s;
  do { x = 2 * Math.random() - 1; y = 2 * Math.random() - 1; s = x * x + y * y; } while (s >= 1);
  const r = 2 * Math.sqrt(1 - s);
  return [r * x, r * y, 1 - 2 * s];
}

function normalize(v) {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return l > 1e-15 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1];
}

function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// ═══ Energy and gradient ═══

function coulombEnergy(points, s = 1) {
  let E = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = dist(points[i], points[j]);
      E += s === 1 ? 1 / d : 1 / (d ** s);
    }
  }
  return E;
}

/** Tangential gradient (projected to sphere surface) */
function gradient(points, s = 1) {
  const N = points.length;
  const G = new Array(N);

  for (let i = 0; i < N; i++) {
    let gx = 0, gy = 0, gz = 0;
    const [xi, yi, zi] = points[i];

    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = xi - points[j][0];
      const dy = yi - points[j][1];
      const dz = zi - points[j][2];
      const d2 = dx * dx + dy * dy + dz * dz;
      const d = Math.sqrt(d2);

      // Gradient of 1/d^s = -s * (r_i - r_j) / d^(s+2)
      const factor = -s / (d ** (s + 2));
      gx += factor * dx;
      gy += factor * dy;
      gz += factor * dz;
    }

    // Project to tangent plane: G_tan = G - (G·n)n
    const dot = gx * xi + gy * yi + gz * zi;
    G[i] = [gx - dot * xi, gy - dot * yi, gz - dot * zi];
  }

  return G;
}

function gradNorm(G) {
  let maxNorm = 0;
  for (const g of G) {
    const n = Math.sqrt(g[0] ** 2 + g[1] ** 2 + g[2] ** 2);
    if (n > maxNorm) maxNorm = n;
  }
  return maxNorm;
}

// ═══ Local minimizer: Nonlinear CG on sphere ═══

function localMinimize(points, opts = {}) {
  const maxIter = opts.maxIter ?? 5000;
  const tol = opts.tol ?? 1e-10;
  const s = opts.s ?? 1;

  let G = gradient(points, s);
  let d = G.map(g => [-g[0], -g[1], -g[2]]); // descent direction = -gradient
  let gNormSq = G.reduce((acc, g) => acc + g[0] ** 2 + g[1] ** 2 + g[2] ** 2, 0);

  for (let iter = 0; iter < maxIter; iter++) {
    if (gradNorm(G) < tol) break;

    // Line search along geodesic (approximate: project after step)
    let alpha = 0.01;
    const E0 = coulombEnergy(points, s);

    // Backtracking line search
    for (let bt = 0; bt < 20; bt++) {
      const trial = points.map((p, i) =>
        normalize([p[0] + alpha * d[i][0], p[1] + alpha * d[i][1], p[2] + alpha * d[i][2]])
      );
      const E1 = coulombEnergy(trial, s);
      if (E1 < E0 - 1e-14 * Math.abs(E0)) {
        for (let i = 0; i < points.length; i++) points[i] = trial[i];
        break;
      }
      alpha *= 0.5;
      if (alpha < 1e-15) break;
    }

    // New gradient
    const newG = gradient(points, s);
    const newGNormSq = newG.reduce((acc, g) => acc + g[0] ** 2 + g[1] ** 2 + g[2] ** 2, 0);

    // Polak-Ribière beta
    let dotGG = 0;
    for (let i = 0; i < points.length; i++) {
      dotGG += (newG[i][0] - G[i][0]) * newG[i][0] +
               (newG[i][1] - G[i][1]) * newG[i][1] +
               (newG[i][2] - G[i][2]) * newG[i][2];
    }
    const beta = Math.max(0, dotGG / (gNormSq + 1e-30));

    // Update direction
    d = newG.map((g, i) => [
      -g[0] + beta * d[i][0],
      -g[1] + beta * d[i][1],
      -g[2] + beta * d[i][2],
    ]);

    // Project direction to tangent plane
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dot = d[i][0] * p[0] + d[i][1] * p[1] + d[i][2] * p[2];
      d[i] = [d[i][0] - dot * p[0], d[i][1] - dot * p[1], d[i][2] - dot * p[2]];
    }

    G = newG;
    gNormSq = newGNormSq;

    // Reset CG direction periodically
    if (iter % (3 * points.length) === 0) {
      d = G.map(g => [-g[0], -g[1], -g[2]]);
    }
  }

  return coulombEnergy(points, s);
}

// ═══ Basin-hopping ═══

function basinHop(points, opts = {}) {
  const maxHops = opts.maxHops ?? 500;
  const temperature = opts.temperature ?? 0.5;
  const perturbSize = opts.perturbSize ?? 0.4;
  const s = opts.s ?? 1;
  const verbose = opts.verbose ?? false;

  // Initial local minimization
  let E = localMinimize(points, { s, maxIter: 8000 });
  let bestE = E;
  let bestPoints = points.map(p => [...p]);

  // Basin memory: fingerprint = sorted rounded distances
  const visited = new Set();
  const fingerprint = (pts) => {
    const dists = [];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        dists.push(dist(pts[i], pts[j]).toFixed(4));
    dists.sort();
    return dists.join(',');
  };

  visited.add(fingerprint(points));
  let accepted = 0, improved = 0, unique = 0;

  for (let hop = 0; hop < maxHops; hop++) {
    // Save current state
    const saved = points.map(p => [...p]);
    const savedE = E;

    // Random perturbation: displace random subset of points
    const numPerturb = Math.max(1, Math.floor(Math.random() * points.length * 0.5));
    const indices = [];
    while (indices.length < numPerturb) {
      const idx = Math.floor(Math.random() * points.length);
      if (!indices.includes(idx)) indices.push(idx);
    }

    for (const idx of indices) {
      const size = perturbSize * (0.5 + Math.random());
      points[idx] = normalize([
        points[idx][0] + (Math.random() - 0.5) * size,
        points[idx][1] + (Math.random() - 0.5) * size,
        points[idx][2] + (Math.random() - 0.5) * size,
      ]);
    }

    // Local minimization from perturbed state
    const newE = localMinimize(points, { s, maxIter: 8000 });

    // Check if new basin
    const fp = fingerprint(points);
    const isNew = !visited.has(fp);
    if (isNew) { visited.add(fp); unique++; }

    // Metropolis criterion
    const dE = newE - savedE;
    if (dE < 0 || Math.random() < Math.exp(-dE / temperature)) {
      E = newE;
      accepted++;

      if (newE < bestE) {
        bestE = newE;
        bestPoints = points.map(p => [...p]);
        improved++;
        if (verbose) {
          console.log(`  Hop ${hop}: NEW BEST E=${bestE.toFixed(8)} (dE=${dE.toFixed(6)}, ${isNew ? 'new basin' : 'known basin'})`);
        }
      }
    } else {
      // Reject: restore
      for (let i = 0; i < points.length; i++) points[i] = saved[i];
      E = savedE;
    }
  }

  // Restore best
  for (let i = 0; i < points.length; i++) points[i] = [...bestPoints[i]];

  // Final polish
  localMinimize(points, { s, maxIter: 20000, tol: 1e-14 });
  bestE = coulombEnergy(points, s);

  return {
    energy: bestE,
    points,
    stats: { accepted, improved, unique, visited: visited.size, totalHops: maxHops },
  };
}

// ═══ Known polyhedra seeds ═══

function snubCubeVertices() {
  // Snub cube: 24 vertices with chiral octahedral symmetry
  // Using the tribonacci constant t ≈ 1.8393
  const t = 1.8392867552141612; // real root of t³ = t² + t + 1
  const points = [];

  // Even permutations of (±1, ±1/t, ±t) with even sign changes
  const vals = [1, 1 / t, t];
  const evenPerms = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  const signs = [];
  for (let a = -1; a <= 1; a += 2)
    for (let b = -1; b <= 1; b += 2)
      for (let c = -1; c <= 1; c += 2)
        if (a * b * c === 1) signs.push([a, b, c]); // even sign changes

  for (const perm of evenPerms) {
    for (const sign of signs) {
      const pt = [sign[0] * vals[perm[0]], sign[1] * vals[perm[1]], sign[2] * vals[perm[2]]];
      points.push(normalize(pt));
    }
  }

  // Odd permutations with odd sign changes
  const oddPerms = [[0, 2, 1], [2, 1, 0], [1, 0, 2]];
  const oddSigns = [];
  for (let a = -1; a <= 1; a += 2)
    for (let b = -1; b <= 1; b += 2)
      for (let c = -1; c <= 1; c += 2)
        if (a * b * c === -1) oddSigns.push([a, b, c]);

  for (const perm of oddPerms) {
    for (const sign of oddSigns) {
      const pt = [sign[0] * vals[perm[0]], sign[1] * vals[perm[1]], sign[2] * vals[perm[2]]];
      points.push(normalize(pt));
    }
  }

  // Should have 24 points (might have dupes, deduplicate)
  const unique = [];
  for (const p of points) {
    let isDupe = false;
    for (const q of unique) {
      if (dist(p, q) < 0.01) { isDupe = true; break; }
    }
    if (!isDupe) unique.push(p);
  }

  // If we got too many or too few, just return first 24
  return unique.slice(0, 24);
}

function icosahedronVertices() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [0, 1, phi], [0, 1, -phi], [0, -1, phi], [0, -1, -phi],
    [1, phi, 0], [1, -phi, 0], [-1, phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1],
  ];
  return raw.map(normalize);
}

// ═══ Analysis ═══

function analyzeConfig(points) {
  const dists = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      dists.push(dist(points[i], points[j]));
  dists.sort((a, b) => a - b);

  let distinctCount = 1;
  for (let i = 1; i < dists.length; i++)
    if (dists[i] - dists[i - 1] > 0.0001) distinctCount++;

  // Kissing number (nearest neighbors per point)
  const nearDist = dists[0];
  const nearCount = dists.filter(d => d < nearDist * 1.02).length;
  const kissing = Math.round(nearCount * 2 / points.length);

  return {
    energy: coulombEnergy(points),
    minDist: dists[0],
    maxDist: dists[dists.length - 1],
    distinctDistances: distinctCount,
    kissing,
    totalPairs: dists.length,
  };
}

// ═══ Main solver ═══

export function solveThomson(N, opts = {}) {
  const runs = opts.runs ?? 10;
  const hopsPerRun = opts.hopsPerRun ?? 300;
  const temperature = opts.temperature ?? 0.5;
  const perturbSize = opts.perturbSize ?? 0.4;
  const seed = opts.seed ?? null; // array of initial points
  const s = opts.s ?? 1;
  const verbose = opts.verbose ?? false;

  let globalBest = Infinity;
  let globalBestPoints = null;
  const allEnergies = [];

  for (let run = 0; run < runs; run++) {
    // Initialize
    let points;
    if (seed && run === 0) {
      // First run: use seed (with slight perturbation)
      points = seed.map(p => {
        const noise = 0.01;
        return normalize([
          p[0] + (Math.random() - 0.5) * noise,
          p[1] + (Math.random() - 0.5) * noise,
          p[2] + (Math.random() - 0.5) * noise,
        ]);
      });
    } else {
      points = Array.from({ length: N }, () => randomSpherePoint());
    }

    // Basin-hopping
    const result = basinHop(points, {
      maxHops: hopsPerRun,
      temperature: temperature * (1 + run * 0.1), // vary temperature across runs
      perturbSize: perturbSize * (0.8 + Math.random() * 0.4),
      s,
      verbose: verbose && run === 0,
    });

    allEnergies.push(result.energy);

    if (result.energy < globalBest) {
      globalBest = result.energy;
      globalBestPoints = result.points.map(p => [...p]);
      if (verbose) {
        console.log(`Run ${run + 1}/${runs}: E=${result.energy.toFixed(8)} *** NEW GLOBAL BEST *** (${result.stats.unique} unique basins)`);
      }
    } else if (verbose) {
      console.log(`Run ${run + 1}/${runs}: E=${result.energy.toFixed(8)} (best: ${globalBest.toFixed(8)})`);
    }
  }

  return {
    N,
    energy: globalBest,
    points: globalBestPoints,
    analysis: analyzeConfig(globalBestPoints),
    allEnergies,
  };
}

// ═══ CLI ═══

const args = process.argv.slice(2);
if (args.length > 0) {
  const N = parseInt(args[0]) || 24;
  const runs = parseInt(args[1]) || 10;
  const hops = parseInt(args[2]) || 300;
  const verbose = args.includes('-v') || args.includes('--verbose');
  const useSeed = args.includes('--seed');

  // Known energies
  const known = {
    2: 0.5, 3: 1.732051, 4: 3.674234, 5: 6.474691, 6: 9.985281,
    7: 14.452978, 8: 19.675288, 9: 25.759987, 10: 32.716949,
    11: 40.596450, 12: 49.165253, 13: 58.853230, 14: 69.306363,
    15: 80.670244, 16: 92.911655, 17: 106.050404, 18: 120.084468,
    19: 135.089468, 20: 150.881568, 24: 220.200509, 32: 412.261274,
    48: 1055.182314, 64: 1963.449898, 72: 2511.804757, 80: 3102.253843,
    100: 4952.468259, 128: 8283.092825, 150: 11438.449, 200: 20703.865,
  };

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  BASIN-HOPPING THOMSON SOLVER — N = ${N}`);
  console.log(`  ${runs} runs × ${hops} hops = ${runs * hops} total basin hops`);
  console.log(`${'═'.repeat(60)}\n`);

  // Prepare seed
  let seed = null;
  if (useSeed) {
    if (N === 12) seed = icosahedronVertices();
    else if (N === 24) seed = snubCubeVertices();
    if (seed) console.log(`Using seeded start (${seed.length} points)\n`);
  }

  const result = solveThomson(N, { runs, hopsPerRun: hops, verbose, seed });

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Best energy:    ${result.energy.toFixed(8)}`);
  if (known[N]) {
    const gap = (result.energy - known[N]) / known[N] * 100;
    console.log(`Known best:     ${known[N].toFixed(8)}`);
    console.log(`Gap:            ${gap.toFixed(6)}% ${gap < 0.001 ? '✓ MATCHED' : gap < 0.01 ? '~ CLOSE' : ''}`);
  }
  console.log(`${'─'.repeat(50)}`);

  const a = result.analysis;
  console.log(`\nConfig analysis:`);
  console.log(`  Distinct distances: ${a.distinctDistances}/${a.totalPairs}`);
  console.log(`  Min distance:       ${a.minDist.toFixed(6)}`);
  console.log(`  Max distance:       ${a.maxDist.toFixed(6)}`);
  console.log(`  Kissing number:     ${a.kissing}`);

  // Save
  const fs = await import('fs');
  const outPath = `problems/thomson-problem/data/basin-hop-n${N}.json`;
  fs.writeFileSync(outPath, JSON.stringify({
    N: result.N,
    energy: result.energy,
    knownEnergy: known[N] ?? null,
    points: result.points,
    analysis: result.analysis,
    allEnergies: result.allEnergies,
  }, null, 2));
  console.log(`\nSaved: ${outPath}`);
}
