/**
 * Pure spatial computation functions operating on matrix row data.
 * All functions take raw number arrays — no classes, no state.
 */

const COL = { X: 0, Y: 1, W: 2, H: 3, TYPE: 4, R: 5, G: 6, B: 7, ROTATION: 8, ALIVE: 9, Z_INDEX: 10 };
const SHAPE = { EMPTY: 0, RECT: 1, CIRCLE: 2, LINE: 3, TRIANGLE: 4 };

/** Get center point of a shape */
export function center(row: number[]): { x: number; y: number } {
  const type = row[COL.TYPE];
  switch (type) {
    case SHAPE.CIRCLE:
      return { x: row[COL.X], y: row[COL.Y] };
    case SHAPE.LINE:
      return { x: (row[COL.X] + row[COL.W]) / 2, y: (row[COL.Y] + row[COL.H]) / 2 };
    default:
      return { x: row[COL.X] + row[COL.W] / 2, y: row[COL.Y] + row[COL.H] / 2 };
  }
}

/** Euclidean distance between two shape centers */
export function distance(rowA: number[], rowB: number[]): number {
  const a = center(rowA);
  const b = center(rowB);
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Get bounding box { x, y, w, h } of a shape */
export function bounds(row: number[]): { x: number; y: number; w: number; h: number } {
  const type = row[COL.TYPE];
  switch (type) {
    case SHAPE.CIRCLE: {
      const r = row[COL.W];
      return { x: row[COL.X] - r, y: row[COL.Y] - r, w: r * 2, h: r * 2 };
    }
    case SHAPE.LINE:
      return {
        x: Math.min(row[COL.X], row[COL.W]),
        y: Math.min(row[COL.Y], row[COL.H]),
        w: Math.abs(row[COL.W] - row[COL.X]),
        h: Math.abs(row[COL.H] - row[COL.Y]),
      };
    default:
      return { x: row[COL.X], y: row[COL.Y], w: row[COL.W], h: row[COL.H] };
  }
}

/** Do two shapes' bounding boxes overlap? */
export function overlaps(rowA: number[], rowB: number[]): boolean {
  const a = bounds(rowA);
  const b = bounds(rowB);
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/** Does shape A's bounding box fully contain shape B? */
export function contains(rowA: number[], rowB: number[]): boolean {
  const a = bounds(rowA);
  const b = bounds(rowB);
  return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
}

/** Get the overall bounding box of all alive shapes */
export function sceneBounds(matrix: number[][]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const row of matrix) {
    if (row[COL.ALIVE] !== 1) continue;
    const b = bounds(row);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { minX, minY, maxX, maxY };
}

/** Find nearest alive shape to a given slot */
export function nearest(matrix: number[][], slotIndex: number): { slot: number; dist: number } | null {
  const target = matrix[slotIndex];
  if (target[COL.ALIVE] !== 1) return null;

  let best: { slot: number; dist: number } | null = null;
  for (let i = 0; i < matrix.length; i++) {
    if (i === slotIndex || matrix[i][COL.ALIVE] !== 1) continue;
    const d = distance(target, matrix[i]);
    if (!best || d < best.dist) {
      best = { slot: i, dist: d };
    }
  }
  return best;
}

/** Directional query: find shapes in a direction relative to a slot */
export function directional(
  matrix: number[][],
  slotIndex: number,
  direction: 'left' | 'right' | 'above' | 'below',
): number[] {
  const target = center(matrix[slotIndex]);
  const results: number[] = [];

  for (let i = 0; i < matrix.length; i++) {
    if (i === slotIndex || matrix[i][COL.ALIVE] !== 1) continue;
    const c = center(matrix[i]);
    switch (direction) {
      case 'left': if (c.x < target.x) results.push(i); break;
      case 'right': if (c.x > target.x) results.push(i); break;
      case 'above': if (c.y < target.y) results.push(i); break; // canvas y: smaller = higher
      case 'below': if (c.y > target.y) results.push(i); break;
    }
  }
  return results;
}
