/**
 * compiler.js — Compile VOXI-Home scene objects into VOXI voxel code.
 *
 * Converts metric scene (meters) into voxel grid code that Mind's Eye can render.
 *
 * Usage:
 *   import { compileToVoxi } from './compiler.js';
 *   const voxiCode = compileToVoxi(scene, { scale: 10 });
 */

import { getItemBounds } from "./parser.js";

// ── Compile scene to VOXI code ──────────────────────────────────────

/**
 * Compile a parsed VOXI-Home scene into VOXI voxel code.
 * @param {Scene} scene — parsed scene from parser.js
 * @param {object} opts
 * @param {number} opts.scale — voxels per meter (default: 10)
 * @returns {string} VOXI code string
 */
export function compileToVoxi(scene, opts = {}) {
  const scale = opts.scale || 10;
  const { room, doors, windows, items } = scene;

  const W = Math.ceil(room.width * scale);
  const D = Math.ceil(room.depth * scale);
  const H = Math.ceil(room.height * scale);

  const lines = [];
  lines.push(`V ${W} ${H} ${D}`);
  lines.push(`-- VOXI-Home compiled scene (${room.width}m × ${room.depth}m, scale: 1 voxel = ${(100 / scale).toFixed(0)}cm)`);
  lines.push("");

  // Floor
  lines.push("-- Floor");
  lines.push(`B 0 0 0 ${W} 1 ${D} 8`);
  lines.push("");

  // Walls (1 voxel thick, full height)
  lines.push("-- Walls");
  const wallH = Math.max(4, Math.ceil(H * 0.6));
  lines.push(`B 0 1 0 ${W} ${wallH} 1 9`);       // south wall
  lines.push(`B 0 1 ${D - 1} ${W} ${wallH} 1 9`); // north wall
  lines.push(`B 0 1 0 1 ${wallH} ${D} 9`);         // west wall
  lines.push(`B ${W - 1} 1 0 1 ${wallH} ${D} 9`);  // east wall
  lines.push("");

  // Door openings (cut holes in walls)
  if (doors.length) {
    lines.push("-- Door openings");
    for (const door of doors) {
      const doorVoxels = compileDoor(door, room, scale, wallH);
      lines.push(`${doorVoxels} -- ${door.wall} door`);
    }
    lines.push("");
  }

  // Window markers (colored strip on wall)
  if (windows.length) {
    lines.push("-- Windows");
    for (const win of windows) {
      const winVoxels = compileWindow(win, room, scale, wallH);
      lines.push(`${winVoxels} -- ${win.wall} window`);
    }
    lines.push("");
  }

  // Furniture
  if (items.length) {
    lines.push("-- Furniture");
    for (const item of items) {
      const itemVoxels = compileItem(item, scale);
      lines.push(`${itemVoxels} -- ${item.name} (${item.type} ${item.variant})`);
    }
  }

  return lines.join("\n");
}

// ── Item compilation ────────────────────────────────────────────────

function compileItem(item, scale) {
  const bounds = getItemBounds(item);

  const x = Math.round(bounds.x1 * scale);
  const z = Math.round(bounds.z1 * scale);
  const w = Math.max(1, Math.round((bounds.x2 - bounds.x1) * scale));
  const d = Math.max(1, Math.round((bounds.z2 - bounds.z1) * scale));
  const h = Math.max(1, Math.round(item.height * scale));
  const y = 1; // On top of floor

  // Use hex color for values > 9
  const color = item.color <= 9 ? item.color : String.fromCharCode(87 + item.color);

  return `B ${x} ${y} ${z} ${w} ${h} ${d} ${color}`;
}

// ── Door compilation ────────────────────────────────────────────────

function compileDoor(door, room, scale, wallH) {
  const hw = door.width / 2;
  const doorH = Math.min(wallH, Math.ceil(2.1 * scale)); // 2.1m door height

  switch (door.wall) {
    case "south": {
      const x = Math.round((door.position - hw) * scale);
      const w = Math.max(1, Math.round(door.width * scale));
      return `B ${x} 1 0 ${w} ${doorH} 1 0`;
    }
    case "north": {
      const x = Math.round((door.position - hw) * scale);
      const w = Math.max(1, Math.round(door.width * scale));
      const dz = Math.ceil(room.depth * scale) - 1;
      return `B ${x} 1 ${dz} ${w} ${doorH} 1 0`;
    }
    case "west": {
      const z = Math.round((door.position - hw) * scale);
      const d = Math.max(1, Math.round(door.width * scale));
      return `B 0 1 ${z} 1 ${doorH} ${d} 0`;
    }
    case "east": {
      const z = Math.round((door.position - hw) * scale);
      const d = Math.max(1, Math.round(door.width * scale));
      const dx = Math.ceil(room.width * scale) - 1;
      return `B ${dx} 1 ${z} 1 ${doorH} ${d} 0`;
    }
    default:
      return `-- unknown wall: ${door.wall}`;
  }
}

// ── Window compilation ──────────────────────────────────────────────

function compileWindow(win, room, scale, wallH) {
  const hw = win.width / 2;
  const sillHeight = Math.round(0.9 * scale); // 90cm sill
  const winH = Math.max(1, Math.round(win.height * scale));

  switch (win.wall) {
    case "south": {
      const x = Math.round((win.position - hw) * scale);
      const w = Math.max(1, Math.round(win.width * scale));
      return `B ${x} ${sillHeight} 0 ${w} ${winH} 1 4`;
    }
    case "north": {
      const x = Math.round((win.position - hw) * scale);
      const w = Math.max(1, Math.round(win.width * scale));
      const dz = Math.ceil(room.depth * scale) - 1;
      return `B ${x} ${sillHeight} ${dz} ${w} ${winH} 1 4`;
    }
    case "west": {
      const z = Math.round((win.position - hw) * scale);
      const d = Math.max(1, Math.round(win.width * scale));
      return `B 0 ${sillHeight} ${z} 1 ${winH} ${d} 4`;
    }
    case "east": {
      const z = Math.round((win.position - hw) * scale);
      const d = Math.max(1, Math.round(win.width * scale));
      const dx = Math.ceil(room.width * scale) - 1;
      return `B ${dx} ${sillHeight} ${z} 1 ${winH} ${d} 4`;
    }
    default:
      return `-- unknown wall: ${win.wall}`;
  }
}

// ── Top-down ASCII view (no Mind's Eye needed) ──────────────────────

/**
 * Render a simple top-down ASCII floor plan of the scene.
 * @param {Scene} scene
 * @param {number} charsWide — width in characters (default: 60)
 * @returns {string}
 */
export function topDownView(scene, charsWide = 60) {
  const { room, items, doors, windows } = scene;
  const aspect = room.depth / room.width;
  const cols = charsWide;
  const rows = Math.round(cols * aspect);

  // Initialize grid with spaces
  const grid = Array.from({ length: rows }, () => Array(cols).fill(" "));

  const toCol = (x) => Math.min(cols - 1, Math.max(0, Math.round((x / room.width) * (cols - 1))));
  const toRow = (z) => Math.min(rows - 1, Math.max(0, rows - 1 - Math.round((z / room.depth) * (rows - 1))));

  // Draw walls
  for (let c = 0; c < cols; c++) {
    grid[0][c] = "─";
    grid[rows - 1][c] = "─";
  }
  for (let r = 0; r < rows; r++) {
    grid[r][0] = "│";
    grid[r][cols - 1] = "│";
  }
  grid[0][0] = "┌";
  grid[0][cols - 1] = "┐";
  grid[rows - 1][0] = "└";
  grid[rows - 1][cols - 1] = "┘";

  // Draw doors
  for (const door of doors) {
    const hw = door.width / 2;
    if (door.wall === "north" || door.wall === "south") {
      const r = door.wall === "north" ? 0 : rows - 1;
      const c1 = toCol(door.position - hw);
      const c2 = toCol(door.position + hw);
      for (let c = c1; c <= c2; c++) grid[r][c] = "▓";
    } else {
      const c = door.wall === "west" ? 0 : cols - 1;
      const r1 = toRow(door.position + hw);
      const r2 = toRow(door.position - hw);
      for (let r = r1; r <= r2; r++) grid[r][c] = "▓";
    }
  }

  // Draw windows
  for (const win of windows) {
    const hw = win.width / 2;
    if (win.wall === "north" || win.wall === "south") {
      const r = win.wall === "north" ? 0 : rows - 1;
      const c1 = toCol(win.position - hw);
      const c2 = toCol(win.position + hw);
      for (let c = c1; c <= c2; c++) grid[r][c] = "░";
    } else {
      const c = win.wall === "west" ? 0 : cols - 1;
      const r1 = toRow(win.position + hw);
      const r2 = toRow(win.position - hw);
      for (let r = r1; r <= r2; r++) grid[r][c] = "░";
    }
  }

  // Draw furniture
  const symbols = {
    sofa: "S", table: "T", chair: "C", bed: "B", tv: "V",
    storage: "H", desk: "D", rug: "·", lamp: "*", nightstand: "N",
  };

  for (const item of items) {
    const bounds = getItemBounds(item);
    const c1 = toCol(bounds.x1) + 1;
    const c2 = toCol(bounds.x2) - 1;
    const r1 = toRow(bounds.z2) + 1;
    const r2 = toRow(bounds.z1) - 1;

    const sym = symbols[item.type] || "?";
    for (let r = Math.max(1, r1); r <= Math.min(rows - 2, r2); r++) {
      for (let c = Math.max(1, c1); c <= Math.min(cols - 2, c2); c++) {
        grid[r][c] = sym;
      }
    }

    // Place label in center
    const midR = Math.round((r1 + r2) / 2);
    const midC = Math.round((c1 + c2) / 2);
    if (midR > 0 && midR < rows - 1 && midC > 0 && midC < cols - 1) {
      grid[midR][midC] = sym;
    }
  }

  // Build output
  const header = `  ${room.width}m × ${room.depth}m`;
  const legend = Object.entries(symbols)
    .filter(([type]) => items.some((i) => i.type === type))
    .map(([type, sym]) => `${sym}=${type}`)
    .join("  ");

  return [header, ...grid.map((row) => "  " + row.join("")), `  ${legend}`].join("\n");
}
