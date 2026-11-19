// Post-layout AABB collision avoidance.
// Pushes overlapping same-layer nodes apart with minimum separation vector.
// Max 3 passes. Clamps to canvas bounds.

import type { ResolvedNode } from './types';

export function resolveCollisions(
  nodes: readonly ResolvedNode[],
  canvasW: number,
  canvasH: number,
): readonly ResolvedNode[] {
  // Work with mutable copies for collision passes
  const result = nodes.map(n => ({ ...n }));
  const MAX_PASSES = 3;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let anyMoved = false;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];

        // Only check same-layer collisions
        if (Math.floor(a.zIndex / 100) !== Math.floor(b.zIndex / 100)) continue;

        // Skip if one is contained inside the other (parent-child)
        if (isContainedIn(a, b) || isContainedIn(b, a)) continue;

        const overlap = getOverlap(a, b);
        if (!overlap) continue;

        // Push the later-resolved node (higher index)
        anyMoved = true;
        result[j] = {
          ...result[j],
          x: clampX(result[j].x + overlap.dx, result[j].w, canvasW),
          y: clampY(result[j].y + overlap.dy, result[j].h, canvasH),
        };
      }
    }

    if (!anyMoved) break;
  }

  return result;
}

interface Overlap {
  readonly dx: number;
  readonly dy: number;
}

function getOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): Overlap | null {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

  if (overlapX <= 0 || overlapY <= 0) return null;

  // Push along the axis of least overlap
  if (overlapX < overlapY) {
    const dx = b.x < a.x ? -overlapX : overlapX;
    return { dx, dy: 0 };
  }
  const dy = b.y < a.y ? -overlapY : overlapY;
  return { dx: 0, dy };
}

function isContainedIn(
  inner: { x: number; y: number; w: number; h: number },
  outer: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function clampX(x: number, w: number, canvasW: number): number {
  return Math.max(0, Math.min(x, canvasW - w));
}

function clampY(y: number, h: number, canvasH: number): number {
  return Math.max(0, Math.min(y, canvasH - h));
}
