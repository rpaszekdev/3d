// Orchestrator: DSL text → SpatialMatrix
// Wires: tokenize → parse → topoSort → resolveSize → resolvePosition → collision → emit

import { tokenize } from './tokenizer';
import { parse } from './parser';
import { topoSort } from './topo-sort';
import { resolveSizes } from './size-resolver';
import { resolvePositions } from './position-resolver';
import { resolveCollisions } from './collision';
import { emit } from './emitter';

export function solveDsl(
  text: string,
  canvasW: number,
  canvasH: number,
): { matrix: number[][]; opacityMap: Map<number, number> } {
  const tokens = tokenize(text);
  const ast = parse(tokens);
  const sorted = topoSort(ast.nodes);
  const sized = resolveSizes(sorted, canvasW, canvasH);
  const positioned = resolvePositions(sized, canvasW, canvasH);
  const resolved = resolveCollisions(positioned, canvasW, canvasH);
  return emit(resolved);
}
