import FastNoiseLite from "fastnoise-lite";
import fs from "fs";

const W = 32,
  H = 28,
  D = 32,
  seed = 42;
const noise = new FastNoiseLite(seed);
noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
noise.SetFrequency(0.05);

// First pass: compute heightmap
const heightmap = [];
for (let x = 0; x < W; x++) {
  heightmap[x] = [];
  for (let z = 0; z < D; z++) {
    const n = noise.GetNoise(x, z) * 0.5 + 0.5;
    heightmap[x][z] = Math.floor(n * 14) + 1;
  }
}

// Find the deepest valley (low interior region surrounded by higher terrain)
let bestX = 0,
  bestZ = 0,
  bestScore = -99;
const margin = 8; // avoid edges so castle is deep in the valley
for (let x = margin; x < W - 8 - margin; x++)
  for (let z = margin; z < D - 8 - margin; z++) {
    // Average height inside the 8x8 region
    let sumInner = 0;
    for (let dx = 0; dx < 8; dx++)
      for (let dz = 0; dz < 8; dz++) sumInner += heightmap[x + dx][z + dz];
    const avgInner = sumInner / 64;
    // Average height of surrounding ring (3 voxels out)
    let sumOuter = 0,
      countOuter = 0;
    for (let dx = -3; dx < 11; dx++)
      for (let dz = -3; dz < 11; dz++) {
        if (dx >= 0 && dx < 8 && dz >= 0 && dz < 8) continue;
        const px = x + dx,
          pz = z + dz;
        if (px >= 0 && px < W && pz >= 0 && pz < D) {
          sumOuter += heightmap[px][pz];
          countOuter++;
        }
      }
    const avgOuter = sumOuter / countOuter;
    // Score = how much higher surroundings are vs interior (= valley depth)
    const score = avgOuter - avgInner;
    if (score > bestScore) {
      bestScore = score;
      bestX = x;
      bestZ = z;
    }
  }
const bestMinH = (() => {
  let m = 99;
  for (let dx = 0; dx < 8; dx++)
    for (let dz = 0; dz < 8; dz++)
      m = Math.min(m, heightmap[bestX + dx][bestZ + dz]);
  return m;
})();

console.error(
  `Best castle location: x=${bestX}, z=${bestZ}, min terrain height=${bestMinH}`,
);

const lines = [`V ${W} ${H} ${D}`, "-- Terrain + Castle (valley, carved)"];

const cx = bestX,
  cz = bestZ;
const base = bestMinH;
const moatR = 2; // clearing radius around castle

// Generate terrain — but carve out castle interior + moat zone
for (let x = 0; x < W; x++)
  for (let z = 0; z < D; z++) {
    const height = heightmap[x][z];
    // Check if inside castle footprint
    const inCastle = x >= cx && x < cx + 8 && z >= cz && z < cz + 8;
    // Check if in moat/clearing zone (ring around castle)
    const inMoat =
      x >= cx - moatR &&
      x < cx + 8 + moatR &&
      z >= cz - moatR &&
      z < cz + 8 + moatR &&
      !inCastle;
    for (let y = 0; y < height && y < H; y++) {
      // Carve: skip terrain above base inside castle & moat zones
      if (inCastle && y >= base) continue;
      if (inMoat && y >= base) continue;
      let c;
      if (y === height - 1) c = 2;
      else if (y > height - 3) c = "a";
      else c = 9;
      lines.push(`P ${x} ${y} ${z} ${c}`);
    }
    // Water moat at base level
    if (inMoat) {
      lines.push(`P ${x} ${base} ${z} 3`); // blue water
    }
  }

// Castle floor (tan)
for (let x = cx; x < cx + 8; x++)
  for (let z = cz; z < cz + 8; z++) {
    const terrainH = heightmap[x][z];
    for (let y = terrainH; y <= base; y++) lines.push(`P ${x} ${y} ${z} 9`);
    lines.push(`P ${x} ${base} ${z} d`);
  }

// Walls (tan, height 5)
for (let i = 0; i < 8; i++) {
  for (let h = 1; h <= 5; h++) {
    lines.push(`P ${cx + i} ${base + h} ${cz} d`);
    lines.push(`P ${cx + i} ${base + h} ${cz + 7} d`);
    lines.push(`P ${cx} ${base + h} ${cz + i} d`);
    lines.push(`P ${cx + 7} ${base + h} ${cz + i} d`);
  }
}

// Battlements (tan)
for (let i = 0; i < 8; i++) {
  if (i % 2 === 0) {
    lines.push(`P ${cx + i} ${base + 6} ${cz} d`);
    lines.push(`P ${cx + i} ${base + 6} ${cz + 7} d`);
    lines.push(`P ${cx} ${base + 6} ${cz + i} d`);
    lines.push(`P ${cx + 7} ${base + 6} ${cz + i} d`);
  }
}

// Corner towers (3x3, taller, gray stone)
for (const [tx, tz] of [
  [cx, cz],
  [cx + 7, cz],
  [cx, cz + 7],
  [cx + 7, cz + 7],
]) {
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      if (tx + dx < 0 || tx + dx >= W || tz + dz < 0 || tz + dz >= D) continue;
      for (let h = 1; h <= 8; h++)
        lines.push(`P ${tx + dx} ${base + h} ${tz + dz} 9`);
      // Cone top (red)
      lines.push(`P ${tx + dx} ${base + 9} ${tz + dz} 1`);
    }
  // Tower peak
  lines.push(`P ${tx} ${base + 10} ${tz} 1`);
}

// Gate (opening in front wall)
for (let h = 1; h <= 3; h++) {
  lines.push(`P ${cx + 3} ${base + h} ${cz} 0`);
  lines.push(`P ${cx + 4} ${base + h} ${cz} 0`);
}
// Bridge over moat at gate
for (let dz = -moatR; dz < 0; dz++) {
  lines.push(`P ${cx + 3} ${base} ${cz + dz} d`);
  lines.push(`P ${cx + 4} ${base} ${cz + dz} d`);
}

// Flag
lines.push(`P ${cx + 7} ${base + 11} ${cz + 7} 0`);
lines.push(`P ${cx + 7} ${base + 12} ${cz + 7} 1`);
lines.push(`P ${cx + 8} ${base + 12} ${cz + 7} 6`);
lines.push(`P ${cx + 8} ${base + 11} ${cz + 7} 6`);

fs.writeFileSync("voxi-reasoning/castle-terrain.voxi", lines.join("\n"));
console.log(lines.length + " lines");
