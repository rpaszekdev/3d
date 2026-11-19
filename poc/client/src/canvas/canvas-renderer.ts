import { SpatialMatrix } from "../matrix/SpatialMatrix";
import {
  COL,
  SHAPE,
  CANVAS_W,
  CANVAS_H,
  MAX_SLOTS,
  DIMS,
} from "../matrix/constants";

/**
 * Pure function: reads matrix state, draws all alive shapes to the canvas context.
 * Sorted by zIndex so higher-z shapes draw on top.
 * Optional opacityMap provides per-slot opacity (from DSL v3 pipeline).
 */
export function renderMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: SpatialMatrix,
  opacityMap?: Map<number, number>,
): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw grid background
  drawGrid(ctx);

  // Collect alive slots, sort by zIndex
  const alive = matrix
    .aliveSlots()
    .sort((a, b) => a.row[COL.Z_INDEX] - b.row[COL.Z_INDEX]);

  for (const { slot, row } of alive) {
    const x = row[COL.X];
    const y = row[COL.Y];
    const w = row[COL.W];
    const h = row[COL.H];
    const type = row[COL.TYPE];
    const r = row[COL.R];
    const g = row[COL.G];
    const b = row[COL.B];
    const rotation = row[COL.ROTATION];
    const color = `rgb(${r}, ${g}, ${b})`;

    ctx.save();

    // Apply per-shape opacity from DSL v3 pipeline
    const opacity = opacityMap?.get(slot);
    if (opacity !== undefined) {
      ctx.globalAlpha = opacity;
    }

    // Apply rotation around shape center
    if (rotation !== 0) {
      const cx =
        type === SHAPE.LINE
          ? (x + w) / 2
          : x + (type === SHAPE.CIRCLE ? 0 : w / 2);
      const cy =
        type === SHAPE.LINE
          ? (y + h) / 2
          : y + (type === SHAPE.CIRCLE ? 0 : h / 2);
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    switch (type) {
      case SHAPE.RECT:
        drawRect(ctx, x, y, w, h, color);
        break;
      case SHAPE.CIRCLE:
        drawCircle(ctx, x, y, w, color);
        break;
      case SHAPE.LINE:
        drawLine(ctx, x, y, w, h, color);
        break;
      case SHAPE.TRIANGLE:
        drawTriangle(ctx, x, y, w, h, color);
        break;
      case SHAPE.TUBE:
        drawTube(ctx, x, y, w, h, color);
        break;
      case SHAPE.BLOB:
        drawBlob(ctx, x, y, w, h, color);
        break;
    }

    ctx.restore();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < CANVAS_W; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); // top center
  ctx.lineTo(x, y + h); // bottom left
  ctx.lineTo(x + w, y + h); // bottom right
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTube(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const radius = Math.min(w, h) * 0.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  // Seeded noise for deterministic organic shape
  const seed = Math.abs((x * 31 + y * 17) | 0);
  const POINTS = 8;

  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2;
    const nextAngle = ((i + 1) / POINTS) * Math.PI * 2;
    // Pseudo-random wobble per point
    const wobble = 0.85 + 0.3 * pseudoRandom(seed + i);
    const nextWobble = 0.85 + 0.3 * pseudoRandom(seed + i + 1);
    const px = cx + rx * wobble * Math.cos(angle);
    const py = cy + ry * wobble * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      const cpAngle = (angle + nextAngle) / 2 - Math.PI / POINTS;
      const cpWobble = 0.85 + 0.3 * pseudoRandom(seed + i + 100);
      const cpx = cx + rx * cpWobble * Math.cos(cpAngle);
      const cpy = cy + ry * cpWobble * Math.sin(cpAngle);
      ctx.quadraticCurveTo(cpx, cpy, px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function pseudoRandom(seed: number): number {
  // Simple hash-based PRNG (0..1)
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Draw a ghost preview of the shape being drawn (not yet committed to matrix).
 */
export function renderGhost(
  ctx: CanvasRenderingContext2D,
  tool: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 0.4;

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  switch (tool) {
    case "rect":
      drawRect(ctx, x, y, w, h, color);
      break;
    case "circle": {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const radius = Math.sqrt(w * w + h * h) / 2;
      drawCircle(ctx, cx, cy, radius, color);
      break;
    }
    case "line":
      drawLine(ctx, start.x, start.y, end.x, end.y, color);
      break;
    case "triangle":
      drawTriangle(ctx, x, y, w, h, color);
      break;
  }

  ctx.restore();
}
