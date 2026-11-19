/**
 * Channels — convert VoxelField data into VOXI color codes.
 *
 * Each channel maps a scalar field value → VOXI color (0-f hex).
 * This bridges the simulation (float values) with the Mind's Eye (integer colors).
 */

/** Map a value [0, max] to VOXI color 0-9, with thresholds */
function quantize(value, max) {
  if (value <= 0 || max <= 0) return -1; // empty
  const normalized = Math.min(value / max, 1);
  return Math.min(9, Math.floor(normalized * 10));
}

/** Color scheme: blue(3)=slow → cyan(4)=medium → yellow(6)=fast → red(1)=extreme */
const VELOCITY_COLORS = [
  -1,  // 0: below threshold → empty
  3,   // 1: very slow (blue)
  3,   // 2: slow (blue)
  4,   // 3: medium-slow (cyan)
  4,   // 4: medium (cyan)
  6,   // 5: medium-fast (yellow)
  6,   // 6: fast (yellow)
  7,   // 7: very fast (orange)
  1,   // 8: extreme (red)
  1,   // 9: blow-up candidate (red)
];

/** Convert field to VOXI code for a single channel */
export function fieldToVoxi(field, channel = "velocity", options = {}) {
  const { W, H, D } = field;
  const threshold = options.threshold ?? 0.01;
  const maxVal = options.maxVal ?? null;

  // First pass: find max value for normalization
  let autoMax = 0;
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const val = _sampleChannel(field, x, y, z, channel);
        if (val > autoMax) autoMax = val;
      }
    }
  }
  const scaleMax = maxVal ?? autoMax;
  if (scaleMax <= 0) return `V ${W} ${H} ${D}\n-- empty field`;

  // Second pass: generate VOXI points
  const lines = [`V ${W} ${H} ${D}`];
  lines.push(`-- Channel: ${channel}, max=${scaleMax.toFixed(4)}`);

  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const val = _sampleChannel(field, x, y, z, channel);
        if (val < threshold) continue;

        const q = quantize(val, scaleMax);
        if (q < 0) continue;

        const color = channel === "velocity"
          ? VELOCITY_COLORS[q] ?? q
          : q;

        if (color >= 0) {
          lines.push(`P ${x} ${y} ${z} ${color.toString(16)}`);
        }
      }
    }
  }

  return lines.join("\n");
}

/** Generate multi-frame VOXI from simulation history */
export function simulationToVoxi(field, solver, steps, channel = "velocity", options = {}) {
  const { W, H, D } = field;
  const lines = [`V ${W} ${H} ${D}`];
  const frameInterval = options.frameInterval ?? 1;

  // Find global max across all steps for consistent coloring
  let globalMax = 0;
  const snapshots = [];

  // Run simulation, capture snapshots
  for (let s = 0; s < steps; s++) {
    if (s % frameInterval === 0) {
      const snap = _captureFrame(field, channel);
      snapshots.push({ step: s, data: snap.data, max: snap.max });
      if (snap.max > globalMax) globalMax = snap.max;
    }
    solver.step();
  }
  // Capture final frame
  const finalSnap = _captureFrame(field, channel);
  snapshots.push({ step: steps, data: finalSnap.data, max: finalSnap.max });
  if (finalSnap.max > globalMax) globalMax = finalSnap.max;

  // Generate VOXI frames
  for (const snap of snapshots) {
    lines.push(`\nT ${snap.step}`);
    lines.push(`-- step=${snap.step}, localMax=${snap.max.toFixed(4)}, globalMax=${globalMax.toFixed(4)}`);

    for (const { x, y, z, val } of snap.data) {
      const q = quantize(val, globalMax);
      const color = channel === "velocity"
        ? VELOCITY_COLORS[q] ?? q
        : q;
      if (color >= 0) {
        lines.push(`P ${x} ${y} ${z} ${color.toString(16)}`);
      }
    }
  }

  return lines.join("\n");
}

/** Sample a channel value at a point */
function _sampleChannel(field, x, y, z, channel) {
  switch (channel) {
    case "velocity":
      return field.magnitude(x, y, z);
    case "vorticity": {
      const w = field.vorticity(x, y, z);
      return Math.sqrt(w.wx ** 2 + w.wy ** 2 + w.wz ** 2);
    }
    case "pressure":
      return Math.abs(field.get(x, y, z).p);
    case "vx":
      return Math.abs(field.get(x, y, z).vx);
    case "vy":
      return Math.abs(field.get(x, y, z).vy);
    case "vz":
      return Math.abs(field.get(x, y, z).vz);
    default:
      return field.magnitude(x, y, z);
  }
}

/** Capture all non-zero voxels for a frame */
function _captureFrame(field, channel) {
  const { W, H, D } = field;
  const data = [];
  let max = 0;

  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const val = _sampleChannel(field, x, y, z, channel);
        if (val > 0.01) {
          data.push({ x, y, z, val });
          if (val > max) max = val;
        }
      }
    }
  }

  return { data, max };
}
