import { SpatialMatrix } from './SpatialMatrix';
import { COL, SHAPE, SHAPE_NAMES, MAX_SLOTS, DIMS } from './constants';

/**
 * Bidirectional conversion between SpatialMatrix and SSL text notation.
 * This is the core of protocol transparency — the exact SSL text sent to Claude
 * is displayed in the Protocol Panel so the user can verify no English descriptions exist.
 */

/** Convert matrix → SSL text */
export function matrixToSsl(matrix: SpatialMatrix): string {
  const lines: string[] = [];
  const alive = matrix.aliveSlots().sort((a, b) => a.slot - b.slot);

  for (const { slot, row } of alive) {
    const type = row[COL.TYPE];
    const typeName = SHAPE_NAMES[type] ?? 'box';
    const r = row[COL.R];
    const g = row[COL.G];
    const b = row[COL.B];
    const colorHex = `#${hex(r)}${hex(g)}${hex(b)}`;
    const rotation = row[COL.ROTATION];

    let line = `s${slot}: ${typeName}`;

    switch (type) {
      case SHAPE.RECT:
      case SHAPE.TRIANGLE:
        line += ` @${row[COL.X]} ${row[COL.Y]}`;
        line += ` /${row[COL.W]} ${row[COL.H]}`;
        break;
      case SHAPE.CIRCLE:
        line += ` @${row[COL.X]} ${row[COL.Y]}`;
        line += ` /${row[COL.W]}`;
        break;
      case SHAPE.LINE:
        line += ` @${row[COL.X]} ${row[COL.Y]} ${row[COL.W]} ${row[COL.H]}`;
        break;
    }

    line += ` ${colorHex}`;

    if (rotation !== 0) {
      line += ` '${rotation}`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

/** Parse SSL text → matrix rows (returns a 2D number array) */
export function sslToMatrix(ssl: string): number[][] {
  const rows: number[][] = [];
  // Initialize all slots as empty
  for (let i = 0; i < MAX_SLOTS; i++) {
    rows.push(new Array(DIMS).fill(0));
  }

  const lines = ssl.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('--'));

  for (const line of lines) {
    const parsed = parseSslLine(line.trim());
    if (parsed) {
      const { slot, row } = parsed;
      if (slot >= 0 && slot < MAX_SLOTS) {
        rows[slot] = row;
      }
    }
  }

  return rows;
}

function parseSslLine(line: string): { slot: number; row: number[] } | null {
  // Pattern: s<N>: <type> @<coords> /<size> #<color> '<rotation>
  const labelMatch = line.match(/^s(\d+):\s*/);
  if (!labelMatch) return null;

  const slot = parseInt(labelMatch[1], 10);
  const rest = line.slice(labelMatch[0].length);
  const tokens = rest.split(/\s+/);

  if (tokens.length === 0) return null;

  const typeName = tokens[0];
  const type = typeFromName(typeName);
  if (type === SHAPE.EMPTY) return null;

  const row = new Array(DIMS).fill(0);
  row[COL.TYPE] = type;
  row[COL.ALIVE] = 1;
  row[COL.Z_INDEX] = slot;

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.startsWith('@')) {
      // Position
      const val = token.slice(1);
      if (val) {
        row[COL.X] = parseFloat(val);
        if (i + 1 < tokens.length && !isOperator(tokens[i + 1])) {
          i++;
          row[COL.Y] = parseFloat(tokens[i]);
        }
        // For lines: 2 more coords (endX, endY)
        if (type === SHAPE.LINE) {
          if (i + 1 < tokens.length && !isOperator(tokens[i + 1])) {
            i++;
            row[COL.W] = parseFloat(tokens[i]);
          }
          if (i + 1 < tokens.length && !isOperator(tokens[i + 1])) {
            i++;
            row[COL.H] = parseFloat(tokens[i]);
          }
        }
      }
    } else if (token.startsWith('/')) {
      // Size
      const val = token.slice(1);
      if (val) {
        row[COL.W] = parseFloat(val);
        if (i + 1 < tokens.length && !isOperator(tokens[i + 1])) {
          i++;
          row[COL.H] = parseFloat(tokens[i]);
        }
      }
    } else if (token.startsWith('#')) {
      // Color (hex)
      const hex = token.slice(1);
      const rgb = parseHexColor(hex);
      if (rgb) {
        row[COL.R] = rgb[0];
        row[COL.G] = rgb[1];
        row[COL.B] = rgb[2];
      }
    } else if (token.startsWith("'")) {
      // Rotation
      const val = token.slice(1);
      if (val) {
        row[COL.ROTATION] = parseFloat(val);
      }
    }

    i++;
  }

  return { slot, row };
}

function typeFromName(name: string): number {
  switch (name) {
    case 'box': return SHAPE.RECT;
    case 'ball': return SHAPE.CIRCLE;
    case 'line': return SHAPE.LINE;
    case 'tri': return SHAPE.TRIANGLE;
    default: return SHAPE.EMPTY;
  }
}

function isOperator(token: string): boolean {
  return token.startsWith('@') || token.startsWith('/') || token.startsWith('#') || token.startsWith("'");
}

function parseHexColor(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return null;
}

function hex(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
}
