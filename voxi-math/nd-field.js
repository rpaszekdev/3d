/**
 * nd-field.js — N-dimensional field with Mind's Eye visualization.
 *
 * Any dimension. Everything renders to text I can read.
 *
 * Representation:
 *   - Data: flat Float32Array indexed by [x0 + x1*D0 + x2*D0*D1 + ...]
 *   - Visualization: recursive slicing down to 2D grids
 *
 * For 4D: fix w → get 3D slice → Mind's Eye 6 views
 * For 5D: fix v,w → get 3D slice → Mind's Eye 6 views
 * For 6D: fix u,v,w → get 3D slice → Mind's Eye 6 views
 * Or: fix all but 2 dims → get 2D grid → display directly
 */

export class NDField {
  constructor(dims) {
    this.dims = dims; // [D0, D1, D2, ...] size along each axis
    this.ndim = dims.length;
    this.size = dims.reduce((a, b) => a * b, 1);
    this.data = new Float32Array(this.size);

    // Precompute strides
    this.strides = new Array(this.ndim);
    this.strides[0] = 1;
    for (let i = 1; i < this.ndim; i++) {
      this.strides[i] = this.strides[i - 1] * this.dims[i - 1];
    }
  }

  _idx(coords) {
    let idx = 0;
    for (let i = 0; i < this.ndim; i++) {
      idx += coords[i] * this.strides[i];
    }
    return idx;
  }

  _inBounds(coords) {
    for (let i = 0; i < this.ndim; i++) {
      if (coords[i] < 0 || coords[i] >= this.dims[i]) return false;
    }
    return true;
  }

  get(coords) {
    if (!this._inBounds(coords)) return 0;
    return this.data[this._idx(coords)];
  }

  set(coords, value) {
    if (!this._inBounds(coords)) return;
    this.data[this._idx(coords)] = value;
  }

  /** Get a 2D slice by fixing all dimensions except two free ones */
  slice2D(freeAxis0, freeAxis1, fixedCoords) {
    const w = this.dims[freeAxis0];
    const h = this.dims[freeAxis1];
    const grid = [];

    for (let y = h - 1; y >= 0; y--) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const coords = [...fixedCoords];
        coords[freeAxis0] = x;
        coords[freeAxis1] = y;
        row.push(this.get(coords));
      }
      grid.push(row);
    }
    return { grid, w, h };
  }

  /** Get a 3D sub-field by fixing higher dimensions */
  slice3D(fixedCoords) {
    // fixedCoords: {dimIndex: value} for all dims beyond the first 3
    const W = this.dims[0], H = this.dims[1], D = this.dims[2];
    const sub = new NDField([W, H, D]);

    for (let z = 0; z < D; z++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const coords = new Array(this.ndim).fill(0);
          coords[0] = x; coords[1] = y; coords[2] = z;
          for (const [dim, val] of Object.entries(fixedCoords)) {
            coords[parseInt(dim)] = val;
          }
          sub.set([x, y, z], this.get(coords));
        }
      }
    }
    return sub;
  }

  // ═══ Visualization ═══

  /** Render a 2D slice as ASCII grid */
  render2D(freeAxis0, freeAxis1, fixedCoords, opts = {}) {
    const { grid, w, h } = this.slice2D(freeAxis0, freeAxis1, fixedCoords);
    const chars = opts.chars ?? ' ·░▒▓█';
    const axisNames = opts.axisNames ?? this.dims.map((_, i) => `d${i}`);

    let max = 0;
    for (const row of grid) for (const v of row) if (Math.abs(v) > max) max = Math.abs(v);
    if (max === 0) max = 1;

    const lines = [];

    // Header: which dims are fixed
    const fixedStr = fixedCoords
      .map((v, i) => (i !== freeAxis0 && i !== freeAxis1) ? `${axisNames[i]}=${v}` : null)
      .filter(Boolean)
      .join(', ');
    lines.push(`[${axisNames[freeAxis0]} × ${axisNames[freeAxis1]}] ${fixedStr ? '(' + fixedStr + ')' : ''}`);

    for (const row of grid) {
      const line = row.map(v => {
        if (Math.abs(v) < max * 0.01) return chars[0];
        const normalized = Math.abs(v) / max;
        const idx = Math.min(chars.length - 1, Math.floor(normalized * chars.length));
        return chars[idx];
      }).join('');
      lines.push(line);
    }
    return lines.join('\n');
  }

  /** Render N-dim field as a series of 2D slices */
  renderND(opts = {}) {
    const axisNames = opts.axisNames ?? this.dims.map((_, i) => `d${i}`);
    const viewAxes = opts.viewAxes ?? [0, 1]; // which 2 axes to show as the 2D grid
    const sliceAxes = []; // all other axes — we iterate over these

    for (let i = 0; i < this.ndim; i++) {
      if (i !== viewAxes[0] && i !== viewAxes[1]) sliceAxes.push(i);
    }

    const lines = [];
    lines.push(`=== ${this.ndim}D Field (${this.dims.join('×')}) ===`);
    lines.push(`Viewing: ${axisNames[viewAxes[0]]} × ${axisNames[viewAxes[1]]}`);
    lines.push(`Slicing: ${sliceAxes.map(i => axisNames[i]).join(', ')}`);
    lines.push('');

    // Generate all combinations of fixed coords
    function* combos(axes, idx, current) {
      if (idx === axes.length) { yield [...current]; return; }
      const dim = axes[idx];
      // Sample: show 0, middle, and last for each axis
      const samples = [0, Math.floor((dims[dim] - 1) / 2), dims[dim] - 1]
        .filter((v, i, a) => a.indexOf(v) === i); // deduplicate
      for (const val of samples) {
        current[dim] = val;
        yield* combos(axes, idx + 1, current);
      }
    }

    const dims = this.dims;
    const baseCoords = new Array(this.ndim).fill(0);

    for (const coords of combos(sliceAxes, 0, baseCoords)) {
      const slice = this.render2D(viewAxes[0], viewAxes[1], coords, { ...opts, axisNames });
      lines.push(slice);
      lines.push('');
    }

    return lines.join('\n');
  }

  /** Quick stats */
  stats() {
    let min = Infinity, max = -Infinity, sum = 0, nonzero = 0;
    for (let i = 0; i < this.size; i++) {
      const v = this.data[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      if (Math.abs(v) > 1e-10) nonzero++;
    }
    return { min, max, mean: sum / this.size, nonzero, total: this.size };
  }
}

// ═══ Demos ═══

export function demo4D() {
  // 4D hypersphere: x² + y² + z² + w² ≤ R²
  const N = 12;
  const field = new NDField([N, N, N, N]);
  const center = N / 2;
  const R = N * 0.35;

  for (let w = 0; w < N; w++) {
    for (let z = 0; z < N; z++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const dist = Math.sqrt(
            (x - center) ** 2 + (y - center) ** 2 +
            (z - center) ** 2 + (w - center) ** 2
          );
          if (dist <= R) {
            field.set([x, y, z, w], R - dist); // value = distance from surface
          }
        }
      }
    }
  }
  return field;
}

export function demo5D() {
  // 5D: a 5-dimensional Gaussian
  const N = 8;
  const field = new NDField([N, N, N, N, N]);
  const center = N / 2;
  const sigma = N * 0.3;

  for (let v = 0; v < N; v++) {
    for (let w = 0; w < N; w++) {
      for (let z = 0; z < N; z++) {
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const dist2 = (x-center)**2 + (y-center)**2 + (z-center)**2 + (w-center)**2 + (v-center)**2;
            field.set([x, y, z, w, v], Math.exp(-dist2 / (2 * sigma * sigma)));
          }
        }
      }
    }
  }
  return field;
}
