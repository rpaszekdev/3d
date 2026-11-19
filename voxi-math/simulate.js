/**
 * Navier-Stokes solver on VoxelField.
 *
 * Implements the incompressible NS equations using finite differences:
 *   ∂v/∂t = -(v·∇)v - ∇p + ν∇²v + f
 *   ∇·v = 0  (incompressibility)
 *
 * Method: Split-step (Chorin projection):
 *   1. Advection:  v* = v - dt·(v·∇)v
 *   2. Diffusion:  v** = v* + dt·ν·∇²v*
 *   3. Force:      v*** = v** + dt·f
 *   4. Pressure:   solve ∇²p = (1/dt)·∇·v***
 *   5. Project:    v(t+1) = v*** - dt·∇p
 *
 * Boundary: no-slip walls (velocity = 0 at grid edges)
 */

export class NavierStokesSolver {
  constructor(field, options = {}) {
    this.field = field;
    this.viscosity = options.viscosity ?? 0.1;
    this.dt = options.dt ?? 0.1;
    this.pressureIterations = options.pressureIterations ?? 20;
    this.forces = options.forces ?? []; // [{x,y,z, fx,fy,fz}]
    this.time = 0;
    this.stepCount = 0;
    this.history = []; // stats per step for tracking blow-up
  }

  /** Advance one timestep (CFL-limited for stability) */
  step() {
    const { W, H, D } = this.field;

    // CFL condition: dt * maxVel / cellSize < 0.5
    const preStats = this.field.stats();
    const cellSize = this.field.minCellSize ?? 1;
    const maxSafedt =
      preStats.maxVel > 0.01 ? (0.4 * cellSize) / preStats.maxVel : this.dt;
    const dt = Math.min(this.dt, maxSafedt);
    this._currentDt = dt;

    const prev = this.field.clone();
    const temp = this.field.clone();

    // 1. Advection — semi-Lagrangian backtracing
    this._advect(prev, temp, dt);

    // 2. Diffusion — explicit Laplacian
    this._diffuse(temp, this.field, dt);

    // 3. External forces
    this._applyForces(this.field, dt);

    // 4+5. Pressure solve + projection (enforce incompressibility)
    this._project(this.field);

    // Enforce boundary conditions
    this._enforceBoundary(this.field);

    this.time += dt;
    this.stepCount++;

    // Track statistics
    const stats = this.field.stats();
    stats.time = this.time;
    stats.step = this.stepCount;
    this.history.push(stats);

    return stats;
  }

  /** Semi-Lagrangian advection: trace back along velocity, interpolate */
  _advect(src, dst, dt) {
    const { W, H, D } = src;
    for (let z = 1; z < D - 1; z++) {
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const c = src.get(x, y, z);
          // Trace back
          const bx = x - dt * c.vx;
          const by = y - dt * c.vy;
          const bz = z - dt * c.vz;
          // Trilinear interpolation
          const interp = this._interpolate(src, bx, by, bz);
          dst.set(x, y, z, interp);
        }
      }
    }
  }

  /** Trilinear interpolation */
  _interpolate(field, fx, fy, fz) {
    const { W, H, D } = field;
    const x0 = Math.max(0, Math.min(W - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(H - 2, Math.floor(fy)));
    const z0 = Math.max(0, Math.min(D - 2, Math.floor(fz)));
    const x1 = x0 + 1,
      y1 = y0 + 1,
      z1 = z0 + 1;
    const sx = fx - x0,
      sy = fy - y0,
      sz = fz - z0;

    const lerp = (a, b, t) => a + t * (b - a);
    const lerpCell = (a, b, t) => ({
      vx: lerp(a.vx, b.vx, t),
      vy: lerp(a.vy, b.vy, t),
      vz: lerp(a.vz, b.vz, t),
      p: lerp(a.p, b.p, t),
    });

    const c000 = field.get(x0, y0, z0),
      c100 = field.get(x1, y0, z0);
    const c010 = field.get(x0, y1, z0),
      c110 = field.get(x1, y1, z0);
    const c001 = field.get(x0, y0, z1),
      c101 = field.get(x1, y0, z1);
    const c011 = field.get(x0, y1, z1),
      c111 = field.get(x1, y1, z1);

    const c00 = lerpCell(c000, c100, sx);
    const c10 = lerpCell(c010, c110, sx);
    const c01 = lerpCell(c001, c101, sx);
    const c11 = lerpCell(c011, c111, sx);

    const c0 = lerpCell(c00, c10, sy);
    const c1 = lerpCell(c01, c11, sy);

    return lerpCell(c0, c1, sz);
  }

  /** Explicit diffusion: v += dt * ν * ∇²v */
  _diffuse(src, dst, dt) {
    const { W, H, D } = src;
    const coeff = dt * this.viscosity;

    for (let z = 1; z < D - 1; z++) {
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const c = src.get(x, y, z);
          const [xm, xp, ym, yp, zm, zp] = src.neighbors(x, y, z);

          // Laplacian for each component
          dst.set(x, y, z, {
            vx:
              c.vx +
              coeff *
                (xm.vx + xp.vx + ym.vx + yp.vx + zm.vx + zp.vx - 6 * c.vx),
            vy:
              c.vy +
              coeff *
                (xm.vy + xp.vy + ym.vy + yp.vy + zm.vy + zp.vy - 6 * c.vy),
            vz:
              c.vz +
              coeff *
                (xm.vz + xp.vz + ym.vz + yp.vz + zm.vz + zp.vz - 6 * c.vz),
            p: 0,
          });
        }
      }
    }
  }

  /** Apply external forces */
  _applyForces(field, dt) {
    for (const f of this.forces) {
      const c = field.get(f.x, f.y, f.z);
      field.set(f.x, f.y, f.z, {
        vx: c.vx + dt * (f.fx ?? 0),
        vy: c.vy + dt * (f.fy ?? 0),
        vz: c.vz + dt * (f.fz ?? 0),
        p: c.p,
      });
    }
  }

  /** Pressure projection — Jacobi iteration to enforce ∇·v = 0 */
  _project(field) {
    const { W, H, D } = field;

    // Compute divergence
    const div = new Float32Array(W * H * D);
    const p = new Float32Array(W * H * D);
    const idx = (x, y, z) => x + y * W + z * W * H;

    for (let z = 1; z < D - 1; z++) {
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const [xm, xp, ym, yp, zm, zp] = field.neighbors(x, y, z);
          div[idx(x, y, z)] =
            -0.5 * (xp.vx - xm.vx + (yp.vy - ym.vy) + (zp.vz - zm.vz));
        }
      }
    }

    // Jacobi iteration for pressure
    for (let iter = 0; iter < this.pressureIterations; iter++) {
      for (let z = 1; z < D - 1; z++) {
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const i = idx(x, y, z);
            p[i] =
              (div[i] +
                p[idx(x - 1, y, z)] +
                p[idx(x + 1, y, z)] +
                p[idx(x, y - 1, z)] +
                p[idx(x, y + 1, z)] +
                p[idx(x, y, z - 1)] +
                p[idx(x, y, z + 1)]) /
              6;
          }
        }
      }
    }

    // Subtract pressure gradient from velocity
    for (let z = 1; z < D - 1; z++) {
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const c = field.get(x, y, z);
          const i = idx(x, y, z);
          field.set(x, y, z, {
            vx: c.vx - 0.5 * (p[idx(x + 1, y, z)] - p[idx(x - 1, y, z)]),
            vy: c.vy - 0.5 * (p[idx(x, y + 1, z)] - p[idx(x, y - 1, z)]),
            vz: c.vz - 0.5 * (p[idx(x, y, z + 1)] - p[idx(x, y, z - 1)]),
            p: p[i],
          });
        }
      }
    }
  }

  /** No-slip boundary: zero velocity at edges */
  _enforceBoundary(field) {
    const { W, H, D } = field;
    const zero = { vx: 0, vy: 0, vz: 0, p: 0 };
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < H; y++) {
        field.set(0, y, z, zero);
        field.set(W - 1, y, z, zero);
      }
    }
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        field.set(x, 0, z, zero);
        field.set(x, H - 1, z, zero);
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        field.set(x, y, 0, zero);
        field.set(x, y, D - 1, zero);
      }
    }
  }
}
