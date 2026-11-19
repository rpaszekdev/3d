/**
 * constraints.js — Spatial rules engine for VOXI-Home.
 *
 * Pure functions, no side effects. All return new objects.
 *
 * Usage:
 *   import { getViolations, checkFit, findFreeZones, checkWalkways } from './constraints.js';
 */

import { getItemBounds, getItemBoundsWithClearance } from "./parser.js";

// ── Constants ───────────────────────────────────────────────────────

const MIN_WALKWAY = 0.80; // meters
const DOOR_SWING_ARC = 0.90; // meters (radius of door swing)
const WINDOW_BLOCK_MAX_HEIGHT = 0.90; // meters — don't block windows with tall furniture

// ── Overlap detection ───────────────────────────────────────────────

function rectsOverlap(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.z1 < b.z2 && a.z2 > b.z1;
}

function overlapArea(a, b) {
  const dx = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const dz = Math.min(a.z2, b.z2) - Math.max(a.z1, b.z1);
  if (dx <= 0 || dz <= 0) return 0;
  return dx * dz;
}

// ── Main constraint checks ──────────────────────────────────────────

/**
 * Check all constraints and return a list of violations.
 * @param {Scene} scene
 * @returns {Violation[]} — array of { type, severity, message, items }
 */
export function getViolations(scene) {
  const violations = [];
  const { room, items, doors, windows } = scene;

  // 1. Items outside room bounds
  for (const item of items) {
    const b = getItemBounds(item);
    if (b.x1 < 0 || b.z1 < 0 || b.x2 > room.width || b.z2 > room.depth) {
      violations.push({
        type: "out-of-bounds",
        severity: "error",
        message: `${item.name} extends outside room (bounds: ${fmt(b)}, room: ${room.width}×${room.depth}m)`,
        items: [item],
      });
    }
  }

  // 2. Overlapping furniture
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      // Rugs can overlap with anything
      if (items[i].type === "rug" || items[j].type === "rug") continue;

      const a = getItemBounds(items[i]);
      const b = getItemBounds(items[j]);
      if (rectsOverlap(a, b)) {
        violations.push({
          type: "overlap",
          severity: "error",
          message: `${items[i].name} overlaps with ${items[j].name} (${overlapArea(a, b).toFixed(2)} m²)`,
          items: [items[i], items[j]],
        });
      }
    }
  }

  // 3. Clearance violations (item clearance zones overlap other items)
  for (let i = 0; i < items.length; i++) {
    if (items[i].type === "rug") continue;
    const expanded = getItemBoundsWithClearance(items[i]);
    for (let j = 0; j < items.length; j++) {
      if (i === j || items[j].type === "rug") continue;
      const other = getItemBounds(items[j]);
      const itemBounds = getItemBounds(items[i]);

      // Only flag if other item is in the clearance zone but NOT in the item itself
      if (rectsOverlap(expanded, other) && !rectsOverlap(itemBounds, other)) {
        violations.push({
          type: "clearance",
          severity: "warning",
          message: `${items[j].name} is in the clearance zone of ${items[i].name}`,
          items: [items[i], items[j]],
        });
      }
    }
  }

  // 4. Door blockage
  for (const door of doors) {
    const doorZone = getDoorSwingZone(door, room);
    for (const item of items) {
      if (item.type === "rug") continue;
      const b = getItemBounds(item);
      if (rectsOverlap(doorZone, b)) {
        violations.push({
          type: "door-blocked",
          severity: "error",
          message: `${item.name} blocks ${door.wall} door swing area`,
          items: [item],
        });
      }
    }
  }

  // 5. Window blockage (tall furniture in front of window)
  for (const win of windows) {
    const winZone = getWindowZone(win, room);
    for (const item of items) {
      if (item.height <= WINDOW_BLOCK_MAX_HEIGHT) continue;
      if (item.type === "rug") continue;
      const b = getItemBounds(item);
      if (rectsOverlap(winZone, b)) {
        violations.push({
          type: "window-blocked",
          severity: "warning",
          message: `${item.name} (${(item.height * 100).toFixed(0)}cm tall) blocks ${win.wall} window`,
          items: [item],
        });
      }
    }
  }

  return violations;
}

// ── Fit check ───────────────────────────────────────────────────────

/**
 * Check if a new item can fit at a given position without violations.
 * @param {Scene} scene
 * @param {object} newItem — parsed item to check
 * @returns {{ fits: boolean, violations: Violation[] }}
 */
export function checkFit(scene, newItem) {
  const testScene = {
    ...scene,
    items: [...scene.items, newItem],
  };
  const violations = getViolations(testScene).filter((v) =>
    v.items.some((i) => i === newItem)
  );
  return {
    fits: violations.filter((v) => v.severity === "error").length === 0,
    violations,
  };
}

// ── Free zone finder ────────────────────────────────────────────────

/**
 * Find rectangular free zones in the room that are at least minW × minD.
 * Uses a grid-scan approach (10cm resolution).
 * @param {Scene} scene
 * @param {number} minW — minimum width in meters
 * @param {number} minD — minimum depth in meters
 * @returns {{ x: number, z: number, width: number, depth: number }[]}
 */
export function findFreeZones(scene, minW = 0.5, minD = 0.5) {
  const { room, items, doors } = scene;
  const step = 0.1; // 10cm resolution
  const cols = Math.floor(room.width / step);
  const rows = Math.floor(room.depth / step);

  // Build occupancy grid
  const grid = new Uint8Array(cols * rows);
  const idx = (c, r) => c + r * cols;

  for (const item of items) {
    if (item.type === "rug") continue;
    const b = getItemBounds(item);
    const c0 = Math.floor(b.x1 / step);
    const c1 = Math.ceil(b.x2 / step);
    const r0 = Math.floor(b.z1 / step);
    const r1 = Math.ceil(b.z2 / step);
    for (let c = Math.max(0, c0); c < Math.min(cols, c1); c++) {
      for (let r = Math.max(0, r0); r < Math.min(rows, r1); r++) {
        grid[idx(c, r)] = 1;
      }
    }
  }

  // Mark door swing zones as occupied
  for (const door of doors) {
    const dz = getDoorSwingZone(door, room);
    const c0 = Math.floor(dz.x1 / step);
    const c1 = Math.ceil(dz.x2 / step);
    const r0 = Math.floor(dz.z1 / step);
    const r1 = Math.ceil(dz.z2 / step);
    for (let c = Math.max(0, c0); c < Math.min(cols, c1); c++) {
      for (let r = Math.max(0, r0); r < Math.min(rows, r1); r++) {
        grid[idx(c, r)] = 1;
      }
    }
  }

  // Find free rectangles using a sweep approach
  const minCols = Math.ceil(minW / step);
  const minRows = Math.ceil(minD / step);
  const zones = [];

  for (let r = 0; r <= rows - minRows; r += Math.max(1, Math.floor(minRows / 2))) {
    for (let c = 0; c <= cols - minCols; c += Math.max(1, Math.floor(minCols / 2))) {
      // Check if this starting point is free
      if (grid[idx(c, r)] === 1) continue;

      // Expand rectangle as far as possible
      let maxC = cols;
      for (let dr = 0; dr < rows - r; dr++) {
        let rowEnd = maxC;
        for (let dc = 0; dc < rowEnd - c; dc++) {
          if (grid[idx(c + dc, r + dr)] === 1) {
            rowEnd = c + dc;
            break;
          }
        }
        maxC = rowEnd;
        if (maxC - c < minCols) break;

        const w = (maxC - c) * step;
        const d = (dr + 1) * step;
        if (w >= minW && d >= minD) {
          // Check not a subset of an existing zone
          const zoneRect = {
            x: c * step,
            z: r * step,
            width: w,
            depth: d,
          };
          const isDuplicate = zones.some(
            (z) =>
              Math.abs(z.x - zoneRect.x) < minW / 2 &&
              Math.abs(z.z - zoneRect.z) < minD / 2
          );
          if (!isDuplicate) {
            zones.push(zoneRect);
          }
        }
      }
    }
  }

  // Sort by area descending
  zones.sort((a, b) => b.width * b.depth - a.width * a.depth);
  return zones.slice(0, 10); // Return top 10
}

/**
 * Check if main walkways exist (door to door, door to room center).
 * @param {Scene} scene
 * @returns {{ clear: boolean, issues: string[] }}
 */
export function checkWalkways(scene) {
  const issues = [];
  const { room, items, doors } = scene;

  // Simple check: for each pair of doors, verify there's a path
  // We approximate by checking if any horizontal or vertical stripe
  // of MIN_WALKWAY width is clear between door positions
  for (let i = 0; i < doors.length; i++) {
    for (let j = i + 1; j < doors.length; j++) {
      const d1 = getDoorCenter(doors[i], room);
      const d2 = getDoorCenter(doors[j], room);

      // Check L-shaped path (go along x then z, or z then x)
      const pathClear = checkLPath(d1, d2, items, room);
      if (!pathClear) {
        issues.push(
          `No clear ${MIN_WALKWAY * 100}cm walkway between ${doors[i].wall} door and ${doors[j].wall} door`
        );
      }
    }
  }

  return { clear: issues.length === 0, issues };
}

// ── Door / Window zone helpers ──────────────────────────────────────

function getDoorSwingZone(door, room) {
  const w = door.width;
  const r = DOOR_SWING_ARC;

  switch (door.wall) {
    case "north":
      return { x1: door.position - w / 2, x2: door.position + w / 2, z1: room.depth - r, z2: room.depth };
    case "south":
      return { x1: door.position - w / 2, x2: door.position + w / 2, z1: 0, z2: r };
    case "east":
      return { x1: room.width - r, x2: room.width, z1: door.position - w / 2, z2: door.position + w / 2 };
    case "west":
      return { x1: 0, x2: r, z1: door.position - w / 2, z2: door.position + w / 2 };
    default:
      return { x1: 0, x2: 0, z1: 0, z2: 0 };
  }
}

function getWindowZone(win, room) {
  const depth = 0.3; // 30cm in front of window
  switch (win.wall) {
    case "north":
      return { x1: win.position - win.width / 2, x2: win.position + win.width / 2, z1: room.depth - depth, z2: room.depth };
    case "south":
      return { x1: win.position - win.width / 2, x2: win.position + win.width / 2, z1: 0, z2: depth };
    case "east":
      return { x1: room.width - depth, x2: room.width, z1: win.position - win.width / 2, z2: win.position + win.width / 2 };
    case "west":
      return { x1: 0, x2: depth, z1: win.position - win.width / 2, z2: win.position + win.width / 2 };
    default:
      return { x1: 0, x2: 0, z1: 0, z2: 0 };
  }
}

function getDoorCenter(door, room) {
  switch (door.wall) {
    case "north": return { x: door.position, z: room.depth };
    case "south": return { x: door.position, z: 0 };
    case "east": return { x: room.width, z: door.position };
    case "west": return { x: 0, z: door.position };
    default: return { x: 0, z: 0 };
  }
}

// ── Walkway path check ──────────────────────────────────────────────

function checkLPath(from, to, items, room) {
  // Check two L-shaped paths and return true if either is clear
  const hw = MIN_WALKWAY / 2;

  // Path 1: go along X first, then Z
  const p1a = { x1: Math.min(from.x, to.x) - hw, x2: Math.max(from.x, to.x) + hw, z1: from.z - hw, z2: from.z + hw };
  const p1b = { x1: to.x - hw, x2: to.x + hw, z1: Math.min(from.z, to.z) - hw, z2: Math.max(from.z, to.z) + hw };

  // Path 2: go along Z first, then X
  const p2a = { x1: from.x - hw, x2: from.x + hw, z1: Math.min(from.z, to.z) - hw, z2: Math.max(from.z, to.z) + hw };
  const p2b = { x1: Math.min(from.x, to.x) - hw, x2: Math.max(from.x, to.x) + hw, z1: to.z - hw, z2: to.z + hw };

  const path1Clear = !items.some((item) => {
    if (item.type === "rug") return false;
    const b = getItemBounds(item);
    return rectsOverlap(b, p1a) || rectsOverlap(b, p1b);
  });

  const path2Clear = !items.some((item) => {
    if (item.type === "rug") return false;
    const b = getItemBounds(item);
    return rectsOverlap(b, p2a) || rectsOverlap(b, p2b);
  });

  return path1Clear || path2Clear;
}

// ── Formatting ──────────────────────────────────────────────────────

function fmt(b) {
  return `(${b.x1.toFixed(1)},${b.z1.toFixed(1)})→(${b.x2.toFixed(1)},${b.z2.toFixed(1)})`;
}

/**
 * Generate a human-readable constraints report.
 */
export function constraintsReport(scene) {
  const violations = getViolations(scene);
  const walkways = checkWalkways(scene);
  const freeZones = findFreeZones(scene, 0.8, 0.8);

  const lines = [];

  if (violations.length === 0 && walkways.clear) {
    lines.push("No violations found. Layout is valid.");
  } else {
    if (violations.length) {
      lines.push("Violations:");
      for (const v of violations) {
        const icon = v.severity === "error" ? "ERROR" : "WARN";
        lines.push(`  [${icon}] ${v.message}`);
      }
    }
    if (!walkways.clear) {
      lines.push("Walkway issues:");
      for (const issue of walkways.issues) {
        lines.push(`  [WARN] ${issue}`);
      }
    }
  }

  if (freeZones.length) {
    lines.push("");
    lines.push(`Free zones (≥80×80cm): ${freeZones.length} found`);
    for (const z of freeZones.slice(0, 5)) {
      lines.push(
        `  ${z.width.toFixed(1)}×${z.depth.toFixed(1)}m at (${z.x.toFixed(1)}, ${z.z.toFixed(1)})`
      );
    }
  }

  return lines.join("\n");
}
