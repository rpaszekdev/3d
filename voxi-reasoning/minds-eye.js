#!/usr/bin/env node
/**
 * minds-eye.js — Interactive 3D camera for VOXI scenes.
 *
 * Load a VOXI scene, then explore it with camera commands:
 *   LOOK front|back|left|right|top|bottom  — axis-aligned view
 *   WIDE                                   — 6-view overview (low res)
 *   ZOOM cx cy cz r                        — zoom into region, radius r
 *   FOCUS x y z w h d                      — crop to bounding box
 *   SLICE x=N | y=N | z=N                  — cross-section slice
 *   COMPARE view1 view2                    — two views side by side
 *   AROUND cx cy cz r                      — 4 views orbiting a point
 *   INFO                                   — scene stats
 *   RELOAD                                 — re-parse the VOXI file
 *
 * Usage:
 *   node minds-eye.js scene.voxi
 *   node minds-eye.js --code "V 16 16 16\nS 8 8 8 5 7"
 *   echo "LOOK front" | node minds-eye.js scene.voxi   (non-interactive)
 *
 * As a module:
 *   import { MindsEye } from './minds-eye.js';
 *   const eye = new MindsEye(voxiCode);
 *   console.log(eye.exec('LOOK front'));
 *   console.log(eye.exec('ZOOM 8 25 7 5'));
 */

import fs from "fs";
import readline from "readline";
import {
  parseVoxi,
  parseVoxiAnim,
  textViewAtFrame,
  frameDiff,
} from "./text-view.js";
import FastNoiseLite from "fastnoise-lite";

// ── Color names for info display ────────────────────────────────────
const CNAMES = [
  "black",
  "red",
  "green",
  "blue",
  "cyan",
  "magenta",
  "yellow",
  "orange",
  "white",
  "gray",
  "brown",
  "pink",
  "dark-green",
  "tan",
  "maroon",
  "navy",
];

// ── Grid (same as text-view.js but kept local for self-containment) ──

function buildGrid(W, H, D, vm) {
  const grid = new Int8Array(W * H * D).fill(-1);
  const idx = (x, y, z) => x + y * W + z * W * H;
  for (const [k, c] of vm) {
    const [x, y, z] = k.split(",").map(Number);
    if (x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D)
      grid[idx(x, y, z)] = c;
  }
  return { grid, idx, W, H, D };
}

// ── Projection with crop support ────────────────────────────────────

function projectCropped(g, view, crop) {
  const { grid, idx, W, H, D } = g;

  // Crop bounds (default = full grid)
  const cx0 = crop?.x0 ?? 0,
    cx1 = crop?.x1 ?? W;
  const cy0 = crop?.y0 ?? 0,
    cy1 = crop?.y1 ?? H;
  const cz0 = crop?.z0 ?? 0,
    cz1 = crop?.z1 ?? D;
  const cw = cx1 - cx0,
    ch = cy1 - cy0,
    cd = cz1 - cz0;

  let viewW, viewH, maxDepth, label;
  let getVoxel;

  switch (view) {
    case "front":
      viewW = cw;
      viewH = ch;
      maxDepth = cd;
      label = `FRONT (→X, ↑Y) [x:${cx0}-${cx1} y:${cy0}-${cy1}]`;
      getVoxel = (col, row, d) => {
        const x = cx0 + col,
          y = cy1 - 1 - row,
          z = cz0 + d;
        return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D
          ? grid[idx(x, y, z)]
          : -1;
      };
      break;
    case "back":
      viewW = cw;
      viewH = ch;
      maxDepth = cd;
      label = `BACK (→X, ↑Y) [x:${cx0}-${cx1} y:${cy0}-${cy1}]`;
      getVoxel = (col, row, d) => {
        const x = cx1 - 1 - col,
          y = cy1 - 1 - row,
          z = cz1 - 1 - d;
        return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D
          ? grid[idx(x, y, z)]
          : -1;
      };
      break;
    case "right":
      viewW = cd;
      viewH = ch;
      maxDepth = cw;
      label = `RIGHT (→Z, ↑Y) [z:${cz0}-${cz1} y:${cy0}-${cy1}]`;
      getVoxel = (col, row, d) => {
        const x = cx1 - 1 - d,
          y = cy1 - 1 - row,
          z = cz0 + col;
        return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D
          ? grid[idx(x, y, z)]
          : -1;
      };
      break;
    case "left":
      viewW = cd;
      viewH = ch;
      maxDepth = cw;
      label = `LEFT (→Z, ↑Y) [z:${cz0}-${cz1} y:${cy0}-${cy1}]`;
      getVoxel = (col, row, d) => {
        const x = cx0 + d,
          y = cy1 - 1 - row,
          z = cz1 - 1 - col;
        return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D
          ? grid[idx(x, y, z)]
          : -1;
      };
      break;
    case "top":
      viewW = cw;
      viewH = cd;
      maxDepth = ch;
      label = `TOP (→X, ↑Z) [x:${cx0}-${cx1} z:${cz0}-${cz1}]`;
      getVoxel = (col, row, d) => {
        const x = cx0 + col,
          y = cy1 - 1 - d,
          z = cz1 - 1 - row;
        return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D
          ? grid[idx(x, y, z)]
          : -1;
      };
      break;
    case "bottom":
      viewW = cw;
      viewH = cd;
      maxDepth = ch;
      label = `BOTTOM (→X, ↑Z) [x:${cx0}-${cx1} z:${cz0}-${cz1}]`;
      getVoxel = (col, row, d) => {
        const x = cx0 + col,
          y = cy0 + d,
          z = cz0 + row;
        return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D
          ? grid[idx(x, y, z)]
          : -1;
      };
      break;
  }

  const rows = [];
  for (let row = 0; row < viewH; row++) {
    const line = [];
    for (let col = 0; col < viewW; col++) {
      let hit = -1,
        hitDepth = -1;
      for (let d = 0; d < maxDepth; d++) {
        const v = getVoxel(col, row, d);
        if (v >= 0) {
          hit = v;
          hitDepth = d;
          break;
        }
      }
      if (hit < 0) {
        line.push(".");
      } else {
        const q =
          maxDepth <= 1 ? 0 : Math.round((hitDepth * 9) / (maxDepth - 1));
        line.push(String(q));
      }
    }
    rows.push(line);
  }

  return { rows, viewW, viewH, label };
}

// ── Render a single view to text (with coordinate rulers) ───────────

function renderView(proj, showRulers = true) {
  const lines = [proj.label];

  if (showRulers && proj.viewW <= 40) {
    // Column ruler (tens)
    if (proj.viewW > 10) {
      const tens =
        "   " +
        Array.from({ length: proj.viewW }, (_, i) =>
          i >= 10 ? Math.floor(i / 10).toString() : " ",
        ).join(" ");
      lines.push(tens);
    }
    // Column ruler (ones)
    const ones =
      "   " +
      Array.from({ length: proj.viewW }, (_, i) => (i % 10).toString()).join(
        " ",
      );
    lines.push(ones);
  }

  for (let r = 0; r < proj.rows.length; r++) {
    const rowLabel =
      showRulers && proj.viewW <= 40 ? String(r).padStart(2) + " " : "";
    lines.push(rowLabel + proj.rows[r].join(" "));
  }
  return lines.join("\n");
}

// ── View-to-World coordinate mapping ────────────────────────────────

/**
 * Map a 2D view position (col, row) back to the 3D voxel it hits.
 * Returns { x, y, z, depth, color } or null if empty.
 */
function viewToWorld(g, view, col, row, crop) {
  const { grid, idx, W, H, D } = g;

  const cx0 = crop?.x0 ?? 0,
    cx1 = crop?.x1 ?? W;
  const cy0 = crop?.y0 ?? 0,
    cy1 = crop?.y1 ?? H;
  const cz0 = crop?.z0 ?? 0,
    cz1 = crop?.z1 ?? D;
  const cw = cx1 - cx0,
    ch = cy1 - cy0,
    cd = cz1 - cz0;

  let maxDepth, toWorld;

  switch (view) {
    case "front":
      maxDepth = cd;
      toWorld = (d) => ({ x: cx0 + col, y: cy1 - 1 - row, z: cz0 + d });
      break;
    case "back":
      maxDepth = cd;
      toWorld = (d) => ({ x: cx1 - 1 - col, y: cy1 - 1 - row, z: cz1 - 1 - d });
      break;
    case "right":
      maxDepth = cw;
      toWorld = (d) => ({ x: cx1 - 1 - d, y: cy1 - 1 - row, z: cz0 + col });
      break;
    case "left":
      maxDepth = cw;
      toWorld = (d) => ({ x: cx0 + d, y: cy1 - 1 - row, z: cz1 - 1 - col });
      break;
    case "top":
      maxDepth = ch;
      toWorld = (d) => ({ x: cx0 + col, y: cy1 - 1 - d, z: cz1 - 1 - row });
      break;
    case "bottom":
      maxDepth = ch;
      toWorld = (d) => ({ x: cx0 + col, y: cy0 + d, z: cz0 + row });
      break;
  }

  // Cast ray, find first hit
  for (let d = 0; d < maxDepth; d++) {
    const p = toWorld(d);
    if (p.x >= 0 && p.x < W && p.y >= 0 && p.y < H && p.z >= 0 && p.z < D) {
      const v = grid[idx(p.x, p.y, p.z)];
      if (v >= 0) {
        return { x: p.x, y: p.y, z: p.z, depth: d, color: v };
      }
    }
  }
  return null;
}

// ── Find which VOXI source line created a voxel ─────────────────────

function findSourceLine(code, x, y, z) {
  const lines = code.split("\n");
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("--") || line.startsWith("//")) continue;
    const p = line.split(/\s+/);
    const cmd = p[0].toUpperCase();
    const n = p.slice(1).map(Number);

    let hit = false;
    switch (cmd) {
      case "P":
        hit =
          Math.round(n[0]) === x &&
          Math.round(n[1]) === y &&
          Math.round(n[2]) === z;
        break;
      case "B": {
        const [bx, by, bz, bw, bh, bd] = n;
        hit =
          x >= bx &&
          x < bx + bw &&
          y >= by &&
          y < by + bh &&
          z >= bz &&
          z < bz + bd;
        break;
      }
      case "S": {
        const [sx, sy, sz, sr] = n;
        hit = (x - sx) ** 2 + (y - sy) ** 2 + (z - sz) ** 2 <= sr * sr;
        break;
      }
      case "E": {
        const [ex, ey, ez, rx, ry, rz] = n;
        if (rx > 0 && ry > 0 && rz > 0)
          hit =
            ((x - ex) / rx) ** 2 +
              ((y - ey) / ry) ** 2 +
              ((z - ez) / rz) ** 2 <=
            1;
        break;
      }
      case "C": {
        const [cx, cy, cz, cr, ch] = n;
        hit =
          (x - cx) ** 2 + (z - cz) ** 2 <= cr * cr && y >= cy && y < cy + ch;
        break;
      }
    }
    if (hit) {
      matches.push({ line: i + 1, text: lines[i].trim() });
    }
  }
  return matches;
}

// ── Slice renderer ──────────────────────────────────────────────────

function renderSlice(g, axis, value) {
  const { grid, idx, W, H, D } = g;
  const lines = [];

  if (axis === "y") {
    lines.push(`SLICE y=${value} (→X, ↑Z) — colors shown`);
    for (let z = D - 1; z >= 0; z--) {
      const row = [];
      for (let x = 0; x < W; x++) {
        const v = grid[idx(x, value, z)];
        row.push(v < 0 ? "." : v.toString(16));
      }
      lines.push(row.join(" "));
    }
  } else if (axis === "x") {
    lines.push(`SLICE x=${value} (→Z, ↑Y) — colors shown`);
    for (let y = H - 1; y >= 0; y--) {
      const row = [];
      for (let z = 0; z < D; z++) {
        const v = grid[idx(value, y, z)];
        row.push(v < 0 ? "." : v.toString(16));
      }
      lines.push(row.join(" "));
    }
  } else if (axis === "z") {
    lines.push(`SLICE z=${value} (→X, ↑Y) — colors shown`);
    for (let y = H - 1; y >= 0; y--) {
      const row = [];
      for (let x = 0; x < W; x++) {
        const v = grid[idx(x, y, value)];
        row.push(v < 0 ? "." : v.toString(16));
      }
      lines.push(row.join(" "));
    }
  }

  return lines.join("\n");
}

// ── MindsEye class ──────────────────────────────────────────────────

export class MindsEye {
  constructor(voxiCode) {
    this.code = voxiCode;
    this._parse();
    this._snapshot = new Map(this.vm); // baseline for DIFF
    this._edits = []; // track PAINT/ERASE operations
  }

  _parse() {
    const { W, H, D, vm } = parseVoxi(this.code);
    this.g = buildGrid(W, H, D, vm);
    this.vm = vm;
  }

  reload(newCode) {
    if (newCode) this.code = newCode;
    this._parse();
    return `Reloaded: ${this.g.W}x${this.g.H}x${this.g.D}, ${this.vm.size} voxels`;
  }

  /** Execute a camera command, return text output. */
  exec(command) {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toUpperCase();

    switch (cmd) {
      case "LOOK":
        return this._look(parts[1] || "front");
      case "WIDE":
        return this._wide();
      case "ZOOM":
        return this._zoom(parts);
      case "FOCUS":
        return this._focus(parts);
      case "SLICE":
        return this._slice(parts);
      case "COMPARE":
        return this._compare(parts);
      case "AROUND":
        return this._around(parts);
      case "WHAT":
        return this._what(parts);
      case "PAINT":
        return this._paint(parts);
      case "ERASE":
        return this._erase(parts);
      case "DIFF":
        return this._diff(parts);
      case "SNAP":
        return this._snap();
      case "TERRAIN":
        return this._terrain(parts);
      case "FRAME":
        return this._frame(parts);
      case "FDIFF":
        return this._fdiff(parts);
      case "FRAMES":
        return this._frames();
      case "INFO":
        return this._info();
      case "RELOAD":
        return this.reload();
      case "HELP":
        return this._help();
      default:
        return `Unknown command: ${cmd}. Type HELP for commands.`;
    }
  }

  // ── Commands ────────────────────────────────────────────────────

  _look(view) {
    const v = view.toLowerCase();
    const valid = ["front", "back", "left", "right", "top", "bottom"];
    if (!valid.includes(v))
      return `Invalid view: ${v}. Use: ${valid.join(", ")}`;
    const proj = projectCropped(this.g, v);
    return renderView(proj);
  }

  _wide() {
    const views = ["top", "front", "left", "right", "bottom", "back"];
    const projs = views.map((v) => projectCropped(this.g, v));

    const pad = (s, len) => s + " ".repeat(Math.max(0, len - s.length));
    const empty = (len) => " ".repeat(len);

    const frontW = projs[1].viewW * 2;
    const leftW = projs[2].viewW * 2;
    const leftPad = leftW + 2;

    const lines = [
      `WIDE VIEW (${this.g.W}x${this.g.H}x${this.g.D}) — depth 0=close 9=far .=empty`,
      "",
    ];

    // Top
    lines.push(empty(leftPad) + projs[0].label);
    for (const row of projs[0].rows) lines.push(empty(leftPad) + row.join(" "));
    lines.push("");

    // Left | Front | Right
    const midH = Math.max(projs[1].viewH, projs[2].viewH, projs[3].viewH);
    lines.push(
      pad(projs[2].label, leftPad) +
        pad(projs[1].label, frontW + 2) +
        projs[3].label,
    );
    for (let r = 0; r < midH; r++) {
      const l = r < projs[2].viewH ? projs[2].rows[r].join(" ") : "";
      const f = r < projs[1].viewH ? projs[1].rows[r].join(" ") : "";
      const ri = r < projs[3].viewH ? projs[3].rows[r].join(" ") : "";
      lines.push(pad(l, leftPad) + pad(f, frontW + 2) + ri);
    }
    lines.push("");

    // Bottom
    lines.push(empty(leftPad) + projs[4].label);
    for (const row of projs[4].rows) lines.push(empty(leftPad) + row.join(" "));
    lines.push("");

    // Back
    lines.push(empty(leftPad) + projs[5].label);
    for (const row of projs[5].rows) lines.push(empty(leftPad) + row.join(" "));

    lines.push("", `Voxels: ${this.vm.size}`);
    return lines.join("\n");
  }

  _zoom(parts) {
    // ZOOM cx cy cz r [view]
    if (parts.length < 5)
      return "Usage: ZOOM cx cy cz radius [view]\nExample: ZOOM 8 25 7 5 front";
    const cx = parseInt(parts[1]),
      cy = parseInt(parts[2]),
      cz = parseInt(parts[3]);
    const r = parseInt(parts[4]);
    const view = (parts[5] || "front").toLowerCase();

    const crop = {
      x0: Math.max(0, cx - r),
      x1: Math.min(this.g.W, cx + r + 1),
      y0: Math.max(0, cy - r),
      y1: Math.min(this.g.H, cy + r + 1),
      z0: Math.max(0, cz - r),
      z1: Math.min(this.g.D, cz + r + 1),
    };

    // Show requested view + two orthogonal views for context
    const views = [view];
    if (view === "front" || view === "back") views.push("right", "top");
    else if (view === "left" || view === "right") views.push("front", "top");
    else if (view === "top" || view === "bottom") views.push("front", "right");

    const lines = [`ZOOM center=(${cx},${cy},${cz}) radius=${r}`, ""];
    for (const v of views) {
      const proj = projectCropped(this.g, v, crop);
      lines.push(renderView(proj));
      lines.push("");
    }
    return lines.join("\n");
  }

  _focus(parts) {
    // FOCUS x y z w h d [view]
    if (parts.length < 7)
      return "Usage: FOCUS x y z w h d [view]\nExample: FOCUS 5 20 3 10 8 10";
    const x = parseInt(parts[1]),
      y = parseInt(parts[2]),
      z = parseInt(parts[3]);
    const w = parseInt(parts[4]),
      h = parseInt(parts[5]),
      d = parseInt(parts[6]);
    const view = (parts[7] || "front").toLowerCase();

    const crop = {
      x0: Math.max(0, x),
      x1: Math.min(this.g.W, x + w),
      y0: Math.max(0, y),
      y1: Math.min(this.g.H, y + h),
      z0: Math.max(0, z),
      z1: Math.min(this.g.D, z + d),
    };

    const views = [view];
    if (view === "front" || view === "back") views.push("right", "top");
    else if (view === "left" || view === "right") views.push("front", "top");
    else views.push("front", "right");

    const lines = [`FOCUS region=(${x},${y},${z}) size=(${w},${h},${d})`, ""];
    for (const v of views) {
      const proj = projectCropped(this.g, v, crop);
      lines.push(renderView(proj));
      lines.push("");
    }
    return lines.join("\n");
  }

  _slice(parts) {
    // SLICE y=15 or SLICE x=8 or SLICE z=5
    if (parts.length < 2) return "Usage: SLICE axis=value\nExample: SLICE y=15";
    const match = parts[1].match(/^([xyz])=(\d+)$/);
    if (!match) return "Usage: SLICE y=15 | SLICE x=8 | SLICE z=5";
    const axis = match[1],
      value = parseInt(match[2]);

    const max = axis === "x" ? this.g.W : axis === "y" ? this.g.H : this.g.D;
    if (value < 0 || value >= max)
      return `Value ${value} out of range (0-${max - 1}) for ${axis} axis`;

    return renderSlice(this.g, axis, value);
  }

  _compare(parts) {
    // COMPARE front back
    if (parts.length < 3)
      return "Usage: COMPARE view1 view2\nExample: COMPARE front back";
    const v1 = parts[1].toLowerCase(),
      v2 = parts[2].toLowerCase();

    const p1 = projectCropped(this.g, v1);
    const p2 = projectCropped(this.g, v2);

    const pad = (s, len) => s + " ".repeat(Math.max(0, len - s.length));
    const w1 = p1.viewW * 2 + 4;

    const lines = [`COMPARE ${v1} vs ${v2}`, ""];
    const maxH = Math.max(p1.viewH, p2.viewH);
    lines.push(pad(p1.label, w1) + p2.label);
    for (let r = 0; r < maxH; r++) {
      const left = r < p1.viewH ? p1.rows[r].join(" ") : "";
      const right = r < p2.viewH ? p2.rows[r].join(" ") : "";
      lines.push(pad(left, w1) + right);
    }
    return lines.join("\n");
  }

  _around(parts) {
    // AROUND cx cy cz r — show front/right/back/left all cropped to same region
    if (parts.length < 5)
      return "Usage: AROUND cx cy cz radius\nExample: AROUND 8 25 7 5";
    const cx = parseInt(parts[1]),
      cy = parseInt(parts[2]),
      cz = parseInt(parts[3]);
    const r = parseInt(parts[4]);

    const crop = {
      x0: Math.max(0, cx - r),
      x1: Math.min(this.g.W, cx + r + 1),
      y0: Math.max(0, cy - r),
      y1: Math.min(this.g.H, cy + r + 1),
      z0: Math.max(0, cz - r),
      z1: Math.min(this.g.D, cz + r + 1),
    };

    const lines = [`AROUND center=(${cx},${cy},${cz}) radius=${r}`, ""];
    for (const v of ["front", "right", "back", "left"]) {
      const proj = projectCropped(this.g, v, crop);
      lines.push(renderView(proj));
      lines.push("");
    }
    return lines.join("\n");
  }

  // ── Edit Commands ──────────────────────────────────────────────

  _what(parts) {
    // WHAT view col row
    if (parts.length < 4)
      return "Usage: WHAT view col row\nExample: WHAT front 8 5";
    const view = parts[1].toLowerCase();
    const col = parseInt(parts[2]),
      row = parseInt(parts[3]);

    const hit = viewToWorld(this.g, view, col, row);
    if (!hit) {
      return `WHAT ${view} col=${col} row=${row}\n→ Empty (no voxel hit)`;
    }

    const colorName = CNAMES[hit.color] || hit.color;
    const sources = findSourceLine(this.code, hit.x, hit.y, hit.z);
    const sourceText =
      sources.length > 0
        ? sources.map((s) => `  line ${s.line}: ${s.text}`).join("\n")
        : "  (no matching source line found)";

    return [
      `WHAT ${view} col=${col} row=${row}`,
      `→ 3D position: (${hit.x}, ${hit.y}, ${hit.z})`,
      `→ Color: ${colorName} (${hit.color.toString(16)})`,
      `→ Depth: ${hit.depth}`,
      `→ Source:`,
      sourceText,
      `→ To edit: P ${hit.x} ${hit.y} ${hit.z} <color>`,
    ].join("\n");
  }

  _paint(parts) {
    // PAINT view col row color
    if (parts.length < 5)
      return "Usage: PAINT view col row color\nExample: PAINT front 8 5 7";
    const view = parts[1].toLowerCase();
    const col = parseInt(parts[2]),
      row = parseInt(parts[3]);
    const color = parseInt(parts[4], 16);

    // Find what's at this position (or the first empty cell along the ray)
    const hit = viewToWorld(this.g, view, col, row);
    let x, y, z;

    if (hit) {
      // Paint over existing voxel
      x = hit.x;
      y = hit.y;
      z = hit.z;
    } else {
      // No hit — find the surface position (midpoint of the depth axis)
      // For simplicity, place at the front surface of the view
      const { W, H, D } = this.g;
      switch (view) {
        case "front":
          x = col;
          y = H - 1 - row;
          z = 0;
          break;
        case "back":
          x = W - 1 - col;
          y = H - 1 - row;
          z = D - 1;
          break;
        case "right":
          x = W - 1;
          y = H - 1 - row;
          z = col;
          break;
        case "left":
          x = 0;
          y = H - 1 - row;
          z = D - 1 - col;
          break;
        case "top":
          x = col;
          y = H - 1;
          z = D - 1 - row;
          break;
        case "bottom":
          x = col;
          y = 0;
          z = row;
          break;
      }
    }

    if (
      !this.g.grid ||
      x < 0 ||
      x >= this.g.W ||
      y < 0 ||
      y >= this.g.H ||
      z < 0 ||
      z >= this.g.D
    ) {
      return `Out of bounds: (${x}, ${y}, ${z})`;
    }

    const key = `${x},${y},${z}`;
    const oldColor = this.vm.get(key);
    const colorName = CNAMES[color] || color;

    // Apply edit
    this.vm.set(key, color);
    this.g = buildGrid(this.g.W, this.g.H, this.g.D, this.vm);

    const voxi = `P ${x} ${y} ${z} ${color.toString(16)}`;
    this._edits.push(voxi);

    const oldName =
      oldColor !== undefined
        ? ` (was ${CNAMES[oldColor] || oldColor})`
        : " (was empty)";
    return [
      `PAINT ${view} col=${col} row=${row} → ${colorName}`,
      `→ Set (${x}, ${y}, ${z}) = ${colorName}${oldName}`,
      `→ VOXI: ${voxi}`,
    ].join("\n");
  }

  _erase(parts) {
    // ERASE view col row
    if (parts.length < 4)
      return "Usage: ERASE view col row\nExample: ERASE front 8 5";
    const view = parts[1].toLowerCase();
    const col = parseInt(parts[2]),
      row = parseInt(parts[3]);

    const hit = viewToWorld(this.g, view, col, row);
    if (!hit) {
      return `ERASE ${view} col=${col} row=${row}\n→ Already empty (no voxel hit)`;
    }

    const key = `${hit.x},${hit.y},${hit.z}`;
    const colorName = CNAMES[hit.color] || hit.color;

    // Find source line for context
    const sources = findSourceLine(this.code, hit.x, hit.y, hit.z);

    // Remove voxel
    this.vm.delete(key);
    this.g = buildGrid(this.g.W, this.g.H, this.g.D, this.vm);

    this._edits.push(`-- erased (${hit.x}, ${hit.y}, ${hit.z})`);

    const lines = [
      `ERASE ${view} col=${col} row=${row}`,
      `→ Removed (${hit.x}, ${hit.y}, ${hit.z}) was ${colorName}`,
    ];
    if (sources.length > 0) {
      lines.push(`→ Was created by:`);
      for (const s of sources) lines.push(`  line ${s.line}: ${s.text}`);
    }
    return lines.join("\n");
  }

  _diff(parts) {
    // DIFF [view] — show what changed since last SNAP
    const view = parts?.[1]?.toLowerCase();

    const added = [],
      removed = [],
      changed = [];

    // Check all current voxels
    for (const [k, c] of this.vm) {
      const old = this._snapshot.get(k);
      if (old === undefined) {
        added.push({ key: k, color: c });
      } else if (old !== c) {
        changed.push({ key: k, from: old, to: c });
      }
    }
    // Check removed voxels
    for (const [k, c] of this._snapshot) {
      if (!this.vm.has(k)) {
        removed.push({ key: k, color: c });
      }
    }

    if (added.length === 0 && removed.length === 0 && changed.length === 0) {
      return "DIFF: No changes since last SNAP";
    }

    const lines = [
      `DIFF (${added.length} added, ${removed.length} removed, ${changed.length} changed)`,
    ];

    if (added.length > 0) {
      lines.push("");
      lines.push(`+ ADDED (${added.length}):`);
      for (const a of added.slice(0, 20)) {
        lines.push(
          `  + (${a.key}) = ${CNAMES[a.color] || a.color}  →  P ${a.key.replace(/,/g, " ")} ${a.color.toString(16)}`,
        );
      }
      if (added.length > 20) lines.push(`  ... and ${added.length - 20} more`);
    }

    if (removed.length > 0) {
      lines.push("");
      lines.push(`- REMOVED (${removed.length}):`);
      for (const r of removed.slice(0, 20)) {
        lines.push(`  - (${r.key}) was ${CNAMES[r.color] || r.color}`);
      }
      if (removed.length > 20)
        lines.push(`  ... and ${removed.length - 20} more`);
    }

    if (changed.length > 0) {
      lines.push("");
      lines.push(`~ CHANGED (${changed.length}):`);
      for (const c of changed.slice(0, 20)) {
        lines.push(
          `  ~ (${c.key}) ${CNAMES[c.from] || c.from} → ${CNAMES[c.to] || c.to}  →  P ${c.key.replace(/,/g, " ")} ${c.to.toString(16)}`,
        );
      }
      if (changed.length > 20)
        lines.push(`  ... and ${changed.length - 20} more`);
    }

    // Generate VOXI code for all edits
    if (this._edits.length > 0) {
      lines.push("");
      lines.push("VOXI commands to apply:");
      for (const e of this._edits) lines.push(`  ${e}`);
    }

    // If a view is specified, show before/after
    if (view) {
      const validViews = ["front", "back", "left", "right", "top", "bottom"];
      if (validViews.includes(view)) {
        lines.push("");
        lines.push(`View: ${view} (current state after edits)`);
        const proj = projectCropped(this.g, view);
        lines.push(renderView(proj));
      }
    }

    return lines.join("\n");
  }

  _snap() {
    this._snapshot = new Map(this.vm);
    this._edits = [];
    return `SNAP: Baseline saved (${this.vm.size} voxels). Future DIFF will compare against this state.`;
  }

  _terrain(parts) {
    // TERRAIN w h d [seed] [type]
    // type: terrain (default), caves, islands
    if (parts.length < 4)
      return "Usage: TERRAIN w h d [seed] [type]\nExample: TERRAIN 32 16 32 42\nTypes: terrain, caves, islands";
    const w = parseInt(parts[1]),
      h = parseInt(parts[2]),
      d = parseInt(parts[3]);
    const seed = parseInt(parts[4]) || 42;
    const type = (parts[5] || "terrain").toLowerCase();

    const noise = new FastNoiseLite(seed);
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
    noise.SetFrequency(0.05);

    // Rebuild grid at new dimensions
    const vm = new Map();

    if (type === "caves") {
      // 3D noise — solid where noise > threshold
      noise.SetFrequency(0.08);
      for (let x = 0; x < w; x++)
        for (let y = 0; y < h; y++)
          for (let z = 0; z < d; z++) {
            const n = noise.GetNoise(x, y, z);
            if (n > 0.0) {
              const c = y < h * 0.3 ? 9 : y < h * 0.7 ? "a" : "c";
              vm.set(
                `${x},${y},${z}`,
                typeof c === "number"
                  ? c
                  : CNAMES.indexOf(c) >= 0
                    ? CNAMES.indexOf(c)
                    : 9,
              );
            }
          }
    } else if (type === "islands") {
      // Heightmap with distance falloff from center
      for (let x = 0; x < w; x++)
        for (let z = 0; z < d; z++) {
          const cx = x / w - 0.5,
            cz = z / d - 0.5;
          const distFalloff = 1 - Math.sqrt(cx * cx + cz * cz) * 2.5;
          const n = noise.GetNoise(x, z) * 0.5 + 0.5;
          const height = Math.floor(n * distFalloff * h);
          for (let y = 0; y < Math.max(0, height); y++) {
            const c = y === height - 1 ? 2 : y > height - 3 ? 10 : 9;
            vm.set(`${x},${y},${z}`, c);
          }
          // Water level
          if (height < h * 0.3) {
            for (let y = 0; y < Math.floor(h * 0.3); y++) {
              if (!vm.has(`${x},${y},${z}`)) vm.set(`${x},${y},${z}`, 3);
            }
          }
        }
    } else {
      // Standard terrain heightmap with layers
      for (let x = 0; x < w; x++)
        for (let z = 0; z < d; z++) {
          const n = noise.GetNoise(x, z) * 0.5 + 0.5;
          const height = Math.floor(n * h * 0.8) + 1;
          for (let y = 0; y < height && y < h; y++) {
            let c;
            if (y === height - 1)
              c = 2; // green top
            else if (y > height - 3)
              c = 10; // brown dirt
            else c = 9; // gray stone
            vm.set(`${x},${y},${z}`, c);
          }
        }
    }

    // Apply to current scene
    this.g = buildGrid(w, h, d, vm);
    this.vm = vm;
    this._snapshot = new Map(vm);
    this._edits = [];

    return `TERRAIN ${w}x${h}x${d} seed=${seed} type=${type} — ${vm.size} voxels generated`;
  }

  // ── Animation Commands ──────────────────────────────────────────

  _frames() {
    const { frames, maxFrame } = parseVoxiAnim(this.code);
    const frameNums = [...frames.keys()].sort((a, b) => a - b);
    if (frameNums.length <= 1)
      return "No animation frames (use T N to define frames)";
    const lines = [`FRAMES: ${frameNums.length} keyframes, max=${maxFrame}`];
    for (const fn of frameNums) {
      lines.push(`  T ${fn}: ${frames.get(fn).size} voxels`);
    }
    return lines.join("\n");
  }

  _frame(parts) {
    // FRAME N [view] — show scene at frame N
    if (parts.length < 2)
      return "Usage: FRAME N [view]\nExample: FRAME 5 front";
    const frame = parseInt(parts[1]);
    if (parts[2]) {
      // Single view at frame
      const { W, H, D, frames } = parseVoxiAnim(this.code);
      const frameNums = [...frames.keys()].sort((a, b) => a - b);
      let targetFrame = frameNums[0];
      for (const fn of frameNums) {
        if (fn <= frame) targetFrame = fn;
        else break;
      }
      const vm = frames.get(targetFrame);
      const g = buildGrid(W, H, D, vm);
      const view = parts[2].toLowerCase();
      const proj = projectCropped(g, view);
      return `FRAME ${frame} (keyframe ${targetFrame})\n` + renderView(proj);
    }
    return textViewAtFrame(this.code, frame);
  }

  _fdiff(parts) {
    // FDIFF a b — show diff between frames
    if (parts.length < 3)
      return "Usage: FDIFF frameA frameB\nExample: FDIFF 0 5";
    const a = parseInt(parts[1]),
      b = parseInt(parts[2]);
    return frameDiff(this.code, a, b);
  }

  _info() {
    const { W, H, D } = this.g;
    const total = W * H * D;
    const filled = this.vm.size;
    const colors = {};
    for (const [, c] of this.vm) {
      const name = CNAMES[c] || c;
      colors[name] = (colors[name] || 0) + 1;
    }
    const colorList = Object.entries(colors)
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `  ${n}: ${c}`)
      .join("\n");

    // Bounding box of filled voxels
    let minX = W,
      maxX = 0,
      minY = H,
      maxY = 0,
      minZ = D,
      maxZ = 0;
    for (const [k] of this.vm) {
      const [x, y, z] = k.split(",").map(Number);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    return [
      `INFO`,
      `Grid: ${W}x${H}x${D} (${total} cells)`,
      `Filled: ${filled} voxels (${((filled / total) * 100).toFixed(1)}%)`,
      `Bounding box: (${minX},${minY},${minZ}) to (${maxX},${maxY},${maxZ})`,
      `  size: ${maxX - minX + 1}x${maxY - minY + 1}x${maxZ - minZ + 1}`,
      `Colors:`,
      colorList,
    ].join("\n");
  }

  _help() {
    return `MIND'S EYE — Interactive 3D camera for VOXI scenes

View Commands:
  LOOK front|back|left|right|top|bottom   Full view with rulers
  WIDE                                    All 6 views tiled
  ZOOM cx cy cz r [view]                  Zoom into region
  FOCUS x y z w h d [view]               Crop to box
  SLICE x=N | y=N | z=N                  Cross-section (colors)
  COMPARE view1 view2                    Side by side
  AROUND cx cy cz r                      4 views orbiting point

Edit Commands:
  WHAT view col row                      Identify voxel → 3D coord + source
  PAINT view col row color               Set voxel, get VOXI code back
  ERASE view col row                     Remove voxel at view position
  DIFF [view]                            Changes since last SNAP
  SNAP                                   Save baseline for DIFF

Animation:
  FRAMES                                 List all keyframes
  FRAME N [view]                         View scene at frame N
  FDIFF frameA frameB                    Diff between frames (motion detection)

System:
  INFO                                   Stats & bounding box
  RELOAD                                 Re-parse VOXI source
  HELP                                   This message`;
  }
}

// ── CLI Mode ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(
    `Usage: node minds-eye.js <scene.voxi> | --code "V 16 16 16\\nS 8 8 8 5 7"`,
  );
  process.exit(1);
}

let code;
if (args[0] === "--code") {
  code = args.slice(1).join(" ").replace(/\\n/g, "\n");
} else {
  const filePath = args[0];
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  code = fs.readFileSync(filePath, "utf-8");
}

const eye = new MindsEye(code);
console.log(
  `Mind's Eye loaded: ${eye.g.W}x${eye.g.H}x${eye.g.D}, ${eye.vm.size} voxels`,
);
console.log("Type HELP for commands, Ctrl+C to exit.\n");

// Check if stdin is a pipe (non-interactive)
if (!process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (line.trim()) console.log(eye.exec(line.trim()) + "\n");
  }
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q) => new Promise((r) => rl.question(q, r));
  while (true) {
    const input = await ask("eye> ");
    if (!input.trim()) continue;
    if (["quit", "exit", "q"].includes(input.trim().toLowerCase())) break;
    console.log(eye.exec(input.trim()));
    console.log("");
  }
  rl.close();
}
