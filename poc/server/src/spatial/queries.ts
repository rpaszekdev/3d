import { distance, nearest, overlaps, contains, sceneBounds, directional, center, bounds } from './matrix-ops.js';

const COL = { X: 0, Y: 1, W: 2, H: 3, TYPE: 4, R: 5, G: 6, B: 7, ROTATION: 8, ALIVE: 9, Z_INDEX: 10 };

export interface QueryResult {
  readonly query: string;
  readonly result: unknown;
}

/**
 * Execute a spatial query against the matrix.
 * Supported queries: distance, nearest, contains, overlaps, count, bounds, directional
 */
export function executeSpatialQuery(
  matrix: number[][],
  query: string,
  args: Record<string, unknown>,
): QueryResult {
  switch (query) {
    case 'distance': {
      const slotA = args.slotA as number;
      const slotB = args.slotB as number;
      if (!isValidSlot(matrix, slotA) || !isValidSlot(matrix, slotB)) {
        return { query, result: { error: 'Invalid slot indices' } };
      }
      const d = distance(matrix[slotA], matrix[slotB]);
      return { query, result: { distance: Math.round(d), slotA, slotB } };
    }

    case 'nearest': {
      const slot = args.slot as number;
      if (!isValidSlot(matrix, slot)) {
        return { query, result: { error: 'Invalid slot index' } };
      }
      const n = nearest(matrix, slot);
      return { query, result: n ? { nearestSlot: n.slot, distance: Math.round(n.dist) } : { error: 'No other shapes' } };
    }

    case 'contains': {
      const outer = args.outerSlot as number;
      const inner = args.innerSlot as number;
      if (!isValidSlot(matrix, outer) || !isValidSlot(matrix, inner)) {
        return { query, result: { error: 'Invalid slot indices' } };
      }
      return { query, result: { contains: contains(matrix[outer], matrix[inner]) } };
    }

    case 'overlaps': {
      const slotA = args.slotA as number;
      const slotB = args.slotB as number;
      if (!isValidSlot(matrix, slotA) || !isValidSlot(matrix, slotB)) {
        return { query, result: { error: 'Invalid slot indices' } };
      }
      return { query, result: { overlaps: overlaps(matrix[slotA], matrix[slotB]) } };
    }

    case 'count': {
      const count = matrix.filter(r => r[COL.ALIVE] === 1).length;
      return { query, result: { count } };
    }

    case 'bounds': {
      const b = sceneBounds(matrix);
      return { query, result: b };
    }

    case 'directional': {
      const slot = args.slot as number;
      const direction = args.direction as 'left' | 'right' | 'above' | 'below';
      if (!isValidSlot(matrix, slot)) {
        return { query, result: { error: 'Invalid slot index' } };
      }
      const slots = directional(matrix, slot, direction);
      return { query, result: { direction, relativeToSlot: slot, foundSlots: slots } };
    }

    case 'center': {
      const slot = args.slot as number;
      if (!isValidSlot(matrix, slot)) {
        return { query, result: { error: 'Invalid slot index' } };
      }
      const c = center(matrix[slot]);
      return { query, result: { slot, center: c } };
    }

    case 'bounds_of': {
      const slot = args.slot as number;
      if (!isValidSlot(matrix, slot)) {
        return { query, result: { error: 'Invalid slot index' } };
      }
      const b = bounds(matrix[slot]);
      return { query, result: { slot, bounds: b } };
    }

    default:
      return { query, result: { error: `Unknown query: ${query}` } };
  }
}

function isValidSlot(matrix: number[][], slot: number): boolean {
  return slot >= 0 && slot < matrix.length && matrix[slot][COL.ALIVE] === 1;
}
