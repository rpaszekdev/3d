/**
 * Server-side SSL serializer — converts matrix rows to SSL text.
 * Mirrors the client-side version, used for generating SSL representations.
 */

const COL = { X: 0, Y: 1, W: 2, H: 3, TYPE: 4, R: 5, G: 6, B: 7, ROTATION: 8, ALIVE: 9, Z_INDEX: 10 };
const SHAPE = { EMPTY: 0, RECT: 1, CIRCLE: 2, LINE: 3, TRIANGLE: 4 };

const SHAPE_NAMES: Record<number, string> = {
  0: 'empty',
  1: 'box',
  2: 'ball',
  3: 'line',
  4: 'tri',
};

export function matrixToSsl(matrix: number[][]): string {
  const lines: string[] = [];

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (row[COL.ALIVE] !== 1) continue;

    const type = row[COL.TYPE];
    const typeName = SHAPE_NAMES[type] ?? 'box';
    const color = `#${hex(row[COL.R])}${hex(row[COL.G])}${hex(row[COL.B])}`;
    const rotation = row[COL.ROTATION];

    let line = `s${i}: ${typeName}`;

    switch (type) {
      case SHAPE.RECT:
      case SHAPE.TRIANGLE:
        line += ` @${row[COL.X]} ${row[COL.Y]} /${row[COL.W]} ${row[COL.H]}`;
        break;
      case SHAPE.CIRCLE:
        line += ` @${row[COL.X]} ${row[COL.Y]} /${row[COL.W]}`;
        break;
      case SHAPE.LINE:
        line += ` @${row[COL.X]} ${row[COL.Y]} ${row[COL.W]} ${row[COL.H]}`;
        break;
    }

    line += ` ${color}`;
    if (rotation !== 0) line += ` '${rotation}`;

    lines.push(line);
  }

  return lines.join('\n');
}

function hex(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
}
