/**
 * Mind's Eye v2 — Universal visual thinking space.
 *
 * Not just 3D voxels — any visualization that helps reasoning.
 * Everything renders to structured text the LLM can read back.
 *
 * Modes:
 *   plot(data, opts)      — 1D/2D function plots, scatter, line charts
 *   diagram(nodes, edges) — graphs, networks, flow charts
 *   grid(matrix, opts)    — 2D grids, heatmaps, cellular automata
 *   signal(values, opts)  — 1D signals, waveforms, timelines
 *   field3d(voxiCode)     — 3D voxel depth maps (existing Mind's Eye)
 *   sketch(lines)         — free-form 2D line drawing on ASCII canvas
 *   table(rows, cols)     — structured data comparison
 *
 * All outputs are pure text. No images, no GPU, no browser.
 * The LLM reads the output and reasons about what it sees.
 */

// ═══════════════════════════════════════════════════════════════
// 1D: SIGNAL — waveforms, timelines, value tracking
// ═══════════════════════════════════════════════════════════════

export function signal(values, opts = {}) {
  const width = opts.width ?? 60;
  const height = opts.height ?? 15;
  const label = opts.label ?? "signal";
  const markers = opts.markers ?? {}; // {index: "label"}

  const min = opts.min ?? Math.min(...values);
  const max = opts.max ?? Math.max(...values);
  const range = max - min || 1;

  // Build canvas
  const canvas = Array.from({ length: height }, () => Array(width).fill(" "));

  // Plot values
  const step = Math.max(1, Math.floor(values.length / width));
  for (let col = 0; col < width && col * step < values.length; col++) {
    const val = values[col * step];
    const row = height - 1 - Math.round(((val - min) / range) * (height - 1));
    const clamped = Math.max(0, Math.min(height - 1, row));
    canvas[clamped][col] = markers[col * step] ? "X" : "*";
  }

  // Render with axis
  const lines = [`${label} (min=${min.toFixed(2)}, max=${max.toFixed(2)}, n=${values.length})`];
  for (let r = 0; r < height; r++) {
    const yVal = max - (r / (height - 1)) * range;
    const yLabel = yVal.toFixed(1).padStart(8);
    lines.push(`${yLabel} │${canvas[r].join("")}│`);
  }
  lines.push(`${"".padStart(8)} └${"─".repeat(width)}┘`);

  // X-axis labels
  const xStart = "0".padStart(9);
  const xEnd = String(values.length - 1);
  const xMid = String(Math.floor(values.length / 2));
  lines.push(`${xStart}${xMid.padStart(width / 2)}${xEnd.padStart(width / 2)}`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// 2D: PLOT — function plots, scatter, multi-line charts
// ═══════════════════════════════════════════════════════════════

export function plot(series, opts = {}) {
  const width = opts.width ?? 60;
  const height = opts.height ?? 20;
  const title = opts.title ?? "plot";
  const xLabel = opts.xLabel ?? "x";
  const yLabel = opts.yLabel ?? "y";

  // series = [{data: [{x,y}], char: "*", label: "..."}, ...]
  if (!Array.isArray(series)) series = [{ data: series, char: "*", label: "data" }];

  // Find bounds
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const s of series) {
    for (const p of s.data) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  xMin = opts.xMin ?? xMin; xMax = opts.xMax ?? xMax;
  yMin = opts.yMin ?? yMin; yMax = opts.yMax ?? yMax;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  // Canvas
  const canvas = Array.from({ length: height }, () => Array(width).fill(" "));

  // Plot each series
  const chars = ["*", "o", "+", "x", "#", "@", "~", "^"];
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const ch = s.char ?? chars[si % chars.length];
    for (const p of s.data) {
      const col = Math.round(((p.x - xMin) / xRange) * (width - 1));
      const row = height - 1 - Math.round(((p.y - yMin) / yRange) * (height - 1));
      if (col >= 0 && col < width && row >= 0 && row < height) {
        canvas[row][col] = ch;
      }
    }
  }

  // Render
  const lines = [title];
  const legend = series.map((s, i) => `${s.char ?? chars[i % chars.length]}=${s.label ?? `series${i}`}`).join("  ");
  if (series.length > 1) lines.push(`  ${legend}`);

  for (let r = 0; r < height; r++) {
    const yVal = yMax - (r / (height - 1)) * yRange;
    const yLbl = yVal.toFixed(1).padStart(8);
    lines.push(`${yLbl} │${canvas[r].join("")}│`);
  }
  lines.push(`${"".padStart(8)} └${"─".repeat(width)}┘`);
  lines.push(`${" ".repeat(9)}${xLabel}: ${xMin.toFixed(1)}${"".padStart(width - 20)}${xMax.toFixed(1)}`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// 2D: GRID — heatmaps, matrices, cellular automata
// ═══════════════════════════════════════════════════════════════

export function grid(matrix, opts = {}) {
  const title = opts.title ?? "grid";
  const chars = opts.chars ?? " ░▒▓█";  // density chars low→high
  const showValues = opts.showValues ?? false;
  const showAxes = opts.showAxes ?? true;

  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  // Find range for normalization
  let min = Infinity, max = -Infinity;
  for (const row of matrix) for (const v of row) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;

  const lines = [`${title} (${cols}x${rows}, min=${min.toFixed(2)}, max=${max.toFixed(2)})`];

  // Column numbers
  if (showAxes && cols <= 40) {
    const colNums = "   " + Array.from({ length: cols }, (_, i) => (i % 10).toString()).join(" ");
    lines.push(colNums);
  }

  for (let r = 0; r < rows; r++) {
    const rowLabel = showAxes ? String(r).padStart(2) + " " : "";
    let rowStr;

    if (showValues) {
      rowStr = matrix[r].map(v => {
        if (v === 0) return ".";
        return v.toFixed(1).padStart(4);
      }).join(" ");
    } else {
      rowStr = matrix[r].map(v => {
        const normalized = (v - min) / range;
        const idx = Math.min(chars.length - 1, Math.floor(normalized * chars.length));
        return chars[idx];
      }).join(" ");
    }
    lines.push(rowLabel + rowStr);
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// GRAPH: DIAGRAM — nodes and edges, networks, trees
// ═══════════════════════════════════════════════════════════════

export function diagram(nodes, edges, opts = {}) {
  const title = opts.title ?? "diagram";
  const style = opts.style ?? "list"; // "list", "matrix", "ascii"

  const lines = [title, ""];

  if (style === "matrix") {
    // Adjacency matrix
    const nodeNames = nodes.map(n => typeof n === "string" ? n : n.id);
    const idx = Object.fromEntries(nodeNames.map((n, i) => [n, i]));
    const size = nodeNames.length;
    const mat = Array.from({ length: size }, () => Array(size).fill("."));

    for (const e of edges) {
      const from = typeof e.from === "string" ? e.from : e[0];
      const to = typeof e.to === "string" ? e.to : e[1];
      const label = e.label ?? e[2] ?? "1";
      if (idx[from] !== undefined && idx[to] !== undefined) {
        mat[idx[from]][idx[to]] = String(label).charAt(0);
      }
    }

    // Render
    const maxLen = Math.max(...nodeNames.map(n => n.length));
    const header = " ".repeat(maxLen + 2) + nodeNames.map(n => n.padStart(maxLen)).join(" ");
    lines.push(header);
    for (let r = 0; r < size; r++) {
      lines.push(nodeNames[r].padStart(maxLen) + " │" + mat[r].map(v => v.padStart(maxLen)).join(" "));
    }
  } else if (style === "ascii") {
    // Simple ASCII diagram — place nodes and draw connections
    const nodeNames = nodes.map(n => typeof n === "string" ? n : n.id);
    for (const n of nodeNames) {
      const outEdges = edges.filter(e => (e.from ?? e[0]) === n);
      if (outEdges.length > 0) {
        const targets = outEdges.map(e => {
          const to = e.to ?? e[1];
          const label = e.label ?? e[2] ?? "";
          return label ? `─${label}─▶ [${to}]` : `──▶ [${to}]`;
        });
        lines.push(`[${n}] ${targets.join("  ")}`);
      } else {
        lines.push(`[${n}]`);
      }
    }
  } else {
    // List style (default) — structured and parseable
    lines.push("Nodes:");
    for (const n of nodes) {
      const id = typeof n === "string" ? n : n.id;
      const attrs = typeof n === "object" ? Object.entries(n).filter(([k]) => k !== "id").map(([k, v]) => `${k}=${v}`).join(", ") : "";
      lines.push(`  [${id}]${attrs ? " " + attrs : ""}`);
    }
    lines.push("Edges:");
    for (const e of edges) {
      const from = e.from ?? e[0];
      const to = e.to ?? e[1];
      const label = e.label ?? e[2] ?? "";
      lines.push(`  ${from} → ${to}${label ? " (" + label + ")" : ""}`);
    }
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// SKETCH: Free-form 2D drawing on ASCII canvas
// ═══════════════════════════════════════════════════════════════

export function sketch(width, height, commands) {
  // commands: [{type: "line", x1, y1, x2, y2, char}, {type: "rect", ...}, {type: "text", x, y, text}, ...]
  const canvas = Array.from({ length: height }, () => Array(width).fill(" "));

  function setPixel(x, y, ch) {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) canvas[iy][ix] = ch;
  }

  function drawLine(x1, y1, x2, y2, ch = "*") {
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const steps = Math.max(dx, dy) || 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      setPixel(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, ch);
    }
  }

  function drawRect(x, y, w, h, ch = "#") {
    drawLine(x, y, x + w, y, ch);
    drawLine(x + w, y, x + w, y + h, ch);
    drawLine(x + w, y + h, x, y + h, ch);
    drawLine(x, y + h, x, y, ch);
  }

  function drawCircle(cx, cy, r, ch = "o") {
    for (let a = 0; a < 64; a++) {
      const angle = (a / 64) * 2 * Math.PI;
      setPixel(cx + r * Math.cos(angle), cy + r * 0.5 * Math.sin(angle), ch);
    }
  }

  function drawText(x, y, text) {
    for (let i = 0; i < text.length; i++) {
      setPixel(x + i, y, text[i]);
    }
  }

  function drawArrow(x1, y1, x2, y2, ch = "-") {
    drawLine(x1, y1, x2, y2, ch);
    // Arrowhead
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    if (Math.abs(dx) > Math.abs(dy)) {
      setPixel(x2, y2, dx > 0 ? ">" : "<");
    } else {
      setPixel(x2, y2, dy > 0 ? "v" : "^");
    }
  }

  function fillRect(x, y, w, h, ch = "░") {
    for (let dy = 0; dy <= h; dy++) {
      for (let dx = 0; dx <= w; dx++) {
        setPixel(x + dx, y + dy, ch);
      }
    }
  }

  for (const cmd of commands) {
    switch (cmd.type) {
      case "line": drawLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.char ?? "*"); break;
      case "rect": drawRect(cmd.x, cmd.y, cmd.w, cmd.h, cmd.char ?? "#"); break;
      case "fill": fillRect(cmd.x, cmd.y, cmd.w, cmd.h, cmd.char ?? "░"); break;
      case "circle": drawCircle(cmd.cx, cmd.cy, cmd.r, cmd.char ?? "o"); break;
      case "text": drawText(cmd.x, cmd.y, cmd.text); break;
      case "arrow": drawArrow(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.char ?? "-"); break;
      case "point": setPixel(cmd.x, cmd.y, cmd.char ?? "*"); break;
    }
  }

  return canvas.map(row => row.join("")).join("\n");
}

// ═══════════════════════════════════════════════════════════════
// TABLE — structured data comparison
// ═══════════════════════════════════════════════════════════════

export function table(headers, rows, opts = {}) {
  const title = opts.title ?? "";

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const dataMax = Math.max(...rows.map(r => String(r[i] ?? "").length));
    return Math.max(h.length, dataMax) + 2;
  });

  const lines = [];
  if (title) lines.push(title);

  // Header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join("│");
  const separator = widths.map(w => "─".repeat(w)).join("┼");
  lines.push(headerLine);
  lines.push(separator);

  // Rows
  for (const row of rows) {
    const line = row.map((v, i) => String(v ?? "").padEnd(widths[i])).join("│");
    lines.push(line);
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// PHASE PORTRAIT — 2D vector field visualization
// ═══════════════════════════════════════════════════════════════

export function vectorField(fn, opts = {}) {
  const width = opts.width ?? 40;
  const height = opts.height ?? 20;
  const xMin = opts.xMin ?? -2;
  const xMax = opts.xMax ?? 2;
  const yMin = opts.yMin ?? -2;
  const yMax = opts.yMax ?? 2;
  const title = opts.title ?? "vector field";

  // Arrow characters based on direction
  const arrows = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"];

  const canvas = Array.from({ length: height }, () => Array(width).fill(" "));
  const step = 2; // sample every 2 cells

  for (let row = 0; row < height; row += step) {
    for (let col = 0; col < width; col += step) {
      const x = xMin + (col / (width - 1)) * (xMax - xMin);
      const y = yMax - (row / (height - 1)) * (yMax - yMin);
      const { dx, dy } = fn(x, y);
      const mag = Math.sqrt(dx * dx + dy * dy);

      if (mag < 0.01) {
        canvas[row][col] = "·";
        continue;
      }

      // Angle to arrow character
      let angle = Math.atan2(-dy, dx); // -dy because screen Y is flipped
      if (angle < 0) angle += 2 * Math.PI;
      const idx = Math.round((angle / (2 * Math.PI)) * 8) % 8;
      canvas[row][col] = arrows[idx];
    }
  }

  const lines = [title, `  x: [${xMin}, ${xMax}]  y: [${yMin}, ${yMax}]`];
  for (const row of canvas) lines.push("  " + row.join(""));
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// THINK — The unified interface. I choose the best mode.
// ═══════════════════════════════════════════════════════════════

export function think(description, ...args) {
  // This is the entry point — I describe WHAT I want to see,
  // and the system helps me choose HOW to see it.
  // For now it's a passthrough to the specific functions above.
  // Later it could auto-detect the best visualization mode.
  return `[Mind's Eye: ${description}]\n${args.join("\n")}`;
}
