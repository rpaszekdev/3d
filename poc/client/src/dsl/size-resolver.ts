// Resolves semantic size keywords → pixel dimensions for each node.
// Sizes are relative to the parent container (or canvas for root nodes).

import type { SceneNodeDef, SizeKeyword } from './types';
import { resolveSize } from './size-tables';

export interface SizedNode {
  readonly id: string;
  readonly node: SceneNodeDef;
  readonly w: number;
  readonly h: number;
}

export function resolveSizes(
  sortedNodes: readonly SceneNodeDef[],
  canvasW: number,
  canvasH: number,
): readonly SizedNode[] {
  const sizedMap = new Map<string, SizedNode>();

  for (const node of sortedNodes) {
    // Find parent container (first 'in:' relation target)
    const containment = node.relations.find(r => r.type === 'in');
    let parentW = canvasW;
    let parentH = canvasH;

    if (containment) {
      const parent = sizedMap.get(containment.target);
      if (parent) {
        parentW = parent.w;
        parentH = parent.h;
      }
    }

    const { w, h } = resolveSize(node.sizeKeywords, parentW, parentH);
    const sized: SizedNode = { id: node.id, node, w, h };
    sizedMap.set(node.id, sized);
  }

  return sortedNodes.map(n => sizedMap.get(n.id)!);
}
