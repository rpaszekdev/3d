import { COL, SHAPE, DEFAULT_COLORS } from '../matrix/constants';
import type { DrawingTool, Point } from '../types';

/**
 * Convert a click-drag gesture (start + end points) into a matrix row.
 * Returns the 11-element row array ready to be set into a matrix slot.
 */
export function gestureToRow(
  tool: DrawingTool,
  start: Point,
  end: Point,
  zIndex: number,
  colorOverride?: [number, number, number],
): number[] {
  const row = new Array(11).fill(0);

  switch (tool) {
    case 'rect': {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      if (w < 5 || h < 5) return row; // too small
      const c = colorOverride ?? DEFAULT_COLORS[SHAPE.RECT];
      row[COL.X] = Math.round(x);
      row[COL.Y] = Math.round(y);
      row[COL.W] = Math.round(w);
      row[COL.H] = Math.round(h);
      row[COL.TYPE] = SHAPE.RECT;
      row[COL.R] = c[0];
      row[COL.G] = c[1];
      row[COL.B] = c[2];
      row[COL.ALIVE] = 1;
      row[COL.Z_INDEX] = zIndex;
      break;
    }

    case 'circle': {
      const cx = Math.round((start.x + end.x) / 2);
      const cy = Math.round((start.y + end.y) / 2);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const radius = Math.round(Math.sqrt(dx * dx + dy * dy) / 2);
      if (radius < 3) return row; // too small
      const c = colorOverride ?? DEFAULT_COLORS[SHAPE.CIRCLE];
      row[COL.X] = cx;
      row[COL.Y] = cy;
      row[COL.W] = radius;
      row[COL.H] = 0; // circle uses w as radius, h = 0
      row[COL.TYPE] = SHAPE.CIRCLE;
      row[COL.R] = c[0];
      row[COL.G] = c[1];
      row[COL.B] = c[2];
      row[COL.ALIVE] = 1;
      row[COL.Z_INDEX] = zIndex;
      break;
    }

    case 'line': {
      const c = colorOverride ?? DEFAULT_COLORS[SHAPE.LINE];
      row[COL.X] = Math.round(start.x);
      row[COL.Y] = Math.round(start.y);
      row[COL.W] = Math.round(end.x);   // w = endX for lines
      row[COL.H] = Math.round(end.y);   // h = endY for lines
      row[COL.TYPE] = SHAPE.LINE;
      row[COL.R] = c[0];
      row[COL.G] = c[1];
      row[COL.B] = c[2];
      row[COL.ALIVE] = 1;
      row[COL.Z_INDEX] = zIndex;
      break;
    }

    case 'triangle': {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      if (w < 5 || h < 5) return row;
      const c = colorOverride ?? DEFAULT_COLORS[SHAPE.TRIANGLE];
      row[COL.X] = Math.round(x);
      row[COL.Y] = Math.round(y);
      row[COL.W] = Math.round(w);
      row[COL.H] = Math.round(h);
      row[COL.TYPE] = SHAPE.TRIANGLE;
      row[COL.R] = c[0];
      row[COL.G] = c[1];
      row[COL.B] = c[2];
      row[COL.ALIVE] = 1;
      row[COL.Z_INDEX] = zIndex;
      break;
    }
  }

  return row;
}
