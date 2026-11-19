#!/usr/bin/env node
// voxelize.mjs — Convert STL/OBJ mesh → V4 voxel code
// Usage: node voxelize.mjs model.stl [resolution] [output.v4]
//   resolution: grid size (default 32)

import fs from "fs";
import path from "path";

const modelFile = process.argv[2];
const resolution = parseInt(process.argv[3] || "32", 10);
const outFile = process.argv[4] || modelFile?.replace(/\.\w+$/, "") + `.v4`;

if (!modelFile) {
  console.error("Usage: node voxelize.mjs <model.stl|.obj> [resolution] [output.v4]");
  process.exit(1);
}

// --- Parse STL (binary format) ---
function parseSTLBinary(buffer) {
  const triangles = [];
  const dv = new DataView(buffer.buffer, buffer.byteOffset);
  const numTriangles = dv.getUint32(80, true);
  console.log(`Triangles: ${numTriangles}`);

  let offset = 84;
  for (let i = 0; i < numTriangles; i++) {
    // Skip normal (12 bytes)
    offset += 12;
    const v1 = [dv.getFloat32(offset, true), dv.getFloat32(offset + 4, true), dv.getFloat32(offset + 8, true)];
    offset += 12;
    const v2 = [dv.getFloat32(offset, true), dv.getFloat32(offset + 4, true), dv.getFloat32(offset + 8, true)];
    offset += 12;
    const v3 = [dv.getFloat32(offset, true), dv.getFloat32(offset + 4, true), dv.getFloat32(offset + 8, true)];
    offset += 12;
    offset += 2; // attribute byte count
    triangles.push([v1, v2, v3]);
  }
  return triangles;
}

// --- Parse STL (ASCII format) ---
function parseSTLAscii(text) {
  const triangles = [];
  const vertexRegex = /vertex\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/gi;
  let match;
  const verts = [];
  while ((match = vertexRegex.exec(text))) {
    verts.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
    if (verts.length === 3) {
      triangles.push([verts.shift(), verts.shift(), verts.shift()]);
    }
  }
  return triangles;
}

// --- Parse OBJ ---
function parseOBJ(text) {
  const vertices = [];
  const triangles = [];
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "v") {
      vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === "f") {
      const indices = parts.slice(1).map(p => parseInt(p.split("/")[0], 10) - 1);
      // Triangulate face (fan)
      for (let i = 1; i < indices.length - 1; i++) {
        triangles.push([vertices[indices[0]], vertices[indices[i]], vertices[indices[i + 1]]]);
      }
    }
  }
  return triangles;
}

// --- Load model ---
const ext = path.extname(modelFile).toLowerCase();
const raw = fs.readFileSync(modelFile);
let triangles;

if (ext === ".obj") {
  triangles = parseOBJ(raw.toString("utf-8"));
} else {
  // STL — detect binary vs ASCII
  const header = raw.toString("utf-8", 0, 80);
  if (header.startsWith("solid") && raw.toString("utf-8", 0, 200).includes("facet")) {
    triangles = parseSTLAscii(raw.toString("utf-8"));
  } else {
    triangles = parseSTLBinary(raw);
  }
}

console.log(`Loaded: ${triangles.length} triangles`);

// --- Compute bounding box ---
let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

for (const tri of triangles) {
  for (const v of tri) {
    minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
  }
}

const sizeX = maxX - minX, sizeY = maxY - minY, sizeZ = maxZ - minZ;
const maxDim = Math.max(sizeX, sizeY, sizeZ);
const scale = (resolution - 2) / maxDim; // leave 1 voxel margin
const margin = 1;

console.log(`Bounds: [${minX.toFixed(2)}, ${minY.toFixed(2)}, ${minZ.toFixed(2)}] → [${maxX.toFixed(2)}, ${maxY.toFixed(2)}, ${maxZ.toFixed(2)}]`);
console.log(`Scale: ${scale.toFixed(4)}, Grid: ${resolution}³`);

// --- Transform vertices to grid space ---
// Swap Y/Z: --swap flag or auto-detect
const forceSwap = process.argv.includes("--swap");
const swapYZ = forceSwap;
if (swapYZ) console.log("Swapping Y/Z axes");

function toGrid(v) {
  const gx = Math.round((v[0] - minX) * scale + margin);
  const gy = swapYZ
    ? Math.round((v[2] - minZ) * scale + margin)
    : Math.round((v[1] - minY) * scale + margin);
  const gz = swapYZ
    ? Math.round((v[1] - minY) * scale + margin)
    : Math.round((v[2] - minZ) * scale + margin);
  return [gx, gy, gz];
}

// --- Voxelize: rasterize triangles ---
// For each triangle, fill all voxels along its surface
const voxels = new Set();

function addLine(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz), 1);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = Math.round(a[0] + dx * t);
    const y = Math.round(a[1] + dy * t);
    const z = Math.round(a[2] + dz * t);
    if (x >= 0 && x < resolution && y >= 0 && y < resolution && z >= 0 && z < resolution) {
      voxels.add(`${x},${y},${z}`);
    }
  }
}

function rasterizeTriangle(v1, v2, v3) {
  const g1 = toGrid(v1), g2 = toGrid(v2), g3 = toGrid(v3);

  // Edges
  addLine(g1, g2);
  addLine(g2, g3);
  addLine(g3, g1);

  // Fill interior: scan along two edges
  const longest = Math.max(
    Math.hypot(g2[0]-g1[0], g2[1]-g1[1], g2[2]-g1[2]),
    Math.hypot(g3[0]-g2[0], g3[1]-g2[1], g3[2]-g2[2]),
    Math.hypot(g1[0]-g3[0], g1[1]-g3[1], g1[2]-g3[2]),
  );
  const steps = Math.max(Math.ceil(longest), 1);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    // Point on edge v1→v2
    const a = [g1[0] + (g2[0]-g1[0])*t, g1[1] + (g2[1]-g1[1])*t, g1[2] + (g2[2]-g1[2])*t];
    // Point on edge v1→v3
    const b = [g1[0] + (g3[0]-g1[0])*t, g1[1] + (g3[1]-g1[1])*t, g1[2] + (g3[2]-g1[2])*t];
    addLine(a.map(Math.round), b.map(Math.round));
  }
}

console.log("Voxelizing...");
for (const tri of triangles) {
  rasterizeTriangle(tri[0], tri[1], tri[2]);
}

console.log(`Surface voxels: ${voxels.size}`);

// --- Flood fill interior ---
// Create 3D grid
const grid = new Uint8Array(resolution * resolution * resolution);
const idx = (x, y, z) => x + y * resolution + z * resolution * resolution;

// Mark surface voxels
for (const key of voxels) {
  const [x, y, z] = key.split(",").map(Number);
  grid[idx(x, y, z)] = 1; // surface
}

// Flood fill from outside (mark exterior as 2)
const queue = [[0, 0, 0]];
grid[0] = 2;
const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

while (queue.length > 0) {
  const [cx, cy, cz] = queue.pop();
  for (const [dx, dy, dz] of dirs) {
    const nx = cx + dx, ny = cy + dy, nz = cz + dz;
    if (nx >= 0 && nx < resolution && ny >= 0 && ny < resolution && nz >= 0 && nz < resolution) {
      const i = idx(nx, ny, nz);
      if (grid[i] === 0) { // empty, not surface
        grid[i] = 2; // mark exterior
        queue.push([nx, ny, nz]);
      }
    }
  }
}

// Everything that's not exterior (2) and not already surface (1) is interior
let interiorCount = 0;
for (let x = 0; x < resolution; x++)
  for (let y = 0; y < resolution; y++)
    for (let z = 0; z < resolution; z++) {
      const i = idx(x, y, z);
      if (grid[i] === 0) { // unreached by flood = interior
        grid[i] = 1;
        voxels.add(`${x},${y},${z}`);
        interiorCount++;
      }
    }

console.log(`Interior voxels filled: ${interiorCount}`);
console.log(`Total voxels: ${voxels.size}`);

// --- Compress: merge voxels into boxes ---
// Step 1: Build 3D boolean grid
const filled = new Uint8Array(resolution * resolution * resolution);
const used = new Uint8Array(resolution * resolution * resolution);
for (const key of voxels) {
  const [x, y, z] = key.split(",").map(Number);
  filled[idx(x, y, z)] = 1;
}

const isFilled = (x, y, z) => x >= 0 && x < resolution && y >= 0 && y < resolution && z >= 0 && z < resolution && filled[idx(x, y, z)] && !used[idx(x, y, z)];

// Step 2: Greedy box merging — scan for largest boxes
const boxes = [];

// Try to grow a box starting at (sx, sy, sz)
function findBox(sx, sy, sz) {
  // Extend along X
  let ex = sx;
  while (ex + 1 < resolution && isFilled(ex + 1, sy, sz)) ex++;

  // Extend along Z (keeping full X run)
  let ez = sz;
  outer_z: while (ez + 1 < resolution) {
    for (let x = sx; x <= ex; x++) {
      if (!isFilled(x, sy, ez + 1)) break outer_z;
    }
    ez++;
  }

  // Extend along Y (keeping full XZ slab)
  let ey = sy;
  outer_y: while (ey + 1 < resolution) {
    for (let x = sx; x <= ex; x++) {
      for (let z = sz; z <= ez; z++) {
        if (!isFilled(x, ey + 1, z)) break outer_y;
      }
    }
    ey++;
  }

  return { x: sx, y: sy, z: sz, w: ex - sx + 1, h: ey - sy + 1, d: ez - sz + 1 };
}

// Scan grid and greedily extract boxes
for (let y = 0; y < resolution; y++) {
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      if (!isFilled(x, y, z)) continue;
      const box = findBox(x, y, z);
      // Mark voxels as used
      for (let bx = box.x; bx < box.x + box.w; bx++)
        for (let by = box.y; by < box.y + box.h; by++)
          for (let bz = box.z; bz < box.z + box.d; bz++)
            used[idx(bx, by, bz)] = 1;
      boxes.push(box);
    }
  }
}

console.log(`Compressed: ${voxels.size} voxels → ${boxes.length} boxes`);

// --- Output V4 code ---
const lines = [`-- ${path.basename(modelFile)} voxelized at ${resolution}³ (${boxes.length} boxes from ${voxels.size} voxels)`, `V ${resolution} ${resolution} ${resolution}`];

for (const b of boxes) {
  lines.push(`B ${b.x} ${b.y} ${b.z} ${b.w} ${b.h} ${b.d} 9`);
}

fs.writeFileSync(outFile, lines.join("\n"));
console.log(`Output: ${outFile} (${lines.length} lines)`);
console.log(`Compression: ${((1 - boxes.length / voxels.size) * 100).toFixed(0)}% reduction`);
