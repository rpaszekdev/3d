/**
 * text-view.js — Project a VOXI 3D voxel grid into 6 orthographic depth maps
 * rendered as a single text blueprint that an LLM can read and reason about.
 *
 * No images. No vision model. Pure text spatial perception.
 *
 * Usage:
 *   import { textView, textViewFromCode } from './text-view.js';
 *
 *   // From parsed voxel data:
 *   const blueprint = textView(gridW, gridH, gridD, voxels);
 *
 *   // From raw VOXI code string:
 *   const blueprint = textViewFromCode(voxiCode);
 *
 *   console.log(blueprint);
 */

// ── VOXI Parser (standalone, matches v4-voxel.html exactly) ────────

function parseVoxi(code) {
  let W = 32,
    H = 32,
    D = 32;
  const vm = new Map();

  const set = (x, y, z, c) => {
    const ix = Math.round(x),
      iy = Math.round(y),
      iz = Math.round(z);
    if (ix >= 0 && ix < W && iy >= 0 && iy < H && iz >= 0 && iz < D)
      vm.set(`${ix},${iy},${iz}`, Math.min(Math.max(c || 9, 0), 15));
  };

  const addBox = (px, py, pz, w, h, d, c) => {
    for (let x = px; x < px + w; x++)
      for (let y = py; y < py + h; y++)
        for (let z = pz; z < pz + d; z++) set(x, y, z, c);
  };

  const addSphere = (cx, cy, cz, r, c) => {
    const r2 = r * r;
    for (let x = cx - r; x <= cx + r; x++)
      for (let y = cy - r; y <= cy + r; y++)
        for (let z = cz - r; z <= cz + r; z++)
          if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r2)
            set(x, y, z, c);
  };

  const addCyl = (cx, cy, cz, r, h, c) => {
    const r2 = r * r;
    for (let x = cx - r; x <= cx + r; x++)
      for (let z = cz - r; z <= cz + r; z++)
        if ((x - cx) ** 2 + (z - cz) ** 2 <= r2)
          for (let y = cy; y < cy + h; y++) set(x, y, z, c);
  };

  const addCone = (cx, cy, cz, r, h, c) => {
    for (let y = 0; y < h; y++) {
      const rr = r * (1 - y / h),
        rr2 = rr * rr;
      for (let x = cx - r; x <= cx + r; x++)
        for (let z = cz - r; z <= cz + r; z++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= rr2)
            set(cx + (x - cx), cy + y, cz + (z - cz), c);
    }
  };

  const addEllipsoid = (cx, cy, cz, rx, ry, rz, c) => {
    for (let x = cx - rx; x <= cx + rx; x++)
      for (let y = cy - ry; y <= cy + ry; y++)
        for (let z = cz - rz; z <= cz + rz; z++)
          if (
            ((x - cx) / rx) ** 2 +
              ((y - cy) / ry) ** 2 +
              ((z - cz) / rz) ** 2 <=
            1
          )
            set(x, y, z, c);
  };

  const addDome = (px, py, pz, w, h, d, c) => {
    const rx = w / 2,
      ry = h,
      rz = d / 2,
      cx = px + rx,
      cz = pz + rz;
    for (let x = px; x < px + w; x++)
      for (let y = py; y < py + h; y++)
        for (let z = pz; z < pz + d; z++)
          if (
            ((x - cx + 0.5) / rx) ** 2 +
              ((y - py) / ry) ** 2 +
              ((z - cz + 0.5) / rz) ** 2 <=
            1
          )
            set(x, y, z, c);
  };

  // Groups
  const groups = {};
  let currentGroup = null;
  let currentGroupName = null;
  let scale = 1;

  function scaled(cmd, n) {
    if (scale === 1) return n;
    const s = [...n];
    switch (cmd) {
      case "B":
      case "D":
        s[0] = Math.round(s[0] * scale);
        s[1] = Math.round(s[1] * scale);
        s[2] = Math.round(s[2] * scale);
        s[3] = Math.max(1, Math.round(s[3] * scale));
        s[4] = Math.max(1, Math.round(s[4] * scale));
        s[5] = Math.max(1, Math.round(s[5] * scale));
        break;
      case "S":
        s[0] = Math.round(s[0] * scale);
        s[1] = Math.round(s[1] * scale);
        s[2] = Math.round(s[2] * scale);
        s[3] = Math.max(1, Math.round(s[3] * scale));
        break;
      case "C":
      case "K":
        s[0] = Math.round(s[0] * scale);
        s[1] = Math.round(s[1] * scale);
        s[2] = Math.round(s[2] * scale);
        s[3] = Math.max(1, Math.round(s[3] * scale));
        s[4] = Math.max(1, Math.round(s[4] * scale));
        break;
      case "P":
        s[0] = Math.round(s[0] * scale);
        s[1] = Math.round(s[1] * scale);
        s[2] = Math.round(s[2] * scale);
        break;
      case "E":
        s[0] = Math.round(s[0] * scale);
        s[1] = Math.round(s[1] * scale);
        s[2] = Math.round(s[2] * scale);
        s[3] = Math.max(1, Math.round(s[3] * scale));
        s[4] = Math.max(1, Math.round(s[4] * scale));
        s[5] = Math.max(1, Math.round(s[5] * scale));
        break;
    }
    return s;
  }

  function execCmd(cmd, n) {
    const sn = scaled(cmd, n);
    switch (cmd) {
      case "B":
        addBox(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5], sn[6]);
        break;
      case "S":
        addSphere(sn[0], sn[1], sn[2], sn[3], sn[4]);
        break;
      case "C":
        addCyl(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5]);
        break;
      case "K":
        addCone(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5]);
        break;
      case "P":
        set(sn[0], sn[1], sn[2], sn[3]);
        break;
      case "E":
        addEllipsoid(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5], sn[6]);
        break;
      case "D":
        addDome(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5], sn[6]);
        break;
      default:
        return false;
    }
    return true;
  }

  function placeGroup(name, ox, oy, oz) {
    const g = groups[name];
    if (!g) return;
    const sox = Math.round(ox * scale),
      soy = Math.round(oy * scale),
      soz = Math.round(oz * scale);
    for (const entry of g) {
      const sn = scaled(entry.cmd, entry.args);
      sn[0] += sox;
      sn[1] += soy;
      sn[2] += soz;
      switch (entry.cmd) {
        case "B":
          addBox(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5], sn[6]);
          break;
        case "S":
          addSphere(sn[0], sn[1], sn[2], sn[3], sn[4]);
          break;
        case "C":
          addCyl(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5]);
          break;
        case "K":
          addCone(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5]);
          break;
        case "P":
          set(sn[0], sn[1], sn[2], sn[3]);
          break;
        case "E":
          addEllipsoid(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5], sn[6]);
          break;
        case "D":
          addDome(sn[0], sn[1], sn[2], sn[3], sn[4], sn[5], sn[6]);
          break;
      }
    }
  }

  const CKEYS = "0123456789abcdef";

  const allLines = code.split("\n");
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line || line.startsWith("--") || line.startsWith("//")) continue;
    const p = line.split(/\s+/);
    const cmd = p[0].toUpperCase();

    if (cmd === "G") {
      currentGroupName = p[1] || `g${i}`;
      currentGroup = [];
      continue;
    }
    if (cmd === "/G") {
      if (currentGroup && currentGroupName)
        groups[currentGroupName] = currentGroup;
      currentGroup = null;
      currentGroupName = null;
      continue;
    }
    if (cmd === "@") {
      placeGroup(p[1], Number(p[2]) || 0, Number(p[3]) || 0, Number(p[4]) || 0);
      continue;
    }
    if (cmd === "V") {
      W = Number(p[1]) || 32;
      H = Number(p[2]) || 32;
      D = Number(p[3]) || 32;
      continue;
    }
    if (cmd === "R") {
      scale = Number(p[1]) || 1;
      continue;
    }

    const parseArg = (s, isColor) => {
      if (isColor && /^[a-f]$/i.test(s)) return CKEYS.indexOf(s.toLowerCase());
      return Number(s);
    };
    const rawArgs = p.slice(1);
    const n = rawArgs.map((s, idx) => parseArg(s, idx === rawArgs.length - 1));
    execCmd(cmd, n);

    if (currentGroup) currentGroup.push({ cmd, args: n });
  }

  return { W, H, D, vm };
}

// ── 3D Grid Helper ─────────────────────────────────────────────────

function buildGrid(W, H, D, vm) {
  // Dense 3D array: grid[x][y][z] = -1 (empty) or color (0-15)
  const grid = new Int8Array(W * H * D).fill(-1);
  const idx = (x, y, z) => x + y * W + z * W * H;

  for (const [k, c] of vm) {
    const [x, y, z] = k.split(",").map(Number);
    grid[idx(x, y, z)] = c;
  }

  return { grid, idx, W, H, D };
}

// ── Projection Engine ──────────────────────────────────────────────

/**
 * Project along an axis, returning a 2D depth map.
 * Each cell = depth (0-9 quantized) of first hit, or '.' for empty.
 *
 * @param {Object} g - grid object from buildGrid
 * @param {string} view - 'front'|'back'|'left'|'right'|'top'|'bottom'
 * @returns {Object} { rows: string[][], viewW, viewH, label }
 */
function projectView(g, view) {
  const { grid, idx, W, H, D } = g;
  let viewW, viewH, maxDepth, label;
  let getVoxel; // (col, row, depth) => grid value

  // Each view defines:
  //   - what the 2D axes map to (cols, rows)
  //   - which 3D axis is the depth axis
  //   - which direction to scan (front-to-back)
  //   - rows go top-to-bottom visually (Y high = top row)

  switch (view) {
    case "front": // Looking along +Z (from z=0 inward)
      viewW = W;
      viewH = H;
      maxDepth = D;
      label = "FRONT (→X, ↑Y)";
      getVoxel = (col, row, d) => grid[idx(col, viewH - 1 - row, d)];
      break;
    case "back": // Looking along -Z (from z=D-1 inward)
      viewW = W;
      viewH = H;
      maxDepth = D;
      label = "BACK (→X, ↑Y)";
      getVoxel = (col, row, d) =>
        grid[idx(viewW - 1 - col, viewH - 1 - row, D - 1 - d)];
      break;
    case "right": // Looking along -X (from x=W-1 inward)
      viewW = D;
      viewH = H;
      maxDepth = W;
      label = "RIGHT (→Z, ↑Y)";
      getVoxel = (col, row, d) => grid[idx(W - 1 - d, viewH - 1 - row, col)];
      break;
    case "left": // Looking along +X (from x=0 inward)
      viewW = D;
      viewH = H;
      maxDepth = W;
      label = "LEFT (→Z, ↑Y)";
      getVoxel = (col, row, d) =>
        grid[idx(d, viewH - 1 - row, viewW - 1 - col)];
      break;
    case "top": // Looking along -Y (from y=H-1 downward)
      viewW = W;
      viewH = D;
      maxDepth = H;
      label = "TOP (→X, ↑Z)";
      getVoxel = (col, row, d) => grid[idx(col, H - 1 - d, viewH - 1 - row)];
      break;
    case "bottom": // Looking along +Y (from y=0 upward)
      viewW = W;
      viewH = D;
      maxDepth = H;
      label = "BOTTOM (→X, ↑Z)";
      getVoxel = (col, row, d) => grid[idx(col, d, row)];
      break;
  }

  const rows = [];
  for (let row = 0; row < viewH; row++) {
    const line = [];
    for (let col = 0; col < viewW; col++) {
      let hit = -1;
      let hitDepth = -1;
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
        // Quantize depth to 0-9
        const q =
          maxDepth <= 1 ? 0 : Math.round((hitDepth * 9) / (maxDepth - 1));
        line.push(String(q));
      }
    }
    rows.push(line);
  }

  return { rows, viewW, viewH, label };
}

// ── Blueprint Tiler ────────────────────────────────────────────────

/**
 * Tile 6 projections into a single text blueprint (cube net layout).
 *
 * Layout:
 *              ┌───────┐
 *              │  TOP  │
 *   ┌─────────┼───────┼─────────┐
 *   │  LEFT   │ FRONT │  RIGHT  │
 *   └─────────┼───────┼─────────┘
 *              │BOTTOM │
 *              ├───────┤
 *              │ BACK  │
 *              └───────┘
 */
function tileBlueprint(g) {
  const views = {
    top: projectView(g, "top"),
    front: projectView(g, "front"),
    left: projectView(g, "left"),
    right: projectView(g, "right"),
    bottom: projectView(g, "bottom"),
    back: projectView(g, "back"),
  };

  const pad = (str, len) => str + " ".repeat(Math.max(0, len - str.length));
  const empty = (len) => " ".repeat(len);

  // Calculate widths (each cell = 2 chars: value + space)
  const frontW = views.front.viewW * 2;
  const leftW = views.left.viewW * 2;
  const rightW = views.right.viewW * 2;
  const topW = views.top.viewW * 2;
  const leftPad = leftW + 2; // gap between sections

  const lines = [];

  // Header
  lines.push(
    `VOXI TEXT VIEW (${g.W}x${g.H}x${g.D}) — depth 0=close 9=far .=empty`,
  );
  lines.push("");

  // ── TOP ──
  lines.push(empty(leftPad) + views.top.label);
  for (const row of views.top.rows) {
    lines.push(empty(leftPad) + row.join(" "));
  }
  lines.push("");

  // ── LEFT | FRONT | RIGHT ──
  const midH = views.front.viewH;
  // Labels
  lines.push(
    pad(views.left.label, leftPad) +
      pad(views.front.label, frontW + 2) +
      views.right.label,
  );
  for (let r = 0; r < midH; r++) {
    const leftRow = r < views.left.viewH ? views.left.rows[r].join(" ") : "";
    const frontRow = r < views.front.viewH ? views.front.rows[r].join(" ") : "";
    const rightRow = r < views.right.viewH ? views.right.rows[r].join(" ") : "";
    lines.push(pad(leftRow, leftPad) + pad(frontRow, frontW + 2) + rightRow);
  }
  lines.push("");

  // ── BOTTOM ──
  lines.push(empty(leftPad) + views.bottom.label);
  for (const row of views.bottom.rows) {
    lines.push(empty(leftPad) + row.join(" "));
  }
  lines.push("");

  // ── BACK ──
  lines.push(empty(leftPad) + views.back.label);
  for (const row of views.back.rows) {
    lines.push(empty(leftPad) + row.join(" "));
  }

  // Summary
  lines.push("");
  let voxelCount = 0;
  for (let i = 0; i < g.grid.length; i++) {
    if (g.grid[i] >= 0) voxelCount++;
  }
  lines.push(`Voxels: ${voxelCount}`);

  return lines.join("\n");
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Generate text blueprint from voxel map data.
 * @param {number} W - grid width
 * @param {number} H - grid height
 * @param {number} D - grid depth
 * @param {Map} vm - voxel map ("x,y,z" → color)
 */
export function textView(W, H, D, vm) {
  const g = buildGrid(W, H, D, vm);
  return tileBlueprint(g);
}

/**
 * Generate text blueprint directly from VOXI source code.
 * This is the main entry point — parse VOXI, project, return text.
 */
export function textViewFromCode(voxiCode) {
  const { W, H, D, vm } = parseVoxi(voxiCode);
  const g = buildGrid(W, H, D, vm);
  return tileBlueprint(g);
}

/**
 * Get individual view projections (for custom layouts).
 */
export function getProjections(voxiCode) {
  const { W, H, D, vm } = parseVoxi(voxiCode);
  const g = buildGrid(W, H, D, vm);
  return {
    front: projectView(g, "front"),
    back: projectView(g, "back"),
    left: projectView(g, "left"),
    right: projectView(g, "right"),
    top: projectView(g, "top"),
    bottom: projectView(g, "bottom"),
  };
}

// ── Animation Support ──────────────────────────────────────────────

/**
 * Parse VOXI code with animation frames.
 * T N — sets current frame. Commands after T belong to that frame.
 * Commands before any T belong to ALL frames (persistent background).
 *
 * Returns { W, H, D, frames: Map<number, Map<"x,y,z", color>>, maxFrame }
 */
export function parseVoxiAnim(code) {
  const lines = code.split("\n");
  const hasFrames = lines.some((l) => /^\s*T\s+\d+/i.test(l));

  if (!hasFrames) {
    // No animation — return single frame 0
    const { W, H, D, vm } = parseVoxi(code);
    return { W, H, D, frames: new Map([[0, vm]]), maxFrame: 0 };
  }

  // First pass: collect persistent (pre-T) lines and frame blocks
  let W = 32,
    H = 32,
    D = 32;
  const persistentLines = []; // lines before first T
  const frameBlocks = new Map(); // frame# → [lines]
  let currentFrame = -1; // -1 = persistent
  let scale = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("//"))
      continue;

    const p = trimmed.split(/\s+/);
    const cmd = p[0].toUpperCase();

    if (cmd === "V") {
      W = Number(p[1]) || 32;
      H = Number(p[2]) || 32;
      D = Number(p[3]) || 32;
      continue;
    }

    if (cmd === "T") {
      currentFrame = parseInt(p[1]) || 0;
      if (!frameBlocks.has(currentFrame)) frameBlocks.set(currentFrame, []);
      continue;
    }

    if (cmd === "R") {
      // Scale applies to current context
      if (currentFrame === -1) persistentLines.push(trimmed);
      else frameBlocks.get(currentFrame).push(trimmed);
      continue;
    }

    if (currentFrame === -1) {
      persistentLines.push(trimmed);
    } else {
      frameBlocks.get(currentFrame).push(trimmed);
    }
  }

  // Build each frame: persistent + frame-specific
  const frames = new Map();
  const maxFrame = Math.max(0, ...frameBlocks.keys());

  // Get all defined frame numbers, sorted
  const frameNums = [...frameBlocks.keys()].sort((a, b) => a - b);

  for (const fn of frameNums) {
    const frameCode = [
      `V ${W} ${H} ${D}`,
      ...persistentLines,
      ...frameBlocks.get(fn),
    ].join("\n");
    const { vm } = parseVoxi(frameCode);
    frames.set(fn, vm);
  }

  return { W, H, D, frames, maxFrame };
}

/**
 * Generate text blueprint for a specific frame.
 */
export function textViewAtFrame(voxiCode, frame) {
  const { W, H, D, frames, maxFrame } = parseVoxiAnim(voxiCode);

  // Find the closest frame <= requested frame
  const frameNums = [...frames.keys()].sort((a, b) => a - b);
  let targetFrame = frameNums[0];
  for (const fn of frameNums) {
    if (fn <= frame) targetFrame = fn;
    else break;
  }

  const vm = frames.get(targetFrame);
  const g = buildGrid(W, H, D, vm);
  const header = `FRAME ${frame} (keyframe ${targetFrame}, max ${maxFrame})\n`;
  return header + tileBlueprint(g);
}

/**
 * Show what changed between two frames.
 * Returns a text diff: added voxels, removed voxels, moved voxels.
 */
export function frameDiff(voxiCode, frameA, frameB) {
  const { W, H, D, frames } = parseVoxiAnim(voxiCode);
  const frameNums = [...frames.keys()].sort((a, b) => a - b);

  const findFrame = (f) => {
    let best = frameNums[0];
    for (const fn of frameNums) {
      if (fn <= f) best = fn;
      else break;
    }
    return best;
  };

  const vmA = frames.get(findFrame(frameA));
  const vmB = frames.get(findFrame(frameB));

  const added = [];
  const removed = [];
  const changed = []; // same pos, different color

  // Find removed and changed
  for (const [k, cA] of vmA) {
    if (!vmB.has(k)) {
      removed.push({ pos: k, color: cA });
    } else if (vmB.get(k) !== cA) {
      changed.push({ pos: k, from: cA, to: vmB.get(k) });
    }
  }

  // Find added
  for (const [k, cB] of vmB) {
    if (!vmA.has(k)) {
      added.push({ pos: k, color: cB });
    }
  }

  const lines = [`DIFF frame ${frameA} → ${frameB}`];
  lines.push(`  Added:   ${added.length} voxels`);
  lines.push(`  Removed: ${removed.length} voxels`);
  lines.push(`  Changed: ${changed.length} voxels`);

  if (added.length > 0 && added.length <= 20) {
    lines.push("");
    lines.push("  Added:");
    for (const a of added) lines.push(`    + (${a.pos}) color=${a.color}`);
  }
  if (removed.length > 0 && removed.length <= 20) {
    lines.push("");
    lines.push("  Removed:");
    for (const r of removed) lines.push(`    - (${r.pos}) color=${r.color}`);
  }
  if (changed.length > 0 && changed.length <= 20) {
    lines.push("");
    lines.push("  Changed:");
    for (const c of changed) lines.push(`    ~ (${c.pos}) ${c.from}→${c.to}`);
  }

  // Detect motion by grouping removed/added by color and comparing centers
  if (removed.length > 0 && added.length > 0) {
    const center = (voxels) => {
      let sx = 0,
        sy = 0,
        sz = 0;
      for (const v of voxels) {
        const [x, y, z] = v.pos.split(",").map(Number);
        sx += x;
        sy += y;
        sz += z;
      }
      const n = voxels.length;
      return {
        x: Math.round(sx / n),
        y: Math.round(sy / n),
        z: Math.round(sz / n),
      };
    };

    // Group by color
    const removedByColor = new Map();
    const addedByColor = new Map();
    for (const r of removed) {
      if (!removedByColor.has(r.color)) removedByColor.set(r.color, []);
      removedByColor.get(r.color).push(r);
    }
    for (const a of added) {
      if (!addedByColor.has(a.color)) addedByColor.set(a.color, []);
      addedByColor.get(a.color).push(a);
    }

    const motions = [];
    for (const [color, rVoxels] of removedByColor) {
      if (addedByColor.has(color)) {
        const aVoxels = addedByColor.get(color);
        const cR = center(rVoxels);
        const cA = center(aVoxels);
        const dx = cA.x - cR.x,
          dy = cA.y - cR.y,
          dz = cA.z - cR.z;
        if (dx !== 0 || dy !== 0 || dz !== 0) {
          motions.push({
            color,
            count: rVoxels.length,
            from: cR,
            to: cA,
            dx,
            dy,
            dz,
          });
        }
      }
    }

    if (motions.length > 0) {
      lines.push("");
      lines.push("  Motion detected:");
      for (const m of motions) {
        const dir = [];
        if (m.dx > 0) dir.push(`right +${m.dx}`);
        if (m.dx < 0) dir.push(`left ${m.dx}`);
        if (m.dy > 0) dir.push(`up +${m.dy}`);
        if (m.dy < 0) dir.push(`down ${m.dy}`);
        if (m.dz > 0) dir.push(`back +${m.dz}`);
        if (m.dz < 0) dir.push(`forward ${m.dz}`);
        lines.push(
          `    color ${m.color}: (${m.from.x},${m.from.y},${m.from.z}) → (${m.to.x},${m.to.y},${m.to.z}) [${dir.join(", ")}] (${m.count} voxels)`,
        );
      }
    }
  }

  return lines.join("\n");
}

// Re-export parser for direct use
export { parseVoxi };
