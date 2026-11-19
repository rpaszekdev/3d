/**
 * VoxelField — 3D grid storing velocity + pressure per cell.
 *
 * This is the single source of truth for simulation and visualization.
 * Interface is designed to be swappable with an octree later.
 *
 * Storage: Float32Array with 4 components per cell (vx, vy, vz, pressure)
 * Layout: [vx, vy, vz, p, vx, vy, vz, p, ...] in x-major order
 */

export class VoxelField {
  constructor(W, H, D) {
    this.W = W;
    this.H = H;
    this.D = D;
    this.data = new Float32Array(W * H * D * 4);
  }

  _idx(x, y, z) {
    return (x + y * this.W + z * this.W * this.H) * 4;
  }

  get minCellSize() {
    return 1;
  }
  get effectiveResolution() {
    return this.W;
  }

  _inBounds(x, y, z) {
    return x >= 0 && x < this.W && y >= 0 && y < this.H && z >= 0 && z < this.D;
  }

  get(x, y, z) {
    if (!this._inBounds(x, y, z)) return { vx: 0, vy: 0, vz: 0, p: 0 };
    const i = this._idx(x, y, z);
    return {
      vx: this.data[i],
      vy: this.data[i + 1],
      vz: this.data[i + 2],
      p: this.data[i + 3],
    };
  }

  set(x, y, z, { vx, vy, vz, p }) {
    if (!this._inBounds(x, y, z)) return;
    const i = this._idx(x, y, z);
    this.data[i] = vx;
    this.data[i + 1] = vy;
    this.data[i + 2] = vz;
    this.data[i + 3] = p;
  }

  /** 6-connected neighbors */
  neighbors(x, y, z) {
    return [
      this.get(x - 1, y, z),
      this.get(x + 1, y, z),
      this.get(x, y - 1, z),
      this.get(x, y + 1, z),
      this.get(x, y, z - 1),
      this.get(x, y, z + 1),
    ];
  }

  /** Central-difference gradient of velocity magnitude */
  gradient(x, y, z) {
    const mag = (c) => Math.sqrt(c.vx ** 2 + c.vy ** 2 + c.vz ** 2);
    return {
      dx: (mag(this.get(x + 1, y, z)) - mag(this.get(x - 1, y, z))) / 2,
      dy: (mag(this.get(x, y + 1, z)) - mag(this.get(x, y - 1, z))) / 2,
      dz: (mag(this.get(x, y, z + 1)) - mag(this.get(x, y, z - 1))) / 2,
    };
  }

  /** Vorticity ω = ∇ × v (curl of velocity) */
  vorticity(x, y, z) {
    const xp = this.get(x + 1, y, z),
      xm = this.get(x - 1, y, z);
    const yp = this.get(x, y + 1, z),
      ym = this.get(x, y - 1, z);
    const zp = this.get(x, y, z + 1),
      zm = this.get(x, y, z - 1);
    return {
      wx: (yp.vz - ym.vz) / 2 - (zp.vy - zm.vy) / 2,
      wy: (zp.vx - zm.vx) / 2 - (xp.vz - xm.vz) / 2,
      wz: (xp.vy - xm.vy) / 2 - (yp.vx - ym.vx) / 2,
    };
  }

  /** Velocity magnitude at a point */
  magnitude(x, y, z) {
    const c = this.get(x, y, z);
    return Math.sqrt(c.vx ** 2 + c.vy ** 2 + c.vz ** 2);
  }

  /** Global statistics for tracking blow-up */
  stats() {
    let maxVel = 0,
      maxVort = 0,
      totalEnergy = 0;
    let maxVelPos = [0, 0, 0],
      maxVortPos = [0, 0, 0];

    for (let z = 1; z < this.D - 1; z++) {
      for (let y = 1; y < this.H - 1; y++) {
        for (let x = 1; x < this.W - 1; x++) {
          const vel = this.magnitude(x, y, z);
          if (vel > maxVel) {
            maxVel = vel;
            maxVelPos = [x, y, z];
          }

          const w = this.vorticity(x, y, z);
          const vort = Math.sqrt(w.wx ** 2 + w.wy ** 2 + w.wz ** 2);
          if (vort > maxVort) {
            maxVort = vort;
            maxVortPos = [x, y, z];
          }

          totalEnergy += 0.5 * vel * vel;
        }
      }
    }

    return { maxVel, maxVelPos, maxVort, maxVortPos, totalEnergy };
  }

  /** Clone the field (for double-buffering in simulation) */
  clone() {
    const copy = new VoxelField(this.W, this.H, this.D);
    copy.data.set(this.data);
    return copy;
  }
}
