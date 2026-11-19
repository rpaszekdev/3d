import { MAX_SLOTS, DIMS, COL, SHAPE } from "./constants";

/**
 * Immutable wrapper around a Float64Array representing S ∈ R^(32 × 11).
 * Every mutation returns a NEW SpatialMatrix — the original is never modified.
 */
export class SpatialMatrix {
  private readonly data: Float64Array;

  private constructor(data: Float64Array) {
    this.data = data;
  }

  /** Create a zeroed-out matrix */
  static create(): SpatialMatrix {
    return new SpatialMatrix(new Float64Array(MAX_SLOTS * DIMS));
  }

  /** Restore from a 2D array (e.g. from server response) */
  static fromRows(rows: readonly number[][]): SpatialMatrix {
    const data = new Float64Array(MAX_SLOTS * DIMS);
    for (let i = 0; i < Math.min(rows.length, MAX_SLOTS); i++) {
      for (let j = 0; j < Math.min(rows[i].length, DIMS); j++) {
        data[i * DIMS + j] = rows[i][j];
      }
    }
    return new SpatialMatrix(data);
  }

  /** Get a single value */
  get(slot: number, col: number): number {
    return this.data[slot * DIMS + col];
  }

  /** Get a full row as a plain number array */
  getRow(slot: number): number[] {
    const start = slot * DIMS;
    return Array.from(this.data.slice(start, start + DIMS));
  }

  /** Export all rows as a 2D array */
  toRows(): number[][] {
    const rows: number[][] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      rows.push(this.getRow(i));
    }
    return rows;
  }

  /** Return only alive rows with their slot indices */
  aliveSlots(): { slot: number; row: number[] }[] {
    const result: { slot: number; row: number[] }[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.data[i * DIMS + COL.ALIVE] === 1) {
        result.push({ slot: i, row: this.getRow(i) });
      }
    }
    return result;
  }

  /** Set an entire row — returns a new SpatialMatrix */
  setRow(slot: number, row: readonly number[]): SpatialMatrix {
    const newData = new Float64Array(this.data);
    const start = slot * DIMS;
    for (let j = 0; j < Math.min(row.length, DIMS); j++) {
      newData[start + j] = row[j];
    }
    return new SpatialMatrix(newData);
  }

  /** Set a single cell — returns a new SpatialMatrix */
  setCell(slot: number, col: number, value: number): SpatialMatrix {
    const newData = new Float64Array(this.data);
    newData[slot * DIMS + col] = value;
    return new SpatialMatrix(newData);
  }

  /** Find the first empty (alive=0) slot. Returns -1 if full. */
  allocate(): number {
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.data[i * DIMS + COL.ALIVE] === 0) {
        return i;
      }
    }
    return -1;
  }

  /** Mark a slot as dead (alive=0, type=EMPTY) — returns new matrix */
  free(slot: number): SpatialMatrix {
    const newData = new Float64Array(this.data);
    const start = slot * DIMS;
    for (let j = 0; j < DIMS; j++) {
      newData[start + j] = 0;
    }
    return new SpatialMatrix(newData);
  }

  /** Clear all slots — returns new empty matrix */
  clear(): SpatialMatrix {
    return SpatialMatrix.create();
  }

  /** Count alive shapes */
  count(): number {
    let n = 0;
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.data[i * DIMS + COL.ALIVE] === 1) n++;
    }
    return n;
  }

  /** Check if a slot is alive */
  isAlive(slot: number): boolean {
    return this.data[slot * DIMS + COL.ALIVE] === 1;
  }

  /** Get shape type name for display */
  shapeName(slot: number): string {
    const type = this.data[slot * DIMS + COL.TYPE];
    switch (type) {
      case SHAPE.RECT:
        return "RECT";
      case SHAPE.CIRCLE:
        return "CIRCLE";
      case SHAPE.LINE:
        return "LINE";
      case SHAPE.TRIANGLE:
        return "TRI";
      case SHAPE.TUBE:
        return "TUBE";
      case SHAPE.BLOB:
        return "BLOB";
      default:
        return "EMPTY";
    }
  }
}
