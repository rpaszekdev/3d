/**
 * OctreeField — Adaptive-resolution 3D field using an octree.
 *
 * Same interface as VoxelField (get/set/neighbors/gradient/vorticity/magnitude/stats)
 * but auto-refines regions where gradients exceed a threshold.
 *
 * Structure:
 *   - Root node covers [0,0,0] to [W,H,D]
 *   - Each node is either a LEAF (stores {vx,vy,vz,p}) or BRANCH (has 8 children)
 *   - Refinement: when gradient at a leaf exceeds threshold → split into 8 children
 *   - Coarsening: when all 8 children are similar → merge back into leaf
 *   - Max depth controls minimum cell size (depth N → cell size = W/2^N)
 */

const ZERO = { vx: 0, vy: 0, vz: 0, p: 0 };

class OctreeNode {
  constructor(x, y, z, size, depth) {
    this.x = x; // origin corner
    this.y = y;
    this.z = z;
    this.size = size; // side length of this cube
    this.depth = depth;
    this.children = null; // null = leaf, Array(8) = branch
    this.data = { vx: 0, vy: 0, vz: 0, p: 0 };
  }

  get isLeaf() {
    return this.children === null;
  }

  /** Which octant does point (px,py,pz) fall into? Returns 0-7 */
  _octant(px, py, pz) {
    const half = this.size / 2;
    const mx = this.x + half,
      my = this.y + half,
      mz = this.z + half;
    return (px >= mx ? 1 : 0) | (py >= my ? 2 : 0) | (pz >= mz ? 4 : 0);
  }

  /** Get child origin for octant index */
  _childOrigin(idx) {
    const half = this.size / 2;
    return {
      x: this.x + (idx & 1 ? half : 0),
      y: this.y + (idx & 2 ? half : 0),
      z: this.z + (idx & 4 ? half : 0),
    };
  }

  /** Split this leaf into 8 children, each inheriting current data */
  split() {
    if (!this.isLeaf) return;
    const half = this.size / 2;
    if (half < 1) return; // can't split below size 1

    this.children = new Array(8);
    for (let i = 0; i < 8; i++) {
      const o = this._childOrigin(i);
      this.children[i] = new OctreeNode(o.x, o.y, o.z, half, this.depth + 1);
      // Copy parent data to all children
      this.children[i].data = { ...this.data };
    }
  }

  /** Merge: collapse 8 children back into this leaf (average values) */
  merge() {
    if (this.isLeaf) return;
    let vx = 0,
      vy = 0,
      vz = 0,
      p = 0;
    for (const child of this.children) {
      vx += child.data.vx;
      vy += child.data.vy;
      vz += child.data.vz;
      p += child.data.p;
    }
    this.data = { vx: vx / 8, vy: vy / 8, vz: vz / 8, p: p / 8 };
    this.children = null;
  }

  /** Check if point is inside this node's bounds */
  contains(px, py, pz) {
    return (
      px >= this.x &&
      px < this.x + this.size &&
      py >= this.y &&
      py < this.y + this.size &&
      pz >= this.z &&
      pz < this.z + this.size
    );
  }
}

export class OctreeField {
  constructor(W, H, D, options = {}) {
    this.W = W;
    this.H = H;
    this.D = D;
    this.maxDepth = options.maxDepth ?? 6;
    this.refineThreshold = options.refineThreshold ?? 0.5;
    this.coarsenThreshold = options.coarsenThreshold ?? 0.05;

    // Root covers the full grid — must be power of 2 for clean octree
    const maxDim = Math.max(W, H, D);
    this.rootSize = 1;
    while (this.rootSize < maxDim) this.rootSize *= 2;

    this.root = new OctreeNode(0, 0, 0, this.rootSize, 0);

    // Stats tracking
    this._leafCount = 1;
    this._maxDepthReached = 0;
    this._refinements = 0;
  }

  _inBounds(x, y, z) {
    return x >= 0 && x < this.W && y >= 0 && y < this.H && z >= 0 && z < this.D;
  }

  /** Find the leaf node containing point (x,y,z) */
  _findLeaf(x, y, z) {
    let node = this.root;
    while (!node.isLeaf) {
      const oct = node._octant(x, y, z);
      node = node.children[oct];
    }
    return node;
  }

  /**
   * Get value at integer coordinates with ghost-cell interpolation.
   *
   * When the query point falls in a coarse cell, we interpolate between
   * the coarse cell and its neighbors to produce a smooth value.
   * This prevents step-function discontinuities at resolution boundaries.
   */
  get(x, y, z) {
    if (!this._inBounds(x, y, z)) return { ...ZERO };
    const leaf = this._findLeaf(x, y, z);

    // If the cell is fine (size 1-2), just return raw value — no interpolation needed
    if (leaf.size <= 2) return { ...leaf.data };

    // Coarse cell — interpolate based on position within cell
    // This smooths the transition between coarse and fine regions
    const cx = leaf.x + leaf.size / 2; // cell center
    const cy = leaf.y + leaf.size / 2;
    const cz = leaf.z + leaf.size / 2;

    // How far is the query from cell center? (normalized -0.5 to 0.5)
    const fx = (x - cx) / leaf.size;
    const fy = (y - cy) / leaf.size;
    const fz = (z - cz) / leaf.size;

    // Get neighbors (raw, no recursion — find their leaf directly)
    const nx = Math.floor(fx > 0 ? leaf.x + leaf.size + 1 : leaf.x - 1);
    const ny = Math.floor(fy > 0 ? leaf.y + leaf.size + 1 : leaf.y - 1);
    const nz = Math.floor(fz > 0 ? leaf.z + leaf.size + 1 : leaf.z - 1);

    const c = leaf.data;
    const lx = this._inBounds(nx, y, z) ? this._findLeaf(nx, y, z).data : ZERO;
    const ly = this._inBounds(x, ny, z) ? this._findLeaf(x, ny, z).data : ZERO;
    const lz = this._inBounds(x, y, nz) ? this._findLeaf(x, y, nz).data : ZERO;

    // Weights based on distance from center (0 at center, 0.5 at edge)
    // Clamped so they never go negative
    const rawX = Math.abs(fx),
      rawY = Math.abs(fy),
      rawZ = Math.abs(fz);
    const totalRaw = rawX + rawY + rawZ;
    // Normalize neighbor weights to max 0.6, keep center dominant
    const scale = totalRaw > 0.6 ? 0.6 / totalRaw : 1;
    const wx = rawX * scale;
    const wy = rawY * scale;
    const wz = rawZ * scale;
    const wc = 1 - wx - wy - wz;
    const totalW = 1;

    return {
      vx: (wc * c.vx + wx * lx.vx + wy * ly.vx + wz * lz.vx) / totalW,
      vy: (wc * c.vy + wx * lx.vy + wy * ly.vy + wz * lz.vy) / totalW,
      vz: (wc * c.vz + wx * lx.vz + wy * ly.vz + wz * lz.vz) / totalW,
      p: (wc * c.p + wx * lx.p + wy * ly.p + wz * lz.p) / totalW,
    };
  }

  /** Get raw value without interpolation (for stats/export) */
  getRaw(x, y, z) {
    if (!this._inBounds(x, y, z)) return { ...ZERO };
    const leaf = this._findLeaf(x, y, z);
    return { ...leaf.data };
  }

  /**
   * Set value at the EXISTING leaf containing (x,y,z).
   * Does NOT split — writes to whatever resolution is there.
   * This is what the solver should use during simulation.
   */
  set(x, y, z, value) {
    if (!this._inBounds(x, y, z)) return;
    const leaf = this._findLeaf(x, y, z);
    leaf.data = { ...value };
  }

  /** Set value and force split to cell-size-1 (for precise initialization) */
  setExact(x, y, z, value) {
    if (!this._inBounds(x, y, z)) return;
    this._ensureDepth(x, y, z, this._depthForSize(1));
    const leaf = this._findLeaf(x, y, z);
    leaf.data = { ...value };
  }

  /** Set value at a coarse level — only splits to targetDepth */
  setCoarse(x, y, z, value, targetDepth) {
    if (!this._inBounds(x, y, z)) return;
    this._ensureDepth(x, y, z, targetDepth);
    const leaf = this._findLeaf(x, y, z);
    leaf.data = { ...value };
  }

  /** Ensure a point is refined to at least the given depth */
  _ensureDepth(x, y, z, targetDepth) {
    let node = this.root;
    while (node.depth < targetDepth) {
      if (node.isLeaf) {
        node.split();
        this._leafCount += 7; // replaced 1 leaf with 8
        this._refinements++;
      }
      const oct = node._octant(x, y, z);
      node = node.children[oct];
    }
  }

  /** What depth corresponds to a given cell size? */
  _depthForSize(cellSize) {
    let d = 0,
      s = this.rootSize;
    while (s > cellSize && d < this.maxDepth) {
      s /= 2;
      d++;
    }
    return d;
  }

  /** 6-connected neighbors (at same or coarser resolution) */
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

  /** Vorticity w = curl(v) */
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

  /** Velocity magnitude */
  magnitude(x, y, z) {
    const c = this.get(x, y, z);
    return Math.sqrt(c.vx ** 2 + c.vy ** 2 + c.vz ** 2);
  }

  // ── Adaptive refinement ─────────────────────────────────────

  /** Refine regions where gradient exceeds threshold */
  adaptiveRefine() {
    const before = this._leafCount;
    this._refineNode(this.root);
    return {
      leafCount: this._leafCount,
      added: this._leafCount - before,
      maxDepth: this._maxDepthReached,
      refinements: this._refinements,
    };
  }

  _refineNode(node) {
    if (!node.isLeaf) {
      // Recurse into children
      for (const child of node.children) {
        this._refineNode(child);
      }
      // Try to coarsen if all children are calm leaves
      this._tryCoarsen(node);
      return;
    }

    // Leaf node — check if it needs refinement
    if (node.depth >= this.maxDepth) return;
    if (node.size <= 1) return;

    // Sample gradient at the center of this leaf
    const cx = Math.floor(node.x + node.size / 2);
    const cy = Math.floor(node.y + node.size / 2);
    const cz = Math.floor(node.z + node.size / 2);

    if (!this._inBounds(cx, cy, cz)) return;

    const grad = this.gradient(cx, cy, cz);
    const gradMag = Math.sqrt(grad.dx ** 2 + grad.dy ** 2 + grad.dz ** 2);

    const w = this.vorticity(cx, cy, cz);
    const vortMag = Math.sqrt(w.wx ** 2 + w.wy ** 2 + w.wz ** 2);

    // Refine if gradient or vorticity is high
    if (gradMag > this.refineThreshold || vortMag > this.refineThreshold) {
      node.split();
      this._leafCount += 7;
      this._refinements++;
      if (node.depth + 1 > this._maxDepthReached) {
        this._maxDepthReached = node.depth + 1;
      }
      // Recurse into new children
      for (const child of node.children) {
        this._refineNode(child);
      }
    }
  }

  /** Coarsen: merge children back if all are calm leaves */
  _tryCoarsen(node) {
    if (node.isLeaf) return;

    // All children must be leaves
    for (const child of node.children) {
      if (!child.isLeaf) return;
    }

    // Check if all children are similar enough to merge
    let maxDiff = 0;
    const first = node.children[0].data;
    for (let i = 1; i < 8; i++) {
      const c = node.children[i].data;
      const diff =
        Math.abs(c.vx - first.vx) +
        Math.abs(c.vy - first.vy) +
        Math.abs(c.vz - first.vz) +
        Math.abs(c.p - first.p);
      if (diff > maxDiff) maxDiff = diff;
    }

    if (maxDiff < this.coarsenThreshold) {
      node.merge();
      this._leafCount -= 7;
    }
  }

  // ── Stats ─────────────────────────────────────────────────

  stats() {
    let maxVel = 0,
      maxVort = 0,
      totalEnergy = 0;
    let maxVelPos = [0, 0, 0],
      maxVortPos = [0, 0, 0];

    // Walk all leaves
    this._walkLeaves(this.root, (node) => {
      const cx = Math.floor(node.x + node.size / 2);
      const cy = Math.floor(node.y + node.size / 2);
      const cz = Math.floor(node.z + node.size / 2);

      if (!this._inBounds(cx, cy, cz)) return;

      const vel = Math.sqrt(
        node.data.vx ** 2 + node.data.vy ** 2 + node.data.vz ** 2,
      );
      const volume = node.size ** 3;

      if (vel > maxVel) {
        maxVel = vel;
        maxVelPos = [cx, cy, cz];
      }

      // Vorticity at leaf center
      const w = this.vorticity(cx, cy, cz);
      const vort = Math.sqrt(w.wx ** 2 + w.wy ** 2 + w.wz ** 2);
      if (vort > maxVort) {
        maxVort = vort;
        maxVortPos = [cx, cy, cz];
      }

      totalEnergy += 0.5 * vel * vel * volume;
    });

    return {
      maxVel,
      maxVelPos,
      maxVort,
      maxVortPos,
      totalEnergy,
      leafCount: this._leafCount,
      maxDepth: this._maxDepthReached,
      refinements: this._refinements,
    };
  }

  _walkLeaves(node, fn) {
    if (node.isLeaf) {
      fn(node);
      return;
    }
    for (const child of node.children) {
      this._walkLeaves(child, fn);
    }
  }

  /** Minimum cell size currently in the tree */
  get minCellSize() {
    return this.rootSize / 2 ** this._maxDepthReached;
  }

  /** Effective resolution (equivalent uniform grid) */
  get effectiveResolution() {
    return 2 ** this._maxDepthReached;
  }

  // ── Clone ─────────────────────────────────────────────────

  clone() {
    const copy = new OctreeField(this.W, this.H, this.D, {
      maxDepth: this.maxDepth,
      refineThreshold: this.refineThreshold,
      coarsenThreshold: this.coarsenThreshold,
    });
    copy.root = this._cloneNode(this.root);
    copy._leafCount = this._leafCount;
    copy._maxDepthReached = this._maxDepthReached;
    copy._refinements = this._refinements;
    return copy;
  }

  _cloneNode(node) {
    const copy = new OctreeNode(node.x, node.y, node.z, node.size, node.depth);
    copy.data = { ...node.data };
    if (!node.isLeaf) {
      copy.children = node.children.map((c) => this._cloneNode(c));
    }
    return copy;
  }

  // ── Import from VoxelField ────────────────────────────────

  /**
   * Copy data from a flat VoxelField into this octree at COARSE resolution.
   *
   * baseCellSize: initial cell size (default 4 → groups of 4x4x4 averaged)
   * maxDepth: how deep adaptive refinement can go beyond the base
   *
   * This is the key: start coarse, then adaptiveRefine() adds detail
   * only where gradients are high. This is real AMR.
   */
  static fromVoxelField(flatField, options = {}) {
    const W = flatField.W,
      H = flatField.H,
      D = flatField.D;
    const baseCellSize = options.baseCellSize ?? 4;
    const tree = new OctreeField(W, H, D, options);

    // Base depth = where cells are baseCellSize
    const baseDepth = tree._depthForSize(baseCellSize);

    // Walk through the flat field in blocks of baseCellSize³
    // Average each block into a single coarse cell
    for (let bz = 0; bz < D; bz += baseCellSize) {
      for (let by = 0; by < H; by += baseCellSize) {
        for (let bx = 0; bx < W; bx += baseCellSize) {
          let sumVx = 0,
            sumVy = 0,
            sumVz = 0,
            sumP = 0;
          let count = 0;
          let hasData = false;

          // Average all voxels in this block
          for (let dz = 0; dz < baseCellSize && bz + dz < D; dz++) {
            for (let dy = 0; dy < baseCellSize && by + dy < H; dy++) {
              for (let dx = 0; dx < baseCellSize && bx + dx < W; dx++) {
                const val = flatField.get(bx + dx, by + dy, bz + dz);
                sumVx += val.vx;
                sumVy += val.vy;
                sumVz += val.vz;
                sumP += val.p;
                count++;
                if (val.vx !== 0 || val.vy !== 0 || val.vz !== 0)
                  hasData = true;
              }
            }
          }

          if (!hasData) continue;

          // Set the averaged value at the center of this block
          const cx = bx + Math.floor(baseCellSize / 2);
          const cy = by + Math.floor(baseCellSize / 2);
          const cz = bz + Math.floor(baseCellSize / 2);

          tree.setCoarse(
            cx,
            cy,
            cz,
            {
              vx: sumVx / count,
              vy: sumVy / count,
              vz: sumVz / count,
              p: sumP / count,
            },
            baseDepth,
          );
        }
      }
    }

    tree._maxDepthReached = baseDepth;
    return tree;
  }
}
