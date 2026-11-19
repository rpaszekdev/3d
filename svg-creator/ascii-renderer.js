/**
 * ASCII Rasterizer for SSL
 *
 * Takes a compiled SSL AST and renders it to a character grid.
 * Uses box-drawing and Unicode characters for clean output.
 *
 * Character cells have ~2:1 aspect ratio, so we compensate
 * by treating each cell as 1 unit wide × 2 units tall.
 */

const CHAR_ASPECT = 2.0; // character height / width ratio

// Character palette
const CHARS = {
  empty: " ",
  dot: "·",
  horizontal: "─",
  vertical: "│",
  diagRight: "╱",
  diagLeft: "╲",
  cross: "┼",
  cornerTL: "┌",
  cornerTR: "┐",
  cornerBL: "└",
  cornerBR: "┘",
  circle: "○",
  filled: "█",
  lightFill: "░",
  medFill: "▒",
  text: "T",
};

/**
 * Create a blank grid
 */
function createGrid(cols, rows) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push(new Array(cols).fill(CHARS.empty));
  }
  return grid;
}

/**
 * Safely set a character on the grid
 */
function setChar(grid, col, row, ch) {
  const rows = grid.length;
  const cols = grid[0].length;
  const r = Math.round(row);
  const c = Math.round(col);
  if (r >= 0 && r < rows && c >= 0 && c < cols) {
    // Don't overwrite more "important" characters with less important ones
    const existing = grid[r][c];
    if (existing === CHARS.empty || existing === CHARS.dot) {
      grid[r][c] = ch;
    }
  }
}

/**
 * Draw a line using Bresenham's algorithm with character selection
 */
function drawLine(grid, x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;

  // Choose character based on overall slope
  let ch;
  if (dx === 0) ch = CHARS.vertical;
  else if (dy === 0) ch = CHARS.horizontal;
  else {
    const slope = dy / dx;
    if (slope < 0.5) ch = CHARS.horizontal;
    else if (slope > 2) ch = CHARS.vertical;
    else ch = (sx === sy) ? CHARS.diagLeft : CHARS.diagRight;
  }

  let x = x1, y = y1;
  let err = dx - dy;

  for (let i = 0; i < 1000; i++) { // safety limit
    setChar(grid, x, y, ch);
    if (Math.abs(x - x2) < 1 && Math.abs(y - y2) < 1) break;

    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

/**
 * Draw a rectangle outline
 */
function drawRect(grid, x, y, w, h) {
  // Top edge
  drawLine(grid, x, y, x + w, y);
  // Bottom edge
  drawLine(grid, x, y + h, x + w, y + h);
  // Left edge
  drawLine(grid, x, y, x, y + h);
  // Right edge
  drawLine(grid, x + w, y, x + w, y + h);

  // Corners
  setChar(grid, x, y, CHARS.cornerTL);
  setChar(grid, x + w, y, CHARS.cornerTR);
  setChar(grid, x, y + h, CHARS.cornerBL);
  setChar(grid, x + w, y + h, CHARS.cornerBR);
}

/**
 * Draw a circle using midpoint algorithm
 */
function drawCircle(grid, cx, cy, r, filled) {
  if (r < 1) {
    setChar(grid, cx, cy, filled ? CHARS.filled : CHARS.dot);
    return;
  }

  const steps = Math.max(24, Math.round(r * 8));
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    setChar(grid, px, py, CHARS.circle);
  }

  if (filled) {
    // Simple scanline fill
    for (let row = Math.round(cy - r); row <= Math.round(cy + r); row++) {
      const half = Math.sqrt(Math.max(0, r * r - (row - cy) * (row - cy)));
      for (let col = Math.round(cx - half + 1); col < Math.round(cx + half); col++) {
        setChar(grid, col, row, CHARS.lightFill);
      }
    }
  }
}

/**
 * Draw an ellipse
 */
function drawEllipse(grid, cx, cy, rx, ry) {
  const steps = Math.max(24, Math.round(Math.max(rx, ry) * 8));
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    setChar(grid, px, py, CHARS.circle);
  }
}

/**
 * Parse and draw an SVG path (simplified — handles M, L, Q, C commands)
 */
function drawPath(grid, d) {
  const commands = [];
  const re = /([MLQCZHVAS])\s*([-\d.,\s]*)/gi;
  let match;
  while ((match = re.exec(d)) !== null) {
    const cmd = match[1];
    const nums = match[2].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    commands.push({ cmd: cmd.toUpperCase(), nums });
  }

  let curX = 0, curY = 0;

  for (const { cmd, nums } of commands) {
    switch (cmd) {
      case "M":
        curX = nums[0] || 0;
        curY = nums[1] || 0;
        break;

      case "L":
        drawLine(grid, curX, curY, nums[0], nums[1]);
        curX = nums[0];
        curY = nums[1];
        break;

      case "H":
        drawLine(grid, curX, curY, nums[0], curY);
        curX = nums[0];
        break;

      case "V":
        drawLine(grid, curX, curY, curX, nums[0]);
        curY = nums[0];
        break;

      case "Q": {
        // Quadratic bezier: control point (cx,cy), end (ex,ey)
        const [cx, cy, ex, ey] = nums;
        const steps = 20;
        let px = curX, py = curY;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const t1 = 1 - t;
          const nx = t1 * t1 * curX + 2 * t1 * t * cx + t * t * ex;
          const ny = t1 * t1 * curY + 2 * t1 * t * cy + t * t * ey;
          drawLine(grid, px, py, nx, ny);
          px = nx;
          py = ny;
        }
        curX = ex;
        curY = ey;
        break;
      }

      case "C": {
        // Cubic bezier: c1(x,y), c2(x,y), end(x,y)
        const [c1x, c1y, c2x, c2y, ex, ey] = nums;
        const steps = 24;
        let px = curX, py = curY;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const t1 = 1 - t;
          const nx = t1*t1*t1*curX + 3*t1*t1*t*c1x + 3*t1*t*t*c2x + t*t*t*ex;
          const ny = t1*t1*t1*curY + 3*t1*t1*t*c1y + 3*t1*t*t*c2y + t*t*t*ey;
          drawLine(grid, px, py, nx, ny);
          px = nx;
          py = ny;
        }
        curX = ex;
        curY = ey;
        break;
      }

      case "A": {
        // Arc — simplified: just draw a line to endpoint
        const ex = nums[5] || curX;
        const ey = nums[6] || curY;
        drawLine(grid, curX, curY, ex, ey);
        curX = ex;
        curY = ey;
        break;
      }

      case "Z":
        // Close path — we'd need to track start point, skip for now
        break;
    }
  }
}

/**
 * Draw text label
 */
function drawText(grid, x, y, content) {
  for (let i = 0; i < content.length; i++) {
    setChar(grid, x + i, y, content[i]);
  }
}

/**
 * Render an SSL AST to ASCII art string.
 *
 * @param {object} ast - The parsed SSL AST from compiler.js
 * @param {object} options - { cols, rows } for grid size
 * @returns {string} ASCII art representation
 */
export function renderASCII(ast, options = {}) {
  const sceneW = ast.width || 800;
  const sceneH = ast.height || 500;

  // Grid dimensions — adjust for character aspect ratio
  const cols = options.cols || Math.min(120, Math.max(60, Math.round(sceneW / 8)));
  const rows = options.rows || Math.round(cols * (sceneH / sceneW) / CHAR_ASPECT);

  const grid = createGrid(cols, rows);

  // Scale factors from scene coords to grid coords
  const sx = (cols - 1) / sceneW;
  const sy = (rows - 1) / sceneH;

  function toGrid(x, y) {
    return [x * sx, y * sy];
  }

  function renderNode(node, offsetX, offsetY) {
    if (node.type === "group") {
      const atParts = node.attrs.at ? node.attrs.at.split(",").map(Number) : [0, 0];
      const gx = offsetX + atParts[0];
      const gy = offsetY + atParts[1];

      for (const child of node.children) {
        renderNode(child, gx, gy);
      }
      return;
    }

    if (node.type !== "primitive") return;

    const args = node.args;
    const isFilled = node.styles.fill && node.styles.fill !== "none";

    switch (node.kind) {
      case "circle": {
        const [cx, cy] = toGrid(offsetX + args.cx, offsetY + args.cy);
        const r = args.r * sx; // scale radius
        drawCircle(grid, cx, cy, r, isFilled);
        break;
      }

      case "rect": {
        const [x, y] = toGrid(offsetX + args.x, offsetY + args.y);
        const w = args.w * sx;
        const h = args.h * sy;
        if (w > 0 && h > 0) {
          drawRect(grid, x, y, w, h);
        }
        break;
      }

      case "ellipse": {
        const [cx, cy] = toGrid(offsetX + args.cx, offsetY + args.cy);
        const rx = args.rx * sx;
        const ry = args.ry * sy;
        drawEllipse(grid, cx, cy, rx, ry);
        break;
      }

      case "line": {
        const [x1, y1] = toGrid(offsetX + args.x1, offsetY + args.y1);
        const [x2, y2] = toGrid(offsetX + args.x2, offsetY + args.y2);
        drawLine(grid, x1, y1, x2, y2);
        break;
      }

      case "polyline": {
        for (let i = 0; i < args.points.length - 1; i++) {
          const [x1, y1] = toGrid(offsetX + args.points[i].x, offsetY + args.points[i].y);
          const [x2, y2] = toGrid(offsetX + args.points[i + 1].x, offsetY + args.points[i + 1].y);
          drawLine(grid, x1, y1, x2, y2);
        }
        break;
      }

      case "path": {
        // Transform the path data coordinates to grid space
        // We'll render the path at offset, then the path drawing handles its own coords
        // Need to offset M commands
        const d = args.d;
        // Parse and offset all coordinates in the path
        const offsetD = offsetPathData(d, offsetX, offsetY);
        // Now scale to grid
        const scaledD = scalePathData(offsetD, sx, sy);
        drawPath(grid, scaledD);
        break;
      }

      case "text": {
        const [x, y] = toGrid(offsetX + args.x, offsetY + args.y);
        drawText(grid, Math.round(x), Math.round(y), args.content || "");
        break;
      }

      case "arc": {
        // Approximate as a path
        const cx = offsetX + args.cx;
        const cy = offsetY + args.cy;
        const r = args.r;
        const startRad = (args.startDeg * Math.PI) / 180;
        const endRad = (args.endDeg * Math.PI) / 180;
        const steps = 20;
        let px, py;
        for (let i = 0; i <= steps; i++) {
          const angle = startRad + (endRad - startRad) * (i / steps);
          const ax = cx + r * Math.cos(angle);
          const ay = cy + r * Math.sin(angle);
          const [gx, gy] = toGrid(ax, ay);
          if (i > 0) drawLine(grid, px, py, gx, gy);
          px = gx;
          py = gy;
        }
        break;
      }
    }
  }

  // Render all children
  for (const child of ast.children) {
    renderNode(child, 0, 0);
  }

  // Draw border
  const border = "─".repeat(cols);
  const lines = grid.map(row => "│" + row.join("") + "│");

  return "┌" + border + "┐\n" + lines.join("\n") + "\n└" + border + "┘";
}

/**
 * Offset all coordinates in an SVG path data string
 */
function offsetPathData(d, ox, oy) {
  // Replace coordinate pairs after commands
  let result = "";
  const re = /([MLQCZHVAS])\s*([-\d.,\s]*)/gi;
  let match;
  let lastIndex = 0;

  while ((match = re.exec(d)) !== null) {
    result += d.slice(lastIndex, match.index);
    const cmd = match[1];
    const numStr = match[2].trim();
    const nums = numStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    switch (cmd.toUpperCase()) {
      case "M":
      case "L":
        result += `${cmd} ${nums[0] + ox},${nums[1] + oy}`;
        break;
      case "Q":
        result += `${cmd} ${nums[0] + ox},${nums[1] + oy} ${nums[2] + ox},${nums[3] + oy}`;
        break;
      case "C":
        result += `${cmd} ${nums[0] + ox},${nums[1] + oy} ${nums[2] + ox},${nums[3] + oy} ${nums[4] + ox},${nums[5] + oy}`;
        break;
      case "H":
        result += `${cmd} ${nums[0] + ox}`;
        break;
      case "V":
        result += `${cmd} ${nums[0] + oy}`;
        break;
      default:
        result += match[0];
    }
    lastIndex = re.lastIndex;
  }
  result += d.slice(lastIndex);
  return result;
}

/**
 * Scale all coordinates in an SVG path data string
 */
function scalePathData(d, sx, sy) {
  let result = "";
  const re = /([MLQCZHVAS])\s*([-\d.,\s]*)/gi;
  let match;
  let lastIndex = 0;

  while ((match = re.exec(d)) !== null) {
    result += d.slice(lastIndex, match.index);
    const cmd = match[1];
    const numStr = match[2].trim();
    const nums = numStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    switch (cmd.toUpperCase()) {
      case "M":
      case "L":
        result += `${cmd} ${nums[0] * sx},${nums[1] * sy}`;
        break;
      case "Q":
        result += `${cmd} ${nums[0] * sx},${nums[1] * sy} ${nums[2] * sx},${nums[3] * sy}`;
        break;
      case "C":
        result += `${cmd} ${nums[0] * sx},${nums[1] * sy} ${nums[2] * sx},${nums[3] * sy} ${nums[4] * sx},${nums[5] * sy}`;
        break;
      case "H":
        result += `${cmd} ${nums[0] * sx}`;
        break;
      case "V":
        result += `${cmd} ${nums[0] * sy}`;
        break;
      default:
        result += match[0];
    }
    lastIndex = re.lastIndex;
  }
  result += d.slice(lastIndex);
  return result;
}
