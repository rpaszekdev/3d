/**
 * parser.js — Parse .voxihome files into structured scene objects.
 *
 * Syntax:
 *   ROOM width depth height          — room dimensions in meters
 *   DOOR wall @position w:width      — door on wall (north/south/east/west)
 *   WINDOW wall @position w:width h:height
 *   TYPE variant @x z [facing:dir]   — furniture item from catalog
 *   -- comment
 *
 * Usage:
 *   import { parseHome, loadCatalog } from './parser.js';
 *   const catalog = loadCatalog();
 *   const scene = parseHome(code, catalog);
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Catalog ─────────────────────────────────────────────────────────

/**
 * Load the furniture catalog from catalog.json.
 * @returns {object} catalog keyed by type → variant → definition
 */
export function loadCatalog(path) {
  const catalogPath = path || join(__dirname, "catalog.json");
  return JSON.parse(readFileSync(catalogPath, "utf-8"));
}

// ── Parser ──────────────────────────────────────────────────────────

/**
 * Parse a .voxihome source string into a scene object.
 * @param {string} code — raw .voxihome file content
 * @param {object} catalog — loaded catalog (from loadCatalog)
 * @returns {Scene}
 */
export function parseHome(code, catalog) {
  const scene = {
    room: null,
    doors: [],
    windows: [],
    items: [],
    errors: [],
  };

  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("--")) continue;

    const lineNum = i + 1;

    try {
      const tokens = tokenize(raw);
      const cmd = tokens[0].toUpperCase();

      if (cmd === "ROOM") {
        scene.room = parseRoom(tokens);
      } else if (cmd === "DOOR") {
        scene.doors.push(parseDoor(tokens));
      } else if (cmd === "WINDOW") {
        scene.windows.push(parseWindow(tokens));
      } else {
        const item = parseItem(tokens, catalog, lineNum);
        if (item) {
          scene.items.push(item);
        } else {
          scene.errors.push(`Line ${lineNum}: unknown type "${tokens[0]}"`);
        }
      }
    } catch (e) {
      scene.errors.push(`Line ${lineNum}: ${e.message}`);
    }
  }

  if (!scene.room) {
    scene.errors.push("Missing ROOM definition");
  }

  return scene;
}

// ── Tokenizer ───────────────────────────────────────────────────────

function tokenize(line) {
  const tokens = [];
  let current = "";
  let inString = false;

  for (const ch of line) {
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString && (ch === " " || ch === "\t")) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

// ── ROOM parser ─────────────────────────────────────────────────────

function parseRoom(tokens) {
  // ROOM width depth height
  if (tokens.length < 4) throw new Error("ROOM requires: width depth height");
  return {
    width: parseFloat(tokens[1]),
    depth: parseFloat(tokens[2]),
    height: parseFloat(tokens[3]),
  };
}

// ── DOOR parser ─────────────────────────────────────────────────────

function parseDoor(tokens) {
  // DOOR north @2.0 w:0.9
  if (tokens.length < 3) throw new Error("DOOR requires: wall @position [w:width]");

  const wall = tokens[1].toLowerCase();
  const pos = parsePosition(tokens[2]);
  const props = parseProps(tokens.slice(3));

  return {
    type: "door",
    wall,
    position: pos,
    width: props.w || 0.9,
  };
}

// ── WINDOW parser ───────────────────────────────────────────────────

function parseWindow(tokens) {
  // WINDOW east @1.5 w:1.2 h:1.4
  if (tokens.length < 3) throw new Error("WINDOW requires: wall @position [w:width] [h:height]");

  const wall = tokens[1].toLowerCase();
  const pos = parsePosition(tokens[2]);
  const props = parseProps(tokens.slice(3));

  return {
    type: "window",
    wall,
    position: pos,
    width: props.w || 1.2,
    height: props.h || 1.4,
  };
}

// ── Furniture item parser ───────────────────────────────────────────

function parseItem(tokens, catalog, lineNum) {
  // TYPE variant @x z [facing:dir] [wall:dir]
  const typeName = tokens[0].toLowerCase();
  const catalogType = catalog[typeName];
  if (!catalogType || typeName.startsWith("_")) return null;

  const variant = tokens[1]?.toLowerCase();
  const def = catalogType[variant];
  if (!def) {
    throw new Error(
      `Unknown variant "${variant}" for ${typeName}. Available: ${Object.keys(catalogType).join(", ")}`
    );
  }

  // Find @x z position
  let x = 0, z = 0;
  let facing = null;
  let wallMount = null;

  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("@")) {
      x = parseFloat(t.slice(1));
      if (i + 1 < tokens.length && !tokens[i + 1].includes(":")) {
        z = parseFloat(tokens[i + 1]);
        i++;
      }
    } else if (t.startsWith("facing:")) {
      facing = t.split(":")[1].toLowerCase();
    } else if (t.startsWith("wall:")) {
      wallMount = t.split(":")[1].toLowerCase();
    }
  }

  // Convert catalog cm to meters for the scene
  const widthM = def.width / 100;
  const depthM = def.depth / 100;
  const heightM = def.height / 100;

  // Resolve clearance (handle "all" shorthand)
  const clearance = resolveClearance(def.clearance);

  return {
    type: typeName,
    variant,
    name: def.name,
    x,
    z,
    width: widthM,
    depth: depthM,
    height: heightM,
    facing: facing || "north",
    wallMount: wallMount || null,
    clearance,
    color: def.color,
    tags: def.tags || [],
    lineNum,
  };
}

// ── Clearance resolution ────────────────────────────────────────────

function resolveClearance(raw) {
  if (!raw) return { front: 0, back: 0, sides: 0 };

  if (raw.all !== undefined) {
    const v = raw.all / 100;
    return { front: v, back: v, left: v, right: v };
  }

  return {
    front: (raw.front || 0) / 100,
    back: (raw.back || 0) / 100,
    left: (raw.left || raw.sides || 0) / 100,
    right: (raw.right || raw.sides || 0) / 100,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function parsePosition(token) {
  if (token.startsWith("@")) return parseFloat(token.slice(1));
  return parseFloat(token);
}

function parseProps(tokens) {
  const props = {};
  for (const t of tokens) {
    if (t.includes(":")) {
      const [k, v] = t.split(":");
      props[k] = parseFloat(v) || v;
    }
  }
  return props;
}

// ── Scene utilities ─────────────────────────────────────────────────

/**
 * Get the bounding box of a furniture item accounting for facing direction.
 * Returns { x1, z1, x2, z2 } in room coordinates (meters).
 */
export function getItemBounds(item) {
  // When facing north/south, width is along X, depth is along Z
  // When facing east/west, width is along Z, depth is along X
  const rotated = item.facing === "east" || item.facing === "west";
  const w = rotated ? item.depth : item.width;
  const d = rotated ? item.width : item.depth;

  return {
    x1: item.x,
    z1: item.z,
    x2: item.x + w,
    z2: item.z + d,
  };
}

/**
 * Get bounding box including clearance zones.
 */
export function getItemBoundsWithClearance(item) {
  const bounds = getItemBounds(item);
  const c = item.clearance;

  // Map clearance directions based on facing
  const dirs = {
    north: { front: "z2", back: "z1", left: "x1", right: "x2" },
    south: { front: "z1", back: "z2", left: "x2", right: "x1" },
    east: { front: "x2", back: "x1", left: "z1", right: "z2" },
    west: { front: "x1", back: "x2", left: "z2", right: "z1" },
  };

  const d = dirs[item.facing] || dirs.north;
  const expanded = { ...bounds };

  // Expand in each direction
  if (d.front === "z2") expanded.z2 += c.front;
  if (d.front === "z1") expanded.z1 -= c.front;
  if (d.front === "x2") expanded.x2 += c.front;
  if (d.front === "x1") expanded.x1 -= c.front;

  if (d.back === "z2") expanded.z2 += c.back;
  if (d.back === "z1") expanded.z1 -= c.back;
  if (d.back === "x2") expanded.x2 += c.back;
  if (d.back === "x1") expanded.x1 -= c.back;

  if (d.left === "x1") expanded.x1 -= c.left;
  if (d.left === "x2") expanded.x2 += c.left;
  if (d.left === "z1") expanded.z1 -= c.left;
  if (d.left === "z2") expanded.z2 += c.left;

  if (d.right === "x1") expanded.x1 -= c.right;
  if (d.right === "x2") expanded.x2 += c.right;
  if (d.right === "z1") expanded.z1 -= c.right;
  if (d.right === "z2") expanded.z2 += c.right;

  return expanded;
}

/**
 * Describe the scene as a compact text summary for LLM consumption.
 */
export function describeScene(scene) {
  const lines = [];
  const r = scene.room;

  lines.push(`Room: ${r.width}m × ${r.depth}m, ceiling ${r.height}m (${(r.width * r.depth).toFixed(1)} m²)`);
  lines.push("");

  if (scene.doors.length) {
    lines.push("Doors:");
    for (const d of scene.doors) {
      lines.push(`  ${d.wall} wall at ${d.position}m, width ${d.width}m`);
    }
    lines.push("");
  }

  if (scene.windows.length) {
    lines.push("Windows:");
    for (const w of scene.windows) {
      lines.push(`  ${w.wall} wall at ${w.position}m, ${w.width}m × ${w.height}m`);
    }
    lines.push("");
  }

  if (scene.items.length) {
    lines.push("Furniture:");
    for (const item of scene.items) {
      const bounds = getItemBounds(item);
      lines.push(
        `  ${item.name} at (${item.x}, ${item.z})m, ` +
        `${(item.width * 100).toFixed(0)}×${(item.depth * 100).toFixed(0)}cm, ` +
        `facing ${item.facing}`
      );
    }
    lines.push("");
  }

  const totalFurnitureArea = scene.items.reduce((sum, item) => {
    const b = getItemBounds(item);
    return sum + (b.x2 - b.x1) * (b.z2 - b.z1);
  }, 0);
  const roomArea = r.width * r.depth;
  const freeArea = roomArea - totalFurnitureArea;
  lines.push(`Floor coverage: ${totalFurnitureArea.toFixed(1)} m² used, ${freeArea.toFixed(1)} m² free (${((freeArea / roomArea) * 100).toFixed(0)}%)`);

  return lines.join("\n");
}
