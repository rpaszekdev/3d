// Emitter: ResolvedNode[] → 32×11 matrix (SpatialMatrix-compatible format)
// Maps DSL shape kinds to existing SHAPE type codes.

import type { ResolvedNode, ShapeKind } from './types';
import { MAX_SLOTS, DIMS, COL, SHAPE } from '../matrix/constants';

const SHAPE_MAP: Record<ShapeKind, number> = {
  box:    SHAPE.RECT,
  ball:   SHAPE.CIRCLE,
  stroke: SHAPE.LINE,
  cone:   SHAPE.TRIANGLE,
  label:  SHAPE.RECT,      // Labels render as boxes (text overlay handled separately)
  tube:   5,               // SHAPE.TUBE — new type
  blob:   6,               // SHAPE.BLOB — new type
};

export function emit(
  nodes: readonly ResolvedNode[],
): { matrix: number[][]; opacityMap: Map<number, number> } {
  // Initialize empty 32×11 matrix
  const matrix: number[][] = Array.from({ length: MAX_SLOTS }, () =>
    new Array(DIMS).fill(0),
  );
  const opacityMap = new Map<number, number>();

  const count = Math.min(nodes.length, MAX_SLOTS);

  for (let slot = 0; slot < count; slot++) {
    const node = nodes[slot];
    const row = matrix[slot];
    const shapeType = SHAPE_MAP[node.shape] ?? SHAPE.RECT;

    if (shapeType === SHAPE.CIRCLE) {
      // Circle: X/Y = center, W = radius, H = 0
      row[COL.X] = node.x + node.w / 2;
      row[COL.Y] = node.y + node.h / 2;
      row[COL.W] = Math.min(node.w, node.h) / 2;
      row[COL.H] = 0;
    } else {
      row[COL.X] = node.x;
      row[COL.Y] = node.y;
      row[COL.W] = node.w;
      row[COL.H] = node.h;
    }

    row[COL.TYPE] = shapeType;
    row[COL.R] = node.color[0];
    row[COL.G] = node.color[1];
    row[COL.B] = node.color[2];
    row[COL.ROTATION] = 0;
    row[COL.ALIVE] = 1;
    row[COL.Z_INDEX] = node.zIndex;

    if (node.opacity < 1.0) {
      opacityMap.set(slot, node.opacity);
    }
  }

  return { matrix, opacityMap };
}
