/**
 * lod-core.js — Scene composition, downsampling, edit application.
 *
 * Pure data library: no I/O, no LLM calls, no side effects.
 * All functions return NEW objects (immutable pattern).
 *
 * Usage:
 *   import { createScene, addObject, downsample, applyEdits, toVoxiCode } from './lod-core.js';
 */

import { parseVoxi } from "./text-view.js";

// ── Parse VOXI code into a voxel map ────────────────────────────────

/**
 * Parse VOXI source into a simple voxel map.
 * @param {string} code - VOXI source code
 * @returns {{ W: number, H: number, D: number, voxels: Map<string, number> }}
 */
export function parseToVoxelMap(code) {
  const { W, H, D, vm } = parseVoxi(code);
  return { W, H, D, voxels: vm };
}

// ── Scene creation and composition ──────────────────────────────────

/**
 * Create an empty scene.
 * @param {number} W - width (X)
 * @param {number} H - height (Y)
 * @param {number} D - depth (Z)
 * @returns {Scene}
 */
export function createScene(W, H, D) {
  return {
    W,
    H,
    D,
    grid: new Int8Array(W * H * D).fill(-1),
    objects: [],
  };
}

/**
 * Add an object to the scene by stamping its voxels at the given origin.
 * @param {Scene} scene
 * @param {string} name - unique object name
 * @param {{ W: number, H: number, D: number, voxels: Map<string, number> }} voxelMap
 * @param {number[]} origin - [ox, oy, oz] placement offset
 * @param {string} colorHint - human-readable color description
 * @returns {Scene} new scene with object added
 */
export function addObject(scene, name, voxelMap, origin, colorHint) {
  const [ox, oy, oz] = origin;
  const localVoxels = new Map();

  for (const [key, color] of voxelMap.voxels) {
    const [lx, ly, lz] = key.split(",").map(Number);
    localVoxels.set(`${lx},${ly},${lz}`, color);
  }

  const newObj = {
    name,
    origin: [ox, oy, oz],
    bounds: [voxelMap.W, voxelMap.H, voxelMap.D],
    colorHint,
    localVoxels,
  };

  const newScene = {
    ...scene,
    grid: new Int8Array(scene.grid),
    objects: [...scene.objects, newObj],
  };

  return rebuildGrid(newScene);
}

// ── Grid rebuild ────────────────────────────────────────────────────

/**
 * Clear the grid and re-stamp all objects from their registry data.
 * @param {Scene} scene
 * @returns {Scene} new scene with rebuilt grid
 */
export function rebuildGrid(scene) {
  const { W, H, D, objects } = scene;
  const grid = new Int8Array(W * H * D).fill(-1);
  const idx = (x, y, z) => x + y * W + z * W * H;

  for (const obj of objects) {
    const [ox, oy, oz] = obj.origin;
    for (const [key, color] of obj.localVoxels) {
      const [lx, ly, lz] = key.split(",").map(Number);
      const gx = ox + lx;
      const gy = oy + ly;
      const gz = oz + lz;
      if (gx >= 0 && gx < W && gy >= 0 && gy < H && gz >= 0 && gz < D) {
        grid[idx(gx, gy, gz)] = color;
      }
    }
  }

  return { ...scene, grid };
}

// ── Downsampling ────────────────────────────────────────────────────

/**
 * Downsample a scene by the given factor using majority-vote color.
 * A low-res cell is occupied if >25% of the high-res block is filled.
 *
 * @param {Scene} scene
 * @param {number} factor - downsample factor (e.g. 4 means 4x4x4 -> 1x1x1)
 * @returns {{ W: number, H: number, D: number, voxels: Map<string, number> }}
 */
export function downsample(scene, factor) {
  const { W, H, D, grid } = scene;
  const idx = (x, y, z) => x + y * W + z * W * H;

  const lowW = Math.ceil(W / factor);
  const lowH = Math.ceil(H / factor);
  const lowD = Math.ceil(D / factor);
  const voxels = new Map();
  const threshold = factor * factor * factor * 0.25;

  for (let lz = 0; lz < lowD; lz++) {
    for (let ly = 0; ly < lowH; ly++) {
      for (let lx = 0; lx < lowW; lx++) {
        const colorCounts = new Map();
        let filled = 0;

        for (let dz = 0; dz < factor; dz++) {
          for (let dy = 0; dy < factor; dy++) {
            for (let dx = 0; dx < factor; dx++) {
              const hx = lx * factor + dx;
              const hy = ly * factor + dy;
              const hz = lz * factor + dz;
              if (hx < W && hy < H && hz < D) {
                const c = grid[idx(hx, hy, hz)];
                if (c >= 0) {
                  filled++;
                  colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
                }
              }
            }
          }
        }

        if (filled >= threshold) {
          // Majority vote
          let bestColor = 9;
          let bestCount = 0;
          for (const [color, count] of colorCounts) {
            if (count > bestCount) {
              bestCount = count;
              bestColor = color;
            }
          }
          voxels.set(`${lx},${ly},${lz}`, bestColor);
        }
      }
    }
  }

  return { W: lowW, H: lowH, D: lowD, voxels };
}

// ── VOXI code generation (greedy box compression) ───────────────────

const COLOR_CODES = "0123456789abcdef";

/**
 * Convert a voxel map to VOXI source code with greedy box compression.
 * @param {number} W
 * @param {number} H
 * @param {number} D
 * @param {Map<string, number>} voxels - "x,y,z" -> colorInt
 * @param {string} [comment] - optional header comment
 * @returns {string} VOXI source code
 */
export function toVoxiCode(W, H, D, voxels, comment) {
  const lines = [`V ${W} ${H} ${D}`];
  if (comment) lines.push(`-- ${comment}`);
  lines.push("");

  // Build 3D boolean+color grid for greedy merge
  const used = new Set();
  const get = (x, y, z) => voxels.get(`${x},${y},${z}`);
  const has = (x, y, z) =>
    voxels.has(`${x},${y},${z}`) && !used.has(`${x},${y},${z}`);

  // Greedy: for each unfilled voxel, expand box in X, then Z, then Y
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (!has(x, y, z)) continue;
        const c = get(x, y, z);

        // Expand in X
        let ex = x + 1;
        while (ex < W && has(ex, y, z) && get(ex, y, z) === c) ex++;
        const bw = ex - x;

        // Expand in Z
        let ez = z + 1;
        outer_z: while (ez < D) {
          for (let ix = x; ix < x + bw; ix++) {
            if (!has(ix, y, ez) || get(ix, y, ez) !== c) break outer_z;
          }
          ez++;
        }
        const bd = ez - z;

        // Expand in Y
        let ey = y + 1;
        outer_y: while (ey < H) {
          for (let iz = z; iz < z + bd; iz++) {
            for (let ix = x; ix < x + bw; ix++) {
              if (!has(ix, ey, iz) || get(ix, ey, iz) !== c) break outer_y;
            }
          }
          ey++;
        }
        const bh = ey - y;

        // Mark used
        for (let iy = y; iy < y + bh; iy++) {
          for (let iz = z; iz < z + bd; iz++) {
            for (let ix = x; ix < x + bw; ix++) {
              used.add(`${ix},${iy},${iz}`);
            }
          }
        }

        const colorCode = COLOR_CODES[c] || c;
        if (bw === 1 && bh === 1 && bd === 1) {
          lines.push(`P ${x} ${y} ${z} ${colorCode}`);
        } else {
          lines.push(`B ${x} ${y} ${z} ${bw} ${bh} ${bd} ${colorCode}`);
        }
      }
    }
  }

  return lines.join("\n");
}

// ── Edit application ────────────────────────────────────────────────

/**
 * Apply a single edit to the scene.
 * Supported actions: MOVE, ROTATE_Y90, DELETE, RECOLOR, STAMP
 *
 * @param {Scene} scene
 * @param {Object} edit - { action, object, ...params }
 * @returns {Scene} new scene with edit applied
 */
export function applyEdit(scene, edit) {
  const action = edit.action.toUpperCase();

  // STAMP creates a new object from inline VOXI code — doesn't need existing object
  if (action === "STAMP") {
    const origin = edit.origin || [0, 0, 0];
    const name = edit.name || "stamped_" + scene.objects.length;
    const colorHint = edit.colorHint || "";
    const voxelMap = parseToVoxelMap(edit.voxi);
    return addObject(scene, name, voxelMap, origin, colorHint);
  }

  const objIdx = scene.objects.findIndex((o) => o.name === edit.object);

  if (objIdx === -1) {
    console.warn(`[lod-core] Object "${edit.object}" not found, skipping edit`);
    return scene;
  }

  const obj = scene.objects[objIdx];
  let newObjects = [...scene.objects];

  switch (action) {
    case "MOVE": {
      const dx = edit.dx || 0;
      const dy = edit.dy || 0;
      const dz = edit.dz || 0;
      newObjects[objIdx] = {
        ...obj,
        origin: [obj.origin[0] + dx, obj.origin[1] + dy, obj.origin[2] + dz],
      };
      break;
    }

    case "ROTATE_Y90": {
      // Rotate local voxels 90 degrees around Y axis
      // (lx, ly, lz) -> (boundsD - 1 - lz, ly, lx)
      const [bw, bh, bd] = obj.bounds;
      const newLocal = new Map();
      for (const [key, color] of obj.localVoxels) {
        const [lx, ly, lz] = key.split(",").map(Number);
        const nx = bd - 1 - lz;
        const ny = ly;
        const nz = lx;
        newLocal.set(`${nx},${ny},${nz}`, color);
      }
      newObjects[objIdx] = {
        ...obj,
        localVoxels: newLocal,
        bounds: [bd, bh, bw], // swap W and D
      };
      break;
    }

    case "DELETE": {
      newObjects = newObjects.filter((_, i) => i !== objIdx);
      break;
    }

    case "RECOLOR": {
      const from =
        typeof edit.from === "string"
          ? COLOR_CODES.indexOf(edit.from.toLowerCase())
          : edit.from;
      const to =
        typeof edit.to === "string"
          ? COLOR_CODES.indexOf(edit.to.toLowerCase())
          : edit.to;

      const newLocal = new Map();
      for (const [key, color] of obj.localVoxels) {
        newLocal.set(key, color === from ? to : color);
      }
      newObjects[objIdx] = { ...obj, localVoxels: newLocal };
      break;
    }

    default:
      console.warn(`[lod-core] Unknown action "${action}", skipping`);
      return scene;
  }

  return rebuildGrid({ ...scene, objects: newObjects });
}

/**
 * Apply a sequence of edits to the scene.
 * @param {Scene} scene
 * @param {Object[]} edits
 * @returns {Scene}
 */
export function applyEdits(scene, edits) {
  return edits.reduce((s, edit) => applyEdit(s, edit), scene);
}

// ── Scene description ───────────────────────────────────────────────

/**
 * Generate a text summary of the scene for LLM consumption.
 * @param {Scene} scene
 * @returns {string}
 */
export function describeScene(scene) {
  const { W, H, D, objects, grid } = scene;
  let totalVoxels = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] >= 0) totalVoxels++;
  }

  const lines = [
    `Scene: ${W}x${H}x${D} grid, ${totalVoxels} total voxels, ${objects.length} objects`,
    "",
  ];

  for (const obj of objects) {
    const [ox, oy, oz] = obj.origin;
    const [bw, bh, bd] = obj.bounds;
    const count = obj.localVoxels.size;

    // Collect color distribution
    const colorDist = new Map();
    for (const [, c] of obj.localVoxels) {
      colorDist.set(c, (colorDist.get(c) || 0) + 1);
    }
    const topColors = [...colorDist.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c, n]) => `${COLOR_CODES[c]}(${n})`)
      .join(", ");

    lines.push(`  ${obj.name}:`);
    lines.push(`    Position: (${ox}, ${oy}, ${oz})`);
    lines.push(`    Bounds: ${bw}x${bh}x${bd}`);
    lines.push(`    Voxels: ${count}`);
    lines.push(
      `    Colors: ${topColors} ${obj.colorHint ? `— ${obj.colorHint}` : ""}`,
    );
    lines.push(
      `    Occupies: X[${ox}..${ox + bw - 1}] Y[${oy}..${oy + bh - 1}] Z[${oz}..${oz + bd - 1}]`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

// ── Voxel map from scene grid (for text-view) ──────────────────────

/**
 * Extract a voxel map from the scene grid (for use with textView).
 * @param {Scene} scene
 * @returns {Map<string, number>}
 */
export function sceneToVoxelMap(scene) {
  const { W, H, D, grid } = scene;
  const vm = new Map();
  const idx = (x, y, z) => x + y * W + z * W * H;

  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = grid[idx(x, y, z)];
        if (c >= 0) vm.set(`${x},${y},${z}`, c);
      }
    }
  }

  return vm;
}
