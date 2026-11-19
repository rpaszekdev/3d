// Matrix dimensions
export const MAX_SLOTS = 32;
export const DIMS = 11;

// Column indices into each row
export const COL = {
  X: 0,
  Y: 1,
  W: 2,
  H: 3,
  TYPE: 4,
  R: 5,
  G: 6,
  B: 7,
  ROTATION: 8,
  ALIVE: 9,
  Z_INDEX: 10,
} as const;

// Shape type codes
export const SHAPE = {
  EMPTY: 0,
  RECT: 1,
  CIRCLE: 2,
  LINE: 3,
  TRIANGLE: 4,
  TUBE: 5,
  BLOB: 6,
} as const;

export type ShapeType = (typeof SHAPE)[keyof typeof SHAPE];

// Shape labels for display
export const SHAPE_NAMES: Record<number, string> = {
  [SHAPE.EMPTY]: "empty",
  [SHAPE.RECT]: "box",
  [SHAPE.CIRCLE]: "ball",
  [SHAPE.LINE]: "line",
  [SHAPE.TRIANGLE]: "tri",
  [SHAPE.TUBE]: "tube",
  [SHAPE.BLOB]: "blob",
};

// Canvas dimensions
export const CANVAS_W = 800;
export const CANVAS_H = 600;

// Default colors per shape type (for new shapes drawn by user)
export const DEFAULT_COLORS: Record<number, [number, number, number]> = {
  [SHAPE.RECT]: [74, 144, 226], // blue
  [SHAPE.CIRCLE]: [231, 76, 60], // red
  [SHAPE.LINE]: [46, 204, 113], // green
  [SHAPE.TRIANGLE]: [155, 89, 182], // purple
};
