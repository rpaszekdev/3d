import { matrixToSsl } from '../spatial/ssl-parser.js';
import { executeSpatialQuery } from '../spatial/queries.js';

const MAX_SLOTS = 32;
const DIMS = 11;

export interface ToolCallLog {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
}

/**
 * Execute a Claude tool call against the current matrix state.
 * Returns the tool result and potentially mutated matrix (immutable pattern — returns new copy).
 */
export function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  matrix: number[][],
): { result: unknown; matrix: number[][] } {
  switch (toolName) {
    case 'read_canvas':
      return executeReadCanvas(toolInput, matrix);
    case 'write_canvas':
      return executeWriteCanvas(toolInput, matrix);
    case 'spatial_query':
      return executeSpatialQueryTool(toolInput, matrix);
    default:
      return { result: { error: `Unknown tool: ${toolName}` }, matrix };
  }
}

function executeReadCanvas(
  input: Record<string, unknown>,
  matrix: number[][],
): { result: unknown; matrix: number[][] } {
  const format = (input.format as string) || 'ssl';

  if (format === 'raw') {
    // Return only alive rows to save tokens
    const aliveRows: { slot: number; row: number[] }[] = [];
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i][9] === 1) {
        aliveRows.push({ slot: i, row: matrix[i] });
      }
    }
    return { result: { aliveSlots: aliveRows, totalSlots: MAX_SLOTS }, matrix };
  }

  const ssl = matrixToSsl(matrix);
  const count = matrix.filter(r => r[9] === 1).length;
  return {
    result: { ssl: ssl || '(empty canvas)', aliveCount: count, totalSlots: MAX_SLOTS },
    matrix,
  };
}

function executeWriteCanvas(
  input: Record<string, unknown>,
  matrix: number[][],
): { result: unknown; matrix: number[][] } {
  const operations = input.operations as { slot: number; row: number[] }[];

  if (!Array.isArray(operations) || operations.length === 0) {
    return { result: { error: 'No operations provided' }, matrix };
  }

  // Deep copy for immutability
  const newMatrix = matrix.map(row => [...row]);
  const results: { slot: number; action: string }[] = [];

  for (const op of operations) {
    const { slot, row } = op;

    if (slot < 0 || slot >= MAX_SLOTS) {
      results.push({ slot, action: 'error: slot out of range' });
      continue;
    }

    if (!Array.isArray(row) || row.length !== DIMS) {
      results.push({ slot, action: `error: row must have ${DIMS} elements, got ${row?.length}` });
      continue;
    }

    // Clamp values to valid ranges
    const clamped = clampRow(row);
    newMatrix[slot] = clamped;

    const action = clamped[9] === 0 ? 'deleted' : (matrix[slot][9] === 1 ? 'updated' : 'created');
    results.push({ slot, action });
  }

  return {
    result: { operations: results, newSsl: matrixToSsl(newMatrix) },
    matrix: newMatrix,
  };
}

function executeSpatialQueryTool(
  input: Record<string, unknown>,
  matrix: number[][],
): { result: unknown; matrix: number[][] } {
  const query = input.query as string;
  const args = (input.args as Record<string, unknown>) || {};
  const result = executeSpatialQuery(matrix, query, args);
  return { result: result.result, matrix };
}

/** Clamp all values in a matrix row to valid ranges */
function clampRow(row: number[]): number[] {
  return [
    clamp(row[0], 0, 800),   // x
    clamp(row[1], 0, 600),   // y
    Math.max(0, row[2]),      // w (can be endX for lines, so allow > 800)
    Math.max(0, row[3]),      // h (can be endY for lines)
    clamp(Math.round(row[4]), 0, 4),   // type
    clamp(Math.round(row[5]), 0, 255), // r
    clamp(Math.round(row[6]), 0, 255), // g
    clamp(Math.round(row[7]), 0, 255), // b
    clamp(row[8], 0, 360),   // rotation
    row[9] === 1 ? 1 : 0,    // alive (binary)
    clamp(Math.round(row[10]), 0, 31), // zIndex
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
