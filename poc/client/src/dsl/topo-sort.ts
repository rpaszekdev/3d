// Kahn's algorithm topological sort on the scene graph dependency edges.
// A depends on B if A has a relation targeting B (in:B, on:B, above:B, etc.)

import type { SceneNodeDef } from './types';

export function topoSort(nodes: readonly SceneNodeDef[]): readonly SceneNodeDef[] {
  const idToNode = new Map<string, SceneNodeDef>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>(); // B → [A, ...] (B must be placed before A)

  for (const node of nodes) {
    idToNode.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build edges: for each relation A→B, B must come before A
  for (const node of nodes) {
    for (const rel of node.relations) {
      if (idToNode.has(rel.target)) {
        adjacency.get(rel.target)!.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      }
    }
  }

  // Kahn's BFS — ties broken by source order
  const queue: string[] = [];
  const sourceOrder = new Map<string, number>();
  nodes.forEach((n, i) => sourceOrder.set(n.id, i));

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  queue.sort((a, b) => (sourceOrder.get(a) ?? 0) - (sourceOrder.get(b) ?? 0));

  const sorted: SceneNodeDef[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = idToNode.get(id);
    if (node) sorted.push(node);

    for (const dependent of adjacency.get(id) ?? []) {
      const deg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, deg);
      if (deg === 0) {
        queue.push(dependent);
        // Re-sort queue by source order for determinism
        queue.sort((a, b) => (sourceOrder.get(a) ?? 0) - (sourceOrder.get(b) ?? 0));
      }
    }
  }

  // Handle cycles: append any unvisited nodes (cycle-breaker)
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      console.warn(`[DSL] Cycle detected involving "${node.id}" — breaking dependency`);
      sorted.push(node);
    }
  }

  return sorted;
}
