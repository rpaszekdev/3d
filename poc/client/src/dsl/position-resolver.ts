// Core solver: resolves relations → (x, y) coordinates for each node.
// Processes nodes in topological order so dependencies are already placed.

import type { SceneNodeDef, Relation, Layer } from './types';
import type { SizedNode } from './size-resolver';
import type { ResolvedNode } from './types';
import { resolveColor } from './colors';

interface Placed {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const LAYER_Z_BASE: Record<Layer, number> = {
  back: 0,
  mid: 100,
  front: 200,
  overlay: 300,
};

export function resolvePositions(
  sizedNodes: readonly SizedNode[],
  canvasW: number,
  canvasH: number,
): readonly ResolvedNode[] {
  const placedMap = new Map<string, Placed>();
  const results: ResolvedNode[] = [];
  let layerCounters: Record<Layer, number> = { back: 0, mid: 0, front: 0, overlay: 0 };
  let unplacedIdx = 0;

  for (const sized of sizedNodes) {
    const { id, node, w, h } = sized;
    const { x, y } = computePosition(node, w, h, placedMap, canvasW, canvasH, unplacedIdx);

    placedMap.set(id, { x, y, w, h });

    const layer: Layer = node.layer ?? 'mid';
    const zIndex = LAYER_Z_BASE[layer] + layerCounters[layer];
    layerCounters = { ...layerCounters, [layer]: layerCounters[layer] + 1 };

    const color = resolveColor(node.color);

    results.push({
      id,
      shape: node.shape,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
      color,
      opacity: node.opacity ?? 1.0,
      zIndex,
    });

    if (node.relations.length === 0) unplacedIdx++;
  }

  return results;
}

function computePosition(
  node: SceneNodeDef,
  w: number,
  h: number,
  placed: Map<string, Placed>,
  canvasW: number,
  canvasH: number,
  unplacedIdx: number,
): { x: number; y: number } {
  if (node.relations.length === 0) {
    return flowLayout(w, h, canvasW, canvasH, unplacedIdx);
  }

  const candidates: Array<{ x: number; y: number }> = [];
  let containmentBounds: Placed | null = null;

  for (const rel of node.relations) {
    const target = placed.get(rel.target);
    if (!target) continue;

    const pos = resolveRelation(rel, w, h, target, canvasW, canvasH);
    if (pos) candidates.push(pos);

    if (rel.type === 'in') {
      containmentBounds = target;
    }
  }

  if (candidates.length === 0) {
    return flowLayout(w, h, canvasW, canvasH, unplacedIdx);
  }

  // Average all candidate positions
  let x = candidates.reduce((s, c) => s + c.x, 0) / candidates.length;
  let y = candidates.reduce((s, c) => s + c.y, 0) / candidates.length;

  // Constrain to containment bounds if applicable
  if (containmentBounds) {
    const padding = containmentBounds.w * 0.05;
    x = clamp(x, containmentBounds.x + padding, containmentBounds.x + containmentBounds.w - w - padding);
    y = clamp(y, containmentBounds.y + padding, containmentBounds.y + containmentBounds.h - h - padding);
  }

  // Clamp to canvas
  x = clamp(x, 0, canvasW - w);
  y = clamp(y, 0, canvasH - h);

  return { x, y };
}

function resolveRelation(
  rel: Relation,
  w: number,
  h: number,
  target: Placed,
  canvasW: number,
  _canvasH: number,
): { x: number; y: number } | null {
  const gap = getGap(rel.proximity, canvasW);
  const tCx = target.x + target.w / 2;
  const tCy = target.y + target.h / 2;

  switch (rel.type) {
    case 'in':
      return resolveContainment(rel.anchor, w, h, target);

    case 'on':
      // Resting on top surface
      return { x: tCx - w / 2, y: target.y - h };

    case 'above':
      return { x: tCx - w / 2, y: target.y - h - gap };

    case 'below':
      return { x: tCx - w / 2, y: target.y + target.h + gap };

    case 'left_of':
      return { x: target.x - w - gap, y: tCy - h / 2 };

    case 'right_of':
      return { x: target.x + target.w + gap, y: tCy - h / 2 };

    case 'under':
      // Hanging below bottom edge
      return { x: tCx - w / 2, y: target.y + target.h };

    case 'against':
      // Touching right side
      return { x: target.x + target.w, y: tCy - h / 2 };

    default:
      return null;
  }
}

function resolveContainment(
  anchor: string | undefined,
  w: number,
  h: number,
  parent: Placed,
): { x: number; y: number } {
  const padding = parent.w * 0.05;
  const pInnerX = parent.x + padding;
  const pInnerY = parent.y + padding;
  const pInnerW = parent.w - padding * 2;
  const pInnerH = parent.h - padding * 2;

  if (!anchor) {
    // Center inside parent
    return {
      x: pInnerX + (pInnerW - w) / 2,
      y: pInnerY + (pInnerH - h) / 2,
    };
  }

  const parts = anchor.split('.');
  let x = pInnerX + (pInnerW - w) / 2; // default: horizontally centered
  let y = pInnerY + (pInnerH - h) / 2; // default: vertically centered

  for (const part of parts) {
    switch (part) {
      case 'top':    y = pInnerY; break;
      case 'bottom': y = pInnerY + pInnerH - h; break;
      case 'left':   x = pInnerX; break;
      case 'right':  x = pInnerX + pInnerW - w; break;
      case 'center': /* already centered */ break;
    }
  }

  return { x, y };
}

function getGap(proximity: string | undefined, canvasW: number): number {
  switch (proximity) {
    case 'touching': return 0;
    case 'near':     return canvasW * 0.01;
    case 'far':      return canvasW * 0.06;
    default:         return canvasW * 0.02;
  }
}

function flowLayout(
  w: number,
  h: number,
  canvasW: number,
  canvasH: number,
  idx: number,
): { x: number; y: number } {
  // Grid layout for unrelated nodes
  const cols = Math.max(1, Math.floor(canvasW / (w + 20)));
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const x = clamp(col * (w + 20) + 10, 0, canvasW - w);
  const y = clamp(row * (h + 20) + 10, 0, canvasH - h);
  return { x, y };
}

function clamp(val: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2; // degenerate case
  return Math.max(min, Math.min(val, max));
}
