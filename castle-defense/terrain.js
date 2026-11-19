/**
 * terrain.js — Procedural terrain generation for Castle Defense
 *
 * Self-contained ES module. No external dependencies.
 * Generates a 30x30 grid with elevation, biomes, water, forests,
 * guaranteed pathing, and varied strategic terrain every game.
 *
 * Usage:
 *   import { generateTerrain, BIOMES } from './terrain.js';
 *   const map = generateTerrain(42, 'grassland');
 */

// ═══════════════════════════════════════════════════════════════
//  1. SEEDED PRNG (Mulberry32)
// ═══════════════════════════════════════════════════════════════

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function toNumericSeed(seed) {
  if (typeof seed === "number") return seed;
  if (typeof seed === "string") return hashSeed(seed);
  return Date.now();
}

// ═══════════════════════════════════════════════════════════════
//  2. SIMPLEX NOISE (2D) — Minimal implementation
// ═══════════════════════════════════════════════════════════════

function createNoise2D(rng) {
  // Gradient table — 12 directions
  const GRAD = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  // Permutation table seeded from rng
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  // Fisher-Yates shuffle with seeded rng
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }

  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  function dot2(gi, x, y) {
    const g = GRAD[gi % 12];
    return g[0] * x + g[1] * y;
  }

  return function noise2D(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]];
    const gi1 = perm[ii + i1 + perm[jj + j1]];
    const gi2 = perm[ii + 1 + perm[jj + 1]];

    let n0 = 0,
      n1 = 0,
      n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * dot2(gi0, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * dot2(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * dot2(gi2, x2, y2);
    }

    // Scale to [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  };
}

// ═══════════════════════════════════════════════════════════════
//  3. NOISE UTILITIES — Fractal Brownian Motion
// ═══════════════════════════════════════════════════════════════

function fbm(
  noise,
  x,
  y,
  octaves,
  frequency,
  amplitude,
  lacunarity,
  persistence,
) {
  let value = 0;
  let freq = frequency;
  let amp = amplitude;
  for (let o = 0; o < octaves; o++) {
    value += noise(x * freq, y * freq) * amp;
    freq *= lacunarity;
    amp *= persistence;
  }
  return value;
}

// ═══════════════════════════════════════════════════════════════
//  4. BIOME DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const BIOMES = Object.freeze({
  grassland: Object.freeze({
    name: "Grassland",
    groundColor: "#4a8c3f",
    hillColor: "#5ea84e",
    sandColor: "#c2b280",
    waterColor: "#3377cc",
    mountainColor: "#7a7a7a",
    swampColor: "#3d5c2e",
    forestColor: "#2d6b1e",
    bridgeColor: "#8b6914",
    snowColor: "#e8e8e8",
    noiseFrequency: 0.08,
    noiseOctaves: 4,
    noiseAmplitude: 1.0,
    noiseLacunarity: 2.0,
    noisePersistence: 0.5,
    elevationRoughness: 0.6,
    waterThreshold: -0.35,
    mountainThreshold: 0.75,
    hillThreshold: 0.2,
    highHillThreshold: 0.5,
    treeDensity: 0.12,
    treeClusterSize: 3,
    riverChance: 0.6,
    riverWidth: 1,
    lakeChance: 0.3,
    swampAmount: 0.0,
  }),
  forest: Object.freeze({
    name: "Forest",
    groundColor: "#3a7a35",
    hillColor: "#4d9643",
    sandColor: "#a89060",
    waterColor: "#2266aa",
    mountainColor: "#686868",
    swampColor: "#2d4c20",
    forestColor: "#1a5c10",
    bridgeColor: "#7a5c10",
    snowColor: "#d8d8d8",
    noiseFrequency: 0.07,
    noiseOctaves: 4,
    noiseAmplitude: 0.9,
    noiseLacunarity: 2.0,
    noisePersistence: 0.55,
    elevationRoughness: 0.5,
    waterThreshold: -0.4,
    mountainThreshold: 0.8,
    hillThreshold: 0.15,
    highHillThreshold: 0.45,
    treeDensity: 0.28,
    treeClusterSize: 5,
    riverChance: 0.5,
    riverWidth: 1,
    lakeChance: 0.2,
    swampAmount: 0.05,
  }),
  desert: Object.freeze({
    name: "Desert",
    groundColor: "#c2a55a",
    hillColor: "#d4b86a",
    sandColor: "#dcc880",
    waterColor: "#2255aa",
    mountainColor: "#8a7050",
    swampColor: "#8a7a50",
    forestColor: "#6a8a40",
    bridgeColor: "#9a7a20",
    snowColor: "#f0f0f0",
    noiseFrequency: 0.06,
    noiseOctaves: 3,
    noiseAmplitude: 1.2,
    noiseLacunarity: 2.2,
    noisePersistence: 0.4,
    elevationRoughness: 0.8,
    waterThreshold: -0.6,
    mountainThreshold: 0.65,
    hillThreshold: 0.25,
    highHillThreshold: 0.5,
    treeDensity: 0.03,
    treeClusterSize: 2,
    riverChance: 0.3,
    riverWidth: 1,
    lakeChance: 0.1,
    swampAmount: 0.0,
  }),
  snow: Object.freeze({
    name: "Snow",
    groundColor: "#d8dce8",
    hillColor: "#e8ecf4",
    sandColor: "#b8b8c0",
    waterColor: "#4488bb",
    mountainColor: "#8888a0",
    swampColor: "#6080a0",
    forestColor: "#2a5040",
    bridgeColor: "#6a5530",
    snowColor: "#f4f4f8",
    noiseFrequency: 0.07,
    noiseOctaves: 4,
    noiseAmplitude: 1.1,
    noiseLacunarity: 2.0,
    noisePersistence: 0.5,
    elevationRoughness: 0.7,
    waterThreshold: -0.35,
    mountainThreshold: 0.65,
    hillThreshold: 0.2,
    highHillThreshold: 0.45,
    treeDensity: 0.08,
    treeClusterSize: 2,
    riverChance: 0.4,
    riverWidth: 1,
    lakeChance: 0.25,
    swampAmount: 0.0,
  }),
  swamp: Object.freeze({
    name: "Swamp",
    groundColor: "#4a6838",
    hillColor: "#5a7848",
    sandColor: "#8a8860",
    waterColor: "#2a5a3a",
    mountainColor: "#5a5a50",
    swampColor: "#3a4828",
    forestColor: "#1a4020",
    bridgeColor: "#5a4a18",
    snowColor: "#c0c0c0",
    noiseFrequency: 0.09,
    noiseOctaves: 5,
    noiseAmplitude: 0.7,
    noiseLacunarity: 2.0,
    noisePersistence: 0.6,
    elevationRoughness: 0.3,
    waterThreshold: -0.15,
    mountainThreshold: 0.85,
    hillThreshold: 0.3,
    highHillThreshold: 0.6,
    treeDensity: 0.18,
    treeClusterSize: 4,
    riverChance: 0.7,
    riverWidth: 2,
    lakeChance: 0.5,
    swampAmount: 0.25,
  }),
  mountain: Object.freeze({
    name: "Mountain",
    groundColor: "#6a7a5a",
    hillColor: "#7a8a6a",
    sandColor: "#9a9080",
    waterColor: "#3366aa",
    mountainColor: "#606060",
    swampColor: "#4a5a3a",
    forestColor: "#2a5a2a",
    bridgeColor: "#7a6020",
    snowColor: "#e0e4e8",
    noiseFrequency: 0.1,
    noiseOctaves: 5,
    noiseAmplitude: 1.4,
    noiseLacunarity: 2.0,
    noisePersistence: 0.5,
    elevationRoughness: 1.0,
    waterThreshold: -0.4,
    mountainThreshold: 0.5,
    hillThreshold: 0.1,
    highHillThreshold: 0.3,
    treeDensity: 0.06,
    treeClusterSize: 2,
    riverChance: 0.5,
    riverWidth: 1,
    lakeChance: 0.2,
    swampAmount: 0.0,
  }),
});

const BIOME_KEYS = Object.keys(BIOMES);

// ═══════════════════════════════════════════════════════════════
//  5. CONSTANTS
// ═══════════════════════════════════════════════════════════════

const GRID_SIZE = 30;
const CELL_SIZE = 2; // world units per cell

// Castle occupies center: 2x2 keep inside 6x6 compound
const CASTLE_CENTER = 15; // grid center (0-indexed: cells 12-17 for compound)
const COMPOUND_HALF = 3;
const KEEP_HALF = 1;

// Spawn points: one on each edge, centered
const SPAWN_OFFSETS = [
  { x: 0, z: GRID_SIZE / 2 }, // West
  { x: GRID_SIZE - 1, z: GRID_SIZE / 2 }, // East
  { x: GRID_SIZE / 2, z: 0 }, // North
  { x: GRID_SIZE / 2, z: GRID_SIZE - 1 }, // South
];

// Elevation levels
const ELEV_WATER = -1;
const ELEV_GROUND = 0;
const ELEV_LOW_HILL = 1;
const ELEV_HIGH_HILL = 2;
const ELEV_MOUNTAIN = 3; // impassable

// A* movement costs
const COST_GROUND = 1.0;
const COST_LOW_HILL = 1.5;
const COST_HIGH_HILL = 2.5;
const COST_SWAMP = 3.0;
const COST_FOREST = 1.2;
const COST_BRIDGE = 1.0;
const COST_IMPASSABLE = Infinity;

// ═══════════════════════════════════════════════════════════════
//  6. GRID CREATION HELPERS
// ═══════════════════════════════════════════════════════════════

function createGrid(defaultVal) {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => defaultVal),
  );
}

function inBounds(x, z) {
  return x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE;
}

function isCastle(x, z) {
  const cx = CASTLE_CENTER;
  const cz = CASTLE_CENTER;
  return (
    x >= cx - COMPOUND_HALF &&
    x < cx + COMPOUND_HALF &&
    z >= cz - COMPOUND_HALF &&
    z < cz + COMPOUND_HALF
  );
}

function isKeep(x, z) {
  const cx = CASTLE_CENTER;
  const cz = CASTLE_CENTER;
  return (
    x >= cx - KEEP_HALF &&
    x < cx + KEEP_HALF &&
    z >= cz - KEEP_HALF &&
    z < cz + KEEP_HALF
  );
}

function distToCastle(x, z) {
  const dx = x - CASTLE_CENTER;
  const dz = z - CASTLE_CENTER;
  return Math.sqrt(dx * dx + dz * dz);
}

// ═══════════════════════════════════════════════════════════════
//  7. ELEVATION GENERATION
// ═══════════════════════════════════════════════════════════════

function generateElevation(noise, biome, rng) {
  const elevation = createGrid(0);
  const raw = createGrid(0);

  // Generate raw noise values
  const offsetX = rng() * 1000;
  const offsetZ = rng() * 1000;

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const nx = x + offsetX;
      const nz = z + offsetZ;

      let val = fbm(
        noise,
        nx,
        nz,
        biome.noiseOctaves,
        biome.noiseFrequency,
        biome.noiseAmplitude,
        biome.noiseLacunarity,
        biome.noisePersistence,
      );

      // Flatten near castle (smooth radial falloff)
      const dist = distToCastle(x, z);
      if (dist < 6) {
        const flattenFactor = Math.max(0, 1 - dist / 6);
        val *= 1 - flattenFactor;
      }

      // Flatten near spawn points
      for (const sp of SPAWN_OFFSETS) {
        const sdx = x - sp.x;
        const sdz = z - sp.z;
        const sdist = Math.sqrt(sdx * sdx + sdz * sdz);
        if (sdist < 3) {
          const flattenFactor = Math.max(0, 1 - sdist / 3);
          val *= 1 - flattenFactor;
        }
      }

      raw[x][z] = val;
    }
  }

  // Quantize raw values to elevation levels
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const val = raw[x][z];

      if (isCastle(x, z)) {
        elevation[x][z] = ELEV_GROUND;
      } else if (val < biome.waterThreshold) {
        elevation[x][z] = ELEV_WATER;
      } else if (val > biome.mountainThreshold) {
        elevation[x][z] = ELEV_MOUNTAIN;
      } else if (val > biome.highHillThreshold) {
        elevation[x][z] = ELEV_HIGH_HILL;
      } else if (val > biome.hillThreshold) {
        elevation[x][z] = ELEV_LOW_HILL;
      } else {
        elevation[x][z] = ELEV_GROUND;
      }
    }
  }

  // Ensure spawn points are ground-level
  for (const sp of SPAWN_OFFSETS) {
    elevation[sp.x][sp.z] = ELEV_GROUND;
    // Clear area around spawn
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = sp.x + dx;
        const nz = sp.z + dz;
        if (inBounds(nx, nz)) {
          if (
            elevation[nx][nz] === ELEV_WATER ||
            elevation[nx][nz] === ELEV_MOUNTAIN
          ) {
            elevation[nx][nz] = ELEV_GROUND;
          }
        }
      }
    }
  }

  return { elevation, raw };
}

// ═══════════════════════════════════════════════════════════════
//  8. RIVER CARVING
// ═══════════════════════════════════════════════════════════════

function carveRiver(elevation, rng, biome) {
  const riverCells = [];

  if (rng() > biome.riverChance) return riverCells;

  // Pick a random edge to start and aim roughly toward opposite side
  const side = (rng() * 4) | 0;
  let sx, sz, tx, tz;

  switch (side) {
    case 0: // West to East
      sx = 0;
      sz = (3 + rng() * (GRID_SIZE - 6)) | 0;
      tx = GRID_SIZE - 1;
      tz = (3 + rng() * (GRID_SIZE - 6)) | 0;
      break;
    case 1: // East to West
      sx = GRID_SIZE - 1;
      sz = (3 + rng() * (GRID_SIZE - 6)) | 0;
      tx = 0;
      tz = (3 + rng() * (GRID_SIZE - 6)) | 0;
      break;
    case 2: // North to South
      sx = (3 + rng() * (GRID_SIZE - 6)) | 0;
      sz = 0;
      tx = (3 + rng() * (GRID_SIZE - 6)) | 0;
      tz = GRID_SIZE - 1;
      break;
    default: // South to North
      sx = (3 + rng() * (GRID_SIZE - 6)) | 0;
      sz = GRID_SIZE - 1;
      tx = (3 + rng() * (GRID_SIZE - 6)) | 0;
      tz = 0;
      break;
  }

  // Walk from source to target with gentle meandering
  let cx = sx;
  let cz = sz;
  const width = biome.riverWidth;
  const maxSteps = GRID_SIZE * 3;

  for (let step = 0; step < maxSteps; step++) {
    // Mark river cells
    for (let dw = -width + 1; dw < width; dw++) {
      const horizontal = Math.abs(tx - sx) > Math.abs(tz - sz);
      const rx = horizontal ? cx : cx + dw;
      const rz = horizontal ? cz + dw : cz;

      if (inBounds(rx, rz) && !isCastle(rx, rz)) {
        elevation[rx][rz] = ELEV_WATER;
        riverCells.push({ x: rx, z: rz });
      }
    }

    // Move toward target with random drift
    const dx = tx - cx;
    const dz = tz - cz;

    if (Math.abs(dx) < 1 && Math.abs(dz) < 1) break;

    // Bias toward target, but add randomness
    const moveX = dx !== 0 ? Math.sign(dx) : 0;
    const moveZ = dz !== 0 ? Math.sign(dz) : 0;

    const drift = rng();
    if (drift < 0.3) {
      // Random perpendicular drift
      if (Math.abs(dx) > Math.abs(dz)) {
        cz += rng() > 0.5 ? 1 : -1;
      } else {
        cx += rng() > 0.5 ? 1 : -1;
      }
    } else if (drift < 0.6) {
      cx += moveX;
    } else if (drift < 0.9) {
      cz += moveZ;
    } else {
      cx += moveX;
      cz += moveZ;
    }

    cx = Math.max(0, Math.min(GRID_SIZE - 1, cx));
    cz = Math.max(0, Math.min(GRID_SIZE - 1, cz));
  }

  return riverCells;
}

// ═══════════════════════════════════════════════════════════════
//  9. FOREST PLACEMENT (Poisson-ish disk sampling)
// ═══════════════════════════════════════════════════════════════

function placeForests(elevation, terrain, rng, biome) {
  const forestCells = [];
  const targetCount = Math.round(GRID_SIZE * GRID_SIZE * biome.treeDensity);
  const minDist = 1.5; // Minimum distance between cluster centers

  // Generate cluster centers using rejection sampling
  const centers = [];
  const maxAttempts = targetCount * 10;
  let attempts = 0;

  while (
    centers.length < Math.ceil(targetCount / biome.treeClusterSize) &&
    attempts < maxAttempts
  ) {
    attempts++;
    const x = (rng() * GRID_SIZE) | 0;
    const z = (rng() * GRID_SIZE) | 0;

    if (!inBounds(x, z)) continue;
    if (isCastle(x, z)) continue;
    if (elevation[x][z] === ELEV_WATER || elevation[x][z] === ELEV_MOUNTAIN)
      continue;

    // Check minimum distance from other centers
    let tooClose = false;
    for (const c of centers) {
      const dx = c.x - x;
      const dz = c.z - z;
      if (Math.sqrt(dx * dx + dz * dz) < minDist * 2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    centers.push({ x, z });
  }

  // Expand clusters
  for (const center of centers) {
    for (let i = 0; i < biome.treeClusterSize; i++) {
      const ox = center.x + ((rng() * 3 - 1.5) | 0);
      const oz = center.z + ((rng() * 3 - 1.5) | 0);

      if (!inBounds(ox, oz)) continue;
      if (isCastle(ox, oz)) continue;
      if (
        elevation[ox][oz] === ELEV_WATER ||
        elevation[ox][oz] === ELEV_MOUNTAIN
      )
        continue;
      if (terrain[ox][oz] === "forest") continue;

      // Don't place forest on spawn points
      let isSpawn = false;
      for (const sp of SPAWN_OFFSETS) {
        if (Math.abs(ox - sp.x) <= 1 && Math.abs(oz - sp.z) <= 1) {
          isSpawn = true;
          break;
        }
      }
      if (isSpawn) continue;

      terrain[ox][oz] = "forest";
      forestCells.push({ x: ox, z: oz });
    }
  }

  return forestCells;
}

// ═══════════════════════════════════════════════════════════════
//  10. SWAMP PLACEMENT
// ═══════════════════════════════════════════════════════════════

function placeSwamps(elevation, terrain, noise, biome, rng) {
  if (biome.swampAmount <= 0) return;

  const offsetX = rng() * 500;
  const offsetZ = rng() * 500;

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      if (isCastle(x, z)) continue;
      if (elevation[x][z] !== ELEV_GROUND) continue;
      if (terrain[x][z] !== "ground") continue;

      // Use a separate noise pass for swamp distribution
      const val = noise((x + offsetX) * 0.12, (z + offsetZ) * 0.12);
      if (val > 0 && val < biome.swampAmount * 2) {
        terrain[x][z] = "swamp";
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  11. A* PATHFINDING
// ═══════════════════════════════════════════════════════════════

function getMoveCost(elevation, terrain, x, z) {
  if (!inBounds(x, z)) return COST_IMPASSABLE;

  const elev = elevation[x][z];
  const terr = terrain[x][z];

  if (elev === ELEV_MOUNTAIN) return COST_IMPASSABLE;
  if (elev === ELEV_WATER && terr !== "bridge") return COST_IMPASSABLE;
  if (terr === "bridge") return COST_BRIDGE;
  if (terr === "swamp") return COST_SWAMP;
  if (terr === "forest") return COST_FOREST;
  if (elev === ELEV_HIGH_HILL) return COST_HIGH_HILL;
  if (elev === ELEV_LOW_HILL) return COST_LOW_HILL;
  return COST_GROUND;
}

function heuristic(ax, az, bx, bz) {
  // Chebyshev distance (allows diagonal)
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

/**
 * Cost-weighted A* from (sx,sz) to any cell in targetSet.
 * Returns path as array of {x, z} or null if unreachable.
 */
function astar(elevation, terrain, sx, sz, targetSet) {
  const key = (x, z) => x * GRID_SIZE + z;

  // Find nearest target for heuristic
  let bestTargetX = CASTLE_CENTER;
  let bestTargetZ = CASTLE_CENTER;

  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();
  const openSet = []; // min-heap by fScore
  const closedSet = new Set();

  const startKey = key(sx, sz);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(sx, sz, bestTargetX, bestTargetZ));
  openSet.push({ x: sx, z: sz, f: fScore.get(startKey) });

  // Directions: 4-directional (simpler, cleaner paths)
  const dirs = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];

  while (openSet.length > 0) {
    // Find minimum f in open set (simple for 30x30)
    let minIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[minIdx].f) minIdx = i;
    }
    const current = openSet[minIdx];
    openSet.splice(minIdx, 1);

    const curKey = key(current.x, current.z);

    if (targetSet.has(curKey)) {
      // Reconstruct path
      const path = [];
      let ck = curKey;
      while (ck !== undefined) {
        const cx = (ck / GRID_SIZE) | 0;
        const cz = ck % GRID_SIZE;
        path.unshift({ x: cx, z: cz });
        ck = cameFrom.get(ck);
      }
      return path;
    }

    if (closedSet.has(curKey)) continue;
    closedSet.add(curKey);

    for (const dir of dirs) {
      const nx = current.x + dir.dx;
      const nz = current.z + dir.dz;

      if (!inBounds(nx, nz)) continue;

      const nKey = key(nx, nz);
      if (closedSet.has(nKey)) continue;

      const moveCost = getMoveCost(elevation, terrain, nx, nz);
      if (moveCost === COST_IMPASSABLE) continue;

      const tentativeG = (gScore.get(curKey) || 0) + moveCost;
      const currentG = gScore.get(nKey);

      if (currentG === undefined || tentativeG < currentG) {
        cameFrom.set(nKey, curKey);
        gScore.set(nKey, tentativeG);
        const f = tentativeG + heuristic(nx, nz, bestTargetX, bestTargetZ);
        fScore.set(nKey, f);
        openSet.push({ x: nx, z: nz, f });
      }
    }
  }

  return null; // No path found
}

// ═══════════════════════════════════════════════════════════════
//  12. BRIDGE PLACEMENT
// ═══════════════════════════════════════════════════════════════

function placeBridges(elevation, terrain, paths) {
  const bridgeCells = [];

  for (const path of paths) {
    for (const cell of path) {
      if (
        elevation[cell.x][cell.z] === ELEV_WATER &&
        terrain[cell.x][cell.z] !== "bridge"
      ) {
        terrain[cell.x][cell.z] = "bridge";
        bridgeCells.push({ x: cell.x, z: cell.z });
      }
    }
  }

  return bridgeCells;
}

// ═══════════════════════════════════════════════════════════════
//  13. PATH VALIDATION & CORRIDOR CARVING
// ═══════════════════════════════════════════════════════════════

function buildCastleTargetSet() {
  const targets = new Set();
  const key = (x, z) => x * GRID_SIZE + z;

  // Target = any cell adjacent to the castle compound
  const cx = CASTLE_CENTER;
  const cz = CASTLE_CENTER;

  for (let x = cx - COMPOUND_HALF - 1; x <= cx + COMPOUND_HALF; x++) {
    for (let z = cz - COMPOUND_HALF - 1; z <= cz + COMPOUND_HALF; z++) {
      if (!inBounds(x, z)) continue;
      if (isCastle(x, z)) continue;

      // Is adjacent to castle?
      let adj = false;
      for (const d of [
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
      ]) {
        const ax = x + d.dx;
        const az = z + d.dz;
        if (isCastle(ax, az)) {
          adj = true;
          break;
        }
      }
      if (adj) targets.add(key(x, z));
    }
  }

  return targets;
}

/**
 * Carve a straight corridor from (sx,sz) toward (tx,tz),
 * clearing water and mountains to ground level.
 */
function carveCorridor(elevation, terrain, sx, sz, tx, tz) {
  let cx = sx;
  let cz = sz;
  const maxSteps = GRID_SIZE * 2;

  for (let step = 0; step < maxSteps; step++) {
    if (cx === tx && cz === tz) break;

    // Clear current cell if blocked
    if (inBounds(cx, cz) && !isCastle(cx, cz)) {
      if (
        elevation[cx][cz] === ELEV_WATER ||
        elevation[cx][cz] === ELEV_MOUNTAIN
      ) {
        elevation[cx][cz] = ELEV_GROUND;
        terrain[cx][cz] = "ground";
      }
      // Also clear 1-wide neighbors for safety
      for (const d of [
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
      ]) {
        const nx = cx + d.dx;
        const nz = cz + d.dz;
        if (inBounds(nx, nz) && !isCastle(nx, nz)) {
          if (elevation[nx][nz] === ELEV_MOUNTAIN) {
            elevation[nx][nz] = ELEV_HIGH_HILL;
          }
        }
      }
    }

    // Step toward target
    const dx = tx - cx;
    const dz = tz - cz;

    if (Math.abs(dx) > Math.abs(dz)) {
      cx += Math.sign(dx);
    } else {
      cz += Math.sign(dz);
    }
  }
}

function validateAndFixPaths(elevation, terrain) {
  const targetSet = buildCastleTargetSet();
  const paths = [];
  const pathLengths = [];

  for (const spawn of SPAWN_OFFSETS) {
    // First attempt: normal A*
    let path = astar(elevation, terrain, spawn.x, spawn.z, targetSet);

    if (path === null) {
      // Carve corridor toward castle center then retry
      const approachX =
        spawn.x < GRID_SIZE / 2
          ? CASTLE_CENTER - COMPOUND_HALF - 1
          : CASTLE_CENTER + COMPOUND_HALF;
      const approachZ =
        spawn.z < GRID_SIZE / 2
          ? CASTLE_CENTER - COMPOUND_HALF - 1
          : CASTLE_CENTER + COMPOUND_HALF;

      carveCorridor(elevation, terrain, spawn.x, spawn.z, approachX, approachZ);
      path = astar(elevation, terrain, spawn.x, spawn.z, targetSet);
    }

    if (path === null) {
      // Nuclear option: clear a straight line
      carveCorridor(
        elevation,
        terrain,
        spawn.x,
        spawn.z,
        CASTLE_CENTER,
        CASTLE_CENTER,
      );
      path = astar(elevation, terrain, spawn.x, spawn.z, targetSet);
    }

    paths.push(path || [{ x: spawn.x, z: spawn.z }]);
    pathLengths.push(path ? path.length : Infinity);
  }

  // Path balance check: if any path is 3x longer than shortest, shorten it
  const minLen = Math.min(...pathLengths.filter((l) => l < Infinity));
  if (minLen > 0) {
    for (let i = 0; i < paths.length; i++) {
      if (pathLengths[i] > minLen * 3) {
        const spawn = SPAWN_OFFSETS[i];
        // Carve a more direct route
        carveCorridor(
          elevation,
          terrain,
          spawn.x,
          spawn.z,
          CASTLE_CENTER,
          CASTLE_CENTER,
        );
        const newPath = astar(elevation, terrain, spawn.x, spawn.z, targetSet);
        if (newPath !== null && newPath.length < pathLengths[i]) {
          paths[i] = newPath;
        }
      }
    }
  }

  return paths;
}

// ═══════════════════════════════════════════════════════════════
//  14. TERRAIN TYPE ASSIGNMENT
// ═══════════════════════════════════════════════════════════════

function assignTerrainTypes(elevation) {
  const terrain = createGrid("ground");

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const elev = elevation[x][z];

      if (isCastle(x, z)) {
        terrain[x][z] = "castle";
      } else if (elev === ELEV_WATER) {
        terrain[x][z] = "water";
      } else if (elev === ELEV_MOUNTAIN) {
        terrain[x][z] = "mountain";
      } else if (elev === ELEV_HIGH_HILL || elev === ELEV_LOW_HILL) {
        terrain[x][z] = "hill";
      } else {
        terrain[x][z] = "ground";
      }
    }
  }

  return terrain;
}

// ═══════════════════════════════════════════════════════════════
//  15. COLOR MAP
// ═══════════════════════════════════════════════════════════════

function getTerrainColor(terrain, elevation, x, z, biome) {
  const terr = terrain[x][z];
  const elev = elevation[x][z];

  switch (terr) {
    case "castle":
      return "#8a8a8a";
    case "water":
      return biome.waterColor;
    case "mountain":
      return biome.mountainColor;
    case "hill":
      return elev === ELEV_HIGH_HILL ? biome.hillColor : biome.groundColor;
    case "forest":
      return biome.forestColor;
    case "swamp":
      return biome.swampColor;
    case "bridge":
      return biome.bridgeColor;
    case "ground":
    default:
      return biome.groundColor;
  }
}

// ═══════════════════════════════════════════════════════════════
//  16. MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a complete terrain map.
 *
 * @param {number|string} [seed]  Reproducible seed (number or string). Random if omitted.
 * @param {string} [biomeName]    Biome key from BIOMES. Random if omitted.
 * @param {number} [maxRetries=5] Maximum attempts to generate a valid map.
 * @returns {{
 *   seed: number,
 *   elevation: number[][],
 *   terrain: string[][],
 *   colors: string[][],
 *   paths: {x:number, z:number}[][],
 *   spawnPoints: {x:number, z:number}[],
 *   castleArea: {x:number, z:number, w:number, h:number},
 *   keepArea: {x:number, z:number, w:number, h:number},
 *   biomeData: object,
 *   biomeName: string,
 *   gridSize: number,
 *   cellSize: number,
 *   forestCells: {x:number, z:number}[],
 *   riverCells: {x:number, z:number}[],
 *   bridgeCells: {x:number, z:number}[],
 *   valid: boolean,
 * }}
 */
export function generateTerrain(seed, biomeName, maxRetries = 5) {
  const numericSeed = toNumericSeed(seed);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentSeed = numericSeed + attempt;
    const rng = mulberry32(currentSeed);
    const noise = createNoise2D(rng);

    // Pick biome
    const resolvedBiomeName =
      biomeName && BIOMES[biomeName]
        ? biomeName
        : BIOME_KEYS[(rng() * BIOME_KEYS.length) | 0];
    const biome = BIOMES[resolvedBiomeName];

    // Step 1: Generate elevation
    const { elevation } = generateElevation(noise, biome, rng);

    // Step 2: Assign base terrain types
    const terrain = assignTerrainTypes(elevation);

    // Step 3: Carve river
    const riverCells = carveRiver(elevation, rng, biome);
    // Update terrain for new water cells
    for (const rc of riverCells) {
      if (terrain[rc.x][rc.z] !== "castle") {
        terrain[rc.x][rc.z] = "water";
      }
    }

    // Step 4: Place forests
    const forestCells = placeForests(elevation, terrain, rng, biome);

    // Step 5: Place swamps
    placeSwamps(elevation, terrain, noise, biome, rng);

    // Step 6: Validate paths & fix if needed (also places bridges on water crossings)
    const paths = validateAndFixPaths(elevation, terrain);

    // Step 7: Place bridges where paths cross water
    const bridgeCells = placeBridges(elevation, terrain, paths);

    // Step 8: Re-validate after bridges (should always succeed now)
    const allValid = paths.every((p) => p.length > 1);

    if (!allValid && attempt < maxRetries - 1) {
      continue; // Retry with different seed offset
    }

    // Step 9: Generate color map
    const colors = createGrid("#000000");
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        colors[x][z] = getTerrainColor(terrain, elevation, x, z, biome);
      }
    }

    return Object.freeze({
      seed: currentSeed,
      elevation,
      terrain,
      colors,
      paths,
      spawnPoints: SPAWN_OFFSETS.map((sp) => ({ x: sp.x, z: sp.z })),
      castleArea: {
        x: CASTLE_CENTER - COMPOUND_HALF,
        z: CASTLE_CENTER - COMPOUND_HALF,
        w: COMPOUND_HALF * 2,
        h: COMPOUND_HALF * 2,
      },
      keepArea: {
        x: CASTLE_CENTER - KEEP_HALF,
        z: CASTLE_CENTER - KEEP_HALF,
        w: KEEP_HALF * 2,
        h: KEEP_HALF * 2,
      },
      biomeData: biome,
      biomeName: resolvedBiomeName,
      gridSize: GRID_SIZE,
      cellSize: CELL_SIZE,
      forestCells,
      riverCells,
      bridgeCells,
      valid: allValid,
    });
  }

  // Should never reach here, but return a minimal map if all retries fail
  throw new Error(
    `Failed to generate valid terrain after ${maxRetries} attempts (seed: ${numericSeed})`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  17. GAMEPLAY QUERY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Find a path from (sx,sz) to the castle using A* on the terrain map.
 * Respects elevation, water, mountains, and terrain movement costs.
 * Optional blockedSet: Set of grid keys (x*30+z) to treat as impassable (e.g. player buildings).
 * Returns array of {x, z} or null if no path.
 */
export function findPath(map, sx, sz, blockedSet) {
  const targetSet = buildCastleTargetSet();

  if (blockedSet && blockedSet.size > 0) {
    // Wrap the terrain to also block player-placed buildings
    const origTerrain = map.terrain;
    const wrappedTerrain = origTerrain.map((row) => [...row]);
    for (const bk of blockedSet) {
      const bx = (bk / GRID_SIZE) | 0;
      const bz = bk % GRID_SIZE;
      if (inBounds(bx, bz)) wrappedTerrain[bx][bz] = "mountain"; // treat as impassable
    }
    return astar(map.elevation, wrappedTerrain, sx, sz, targetSet);
  }

  return astar(map.elevation, map.terrain, sx, sz, targetSet);
}

/**
 * Can a tower be placed on this cell?
 * Towers can be placed on ground, hills. NOT on water, mountain, forest, castle, bridge.
 */
export function canPlaceTower(map, x, z) {
  if (!inBounds(x, z)) return false;
  if (isCastle(x, z)) return false;

  const terr = map.terrain[x][z];
  return terr === "ground" || terr === "hill";
}

/**
 * Can an enemy walk on this cell?
 * Enemies walk on ground, hills, swamp, forest, bridge. NOT water, mountain.
 */
export function canEnemyWalk(map, x, z) {
  if (!inBounds(x, z)) return false;

  const terr = map.terrain[x][z];
  return (
    terr === "ground" ||
    terr === "hill" ||
    terr === "swamp" ||
    terr === "forest" ||
    terr === "bridge" ||
    terr === "castle"
  );
}

/**
 * Get the movement cost for enemies at this cell.
 */
export function getEnemyMoveCost(map, x, z) {
  return getMoveCost(map.elevation, map.terrain, x, z);
}

/**
 * Get tower range bonus from elevation.
 * Towers on hills get +1 or +2 range.
 */
export function getElevationRangeBonus(map, x, z) {
  if (!inBounds(x, z)) return 0;
  const elev = map.elevation[x][z];
  if (elev === ELEV_LOW_HILL) return 1;
  if (elev === ELEV_HIGH_HILL) return 2;
  return 0;
}

/**
 * Get the speed multiplier for enemies at this cell.
 * Swamp: 0.5x speed, hills: 0.8x uphill, forest: 0.9x.
 */
export function getEnemySpeedMultiplier(map, x, z) {
  if (!inBounds(x, z)) return 1.0;

  const terr = map.terrain[x][z];
  const elev = map.elevation[x][z];

  if (terr === "swamp") return 0.5;
  if (terr === "forest") return 0.9;
  if (elev === ELEV_LOW_HILL) return 0.85;
  if (elev === ELEV_HIGH_HILL) return 0.7;
  return 1.0;
}

/**
 * Can a forest be cleared at this cell? Returns clearing cost or 0.
 */
export function getForestClearCost(map, x, z) {
  if (!inBounds(x, z)) return 0;
  if (map.terrain[x][z] !== "forest") return 0;
  return 25; // Gold cost to clear a forest tile
}

/**
 * Clear a forest cell, returning a new map with the cell converted to ground.
 * Immutable: returns a new map object.
 */
export function clearForest(map, x, z) {
  if (map.terrain[x][z] !== "forest") return map;

  const newTerrain = map.terrain.map((row) => [...row]);
  const newColors = map.colors.map((row) => [...row]);

  newTerrain[x][z] = "ground";
  newColors[x][z] = map.biomeData.groundColor;

  const newForestCells = map.forestCells.filter((c) => c.x !== x || c.z !== z);

  return Object.freeze({
    ...map,
    terrain: newTerrain,
    colors: newColors,
    forestCells: newForestCells,
  });
}

/**
 * Convert grid coords to world position.
 */
export function gridToWorld(x, z) {
  return {
    x: (x - GRID_SIZE / 2) * CELL_SIZE + CELL_SIZE / 2,
    z: (z - GRID_SIZE / 2) * CELL_SIZE + CELL_SIZE / 2,
  };
}

/**
 * Convert world position to grid coords.
 */
export function worldToGrid(wx, wz) {
  return {
    x: Math.floor(wx / CELL_SIZE + GRID_SIZE / 2),
    z: Math.floor(wz / CELL_SIZE + GRID_SIZE / 2),
  };
}

/**
 * Get the world-space Y height for a given elevation level.
 */
export function getWorldHeight(elevationLevel) {
  switch (elevationLevel) {
    case ELEV_WATER:
      return -0.5;
    case ELEV_GROUND:
      return 0;
    case ELEV_LOW_HILL:
      return 1.0;
    case ELEV_HIGH_HILL:
      return 2.0;
    case ELEV_MOUNTAIN:
      return 3.0;
    default:
      return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
//  18. DEBUG / VISUALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Render the terrain map to a 2D canvas context for debugging / minimap.
 */
export function renderToCanvas(ctx, map, cellPx = 8) {
  const { terrain, colors, elevation, paths, gridSize } = map;

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      ctx.fillStyle = colors[x][z];
      ctx.fillRect(x * cellPx, z * cellPx, cellPx, cellPx);

      // Draw grid lines
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.strokeRect(x * cellPx, z * cellPx, cellPx, cellPx);
    }
  }

  // Draw paths
  ctx.lineWidth = 2;
  const pathColors = ["#ff4444", "#44ff44", "#4444ff", "#ffff44"];
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    if (path.length < 2) continue;

    ctx.strokeStyle = pathColors[i % pathColors.length];
    ctx.beginPath();
    ctx.moveTo(
      path[0].x * cellPx + cellPx / 2,
      path[0].z * cellPx + cellPx / 2,
    );
    for (let j = 1; j < path.length; j++) {
      ctx.lineTo(
        path[j].x * cellPx + cellPx / 2,
        path[j].z * cellPx + cellPx / 2,
      );
    }
    ctx.stroke();
  }

  // Draw spawn points
  ctx.fillStyle = "#ff0000";
  for (const sp of map.spawnPoints) {
    ctx.beginPath();
    ctx.arc(
      sp.x * cellPx + cellPx / 2,
      sp.z * cellPx + cellPx / 2,
      cellPx / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Draw castle
  const ca = map.castleArea;
  ctx.strokeStyle = "#ffcc00";
  ctx.lineWidth = 2;
  ctx.strokeRect(ca.x * cellPx, ca.z * cellPx, ca.w * cellPx, ca.h * cellPx);

  const ka = map.keepArea;
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(ka.x * cellPx, ka.z * cellPx, ka.w * cellPx, ka.h * cellPx);
}
