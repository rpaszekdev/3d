#!/usr/bin/env node
/**
 * evolve.js — Run NS simulation with Mind's Eye observation.
 *
 * Usage:
 *   node evolve.js vortex-ring                    # flat grid (Level 1)
 *   node evolve.js collision --octree             # adaptive octree (Level 2)
 *   node evolve.js collision --octree --max-depth 6 --refine 0.3
 *   node evolve.js taylor-green --steps 50 --channel vorticity
 *
 * Outputs:
 *   - Stats per timestep (max velocity, max vorticity, energy)
 *   - Octree stats (leaf count, max depth, effective resolution)
 *   - VOXI animation file (viewable with Mind's Eye FRAME/FDIFF)
 *   - Blow-up warning if max vorticity growth rate is superlinear
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { VoxelField } from "./field.js";
import { OctreeField } from "./octree.js";
import { NavierStokesSolver } from "./simulate.js";
import { fieldToVoxi, simulationToVoxi } from "./channels.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──
const args = process.argv.slice(2);
const scenario = args.find((a) => !a.startsWith("--")) || "vortex-ring";
const totalSteps = parseInt(args[args.indexOf("--steps") + 1]) || 30;
const channel = args[args.indexOf("--channel") + 1] || "velocity";
const gridSize = parseInt(args[args.indexOf("--grid") + 1]) || 24;
const viscosity = parseFloat(args[args.indexOf("--viscosity") + 1]) || 0.05;
const useOctree = args.includes("--octree");
const maxOctreeDepth = parseInt(args[args.indexOf("--max-depth") + 1]) || 4;
const refineThresh = parseFloat(args[args.indexOf("--refine") + 1]) || 0.3;
const refineEvery = parseInt(args[args.indexOf("--refine-every") + 1]) || 3;

console.log(`\n=== VOXI Math: Navier-Stokes Evolution ===`);
console.log(`Scenario:  ${scenario}`);
console.log(
  `Grid:      ${gridSize}³${useOctree ? ` → octree (maxDepth=${maxOctreeDepth}, refine=${refineThresh})` : " (flat)"}`,
);
console.log(`Steps:     ${totalSteps}`);
console.log(`Viscosity: ${viscosity}`);
console.log(`Channel:   ${channel}\n`);

// ── Setup field ──
// Start with flat grid for initialization, convert to octree if requested
const flatField = new VoxelField(gridSize, gridSize, gridSize);
const center = Math.floor(gridSize / 2);

// ── Initial conditions by scenario ──
switch (scenario) {
  case "vortex-ring": {
    // A vortex ring — classic test case for vortex dynamics
    const R = Math.floor(gridSize * 0.3); // ring radius
    const r = Math.floor(gridSize * 0.08); // tube radius
    for (let z = 0; z < gridSize; z++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const dx = x - center,
            dz = z - center;
          const distFromAxis = Math.sqrt(dx * dx + dz * dz);
          const distFromRing = Math.sqrt(
            (distFromAxis - R) ** 2 + (y - center) ** 2,
          );

          if (distFromRing < r) {
            // Tangential velocity around the ring
            const angle = Math.atan2(dz, dx);
            const speed = 2.0 * (1 - distFromRing / r);
            flatField.set(x, y, z, {
              vx: -speed * Math.sin(angle),
              vy: 0,
              vz: speed * Math.cos(angle),
              p: 0,
            });
          }
        }
      }
    }
    console.log(`Initialized: vortex ring (R=${R}, r=${r})`);
    break;
  }

  case "collision": {
    // Two vortex tubes approaching each other — potential singularity candidate
    const tubeR = Math.floor(gridSize * 0.1);
    const offset = Math.floor(gridSize * 0.2);

    for (let z = 0; z < gridSize; z++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          // Tube 1: along Z axis, offset in X, moving +X
          const d1 = Math.sqrt(
            (x - (center - offset)) ** 2 + (y - center) ** 2,
          );
          if (d1 < tubeR) {
            const speed = 1.5 * (1 - d1 / tubeR);
            const c = flatField.get(x, y, z);
            flatField.set(x, y, z, {
              vx: speed * 0.5,
              vy: 0,
              vz: speed,
              p: c.p,
            });
          }

          // Tube 2: along Z axis, offset in +X, moving -X
          const d2 = Math.sqrt(
            (x - (center + offset)) ** 2 + (y - center) ** 2,
          );
          if (d2 < tubeR) {
            const speed = 1.5 * (1 - d2 / tubeR);
            const c = flatField.get(x, y, z);
            flatField.set(x, y, z, {
              vx: -speed * 0.5,
              vy: 0,
              vz: -speed,
              p: c.p,
            });
          }
        }
      }
    }
    console.log(`Initialized: two counter-rotating vortex tubes (r=${tubeR})`);
    break;
  }

  case "taylor-green": {
    // Taylor-Green vortex — exact solution for decay, good validation
    for (let z = 0; z < gridSize; z++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const px = (x / gridSize) * 2 * Math.PI;
          const py = (y / gridSize) * 2 * Math.PI;
          const pz = (z / gridSize) * 2 * Math.PI;
          flatField.set(x, y, z, {
            vx: Math.sin(px) * Math.cos(py) * Math.cos(pz),
            vy: -Math.cos(px) * Math.sin(py) * Math.cos(pz),
            vz: 0,
            p: 0,
          });
        }
      }
    }
    console.log("Initialized: Taylor-Green vortex");
    break;
  }

  case "head-on": {
    // Two vortex RINGS heading straight at each other
    // This is a known candidate for extreme vorticity concentration
    // The rings stretch each other on impact → vortex sheet → potential blow-up
    const R = Math.floor(gridSize * 0.25);
    const r = Math.max(2, Math.floor(gridSize * 0.06));
    const sep = Math.floor(gridSize * 0.2);

    for (let z = 0; z < gridSize; z++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const dx = x - center,
            dy = y - center;
          const distFromAxis = Math.sqrt(dx * dx + dy * dy);

          // Ring 1: at z = center - sep, moving +Z
          const dRing1 = Math.sqrt(
            (distFromAxis - R) ** 2 + (z - (center - sep)) ** 2,
          );
          if (dRing1 < r) {
            const angle = Math.atan2(dy, dx);
            const speed = 3.0 * (1 - dRing1 / r);
            const c = flatField.get(x, y, z);
            flatField.set(x, y, z, {
              vx: c.vx + -speed * Math.sin(angle),
              vy: c.vy + speed * Math.cos(angle),
              vz: c.vz + 1.0, // push toward center
              p: 0,
            });
          }

          // Ring 2: at z = center + sep, moving -Z (counter-rotating)
          const dRing2 = Math.sqrt(
            (distFromAxis - R) ** 2 + (z - (center + sep)) ** 2,
          );
          if (dRing2 < r) {
            const angle = Math.atan2(dy, dx);
            const speed = 3.0 * (1 - dRing2 / r);
            const c = flatField.get(x, y, z);
            flatField.set(x, y, z, {
              vx: c.vx + speed * Math.sin(angle),
              vy: c.vy + -speed * Math.cos(angle),
              vz: c.vz - 1.0, // push toward center
              p: 0,
            });
          }
        }
      }
    }
    console.log(
      `Initialized: head-on vortex ring collision (R=${R}, r=${r}, sep=${sep})`,
    );
    break;
  }

  case "jet": {
    // A high-speed focused jet hitting a wall of slower fluid
    // Creates extreme shear → Kelvin-Helmholtz instability → vortex roll-up
    const jetR = Math.max(2, Math.floor(gridSize * 0.08));
    const jetSpeed = 5.0;

    for (let z = 0; z < gridSize; z++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const dx = x - center,
            dy = y - center;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < jetR && z < center) {
            // Fast jet core moving +Z
            const speed = jetSpeed * (1 - dist / jetR);
            flatField.set(x, y, z, { vx: 0, vy: 0, vz: speed, p: 0 });
          } else if (dist < jetR * 3 && z >= center) {
            // Slow counter-flow
            flatField.set(x, y, z, { vx: 0, vy: 0, vz: -0.5, p: 0 });
          }
        }
      }
    }
    console.log(`Initialized: focused jet (r=${jetR}, speed=${jetSpeed})`);
    break;
  }

  case "kida": {
    // Kida vortex — known to produce intense vortex stretching in 3D
    // Three orthogonal vortex tubes that interact
    const tubeR = Math.max(2, Math.floor(gridSize * 0.12));
    const speed = 2.5;

    for (let z = 0; z < gridSize; z++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          let vx = 0,
            vy = 0,
            vz = 0;

          // Tube along X (vorticity in X direction)
          const dX = Math.sqrt((y - center) ** 2 + (z - center) ** 2);
          if (dX < tubeR) {
            const s = speed * (1 - dX / tubeR);
            vy += (-s * (z - center)) / Math.max(dX, 0.1);
            vz += (s * (y - center)) / Math.max(dX, 0.1);
          }

          // Tube along Y (vorticity in Y direction)
          const dY = Math.sqrt((x - center) ** 2 + (z - center) ** 2);
          if (dY < tubeR) {
            const s = speed * (1 - dY / tubeR);
            vx += (s * (z - center)) / Math.max(dY, 0.1);
            vz += (-s * (x - center)) / Math.max(dY, 0.1);
          }

          // Tube along Z (vorticity in Z direction)
          const dZ = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
          if (dZ < tubeR) {
            const s = speed * (1 - dZ / tubeR);
            vx += (-s * (y - center)) / Math.max(dZ, 0.1);
            vy += (s * (x - center)) / Math.max(dZ, 0.1);
          }

          if (vx !== 0 || vy !== 0 || vz !== 0) {
            flatField.set(x, y, z, { vx, vy, vz, p: 0 });
          }
        }
      }
    }
    console.log(`Initialized: Kida vortex (3 orthogonal tubes, r=${tubeR})`);
    break;
  }

  default:
    console.error(`Unknown scenario: ${scenario}`);
    console.error(
      "Available: vortex-ring, collision, taylor-green, head-on, jet, kida",
    );
    process.exit(1);
}

// ── Convert to octree if requested ──
const baseCellSize = parseInt(args[args.indexOf("--base-cell") + 1]) || 2;
const field = useOctree
  ? OctreeField.fromVoxelField(flatField, {
      maxDepth: maxOctreeDepth,
      refineThreshold: refineThresh,
      coarsenThreshold: refineThresh * 0.1,
      baseCellSize,
    })
  : flatField;

if (useOctree) {
  const refResult = field.adaptiveRefine();
  console.log(
    `Octree: ${refResult.leafCount} leaves, maxDepth=${refResult.maxDepth}, effectiveRes=${field.effectiveResolution}³`,
  );
}

// ── Initial stats ──
const initStats = field.stats();
console.log(
  `Initial: maxVel=${initStats.maxVel.toFixed(4)} at (${initStats.maxVelPos})`,
);
console.log(
  `         maxVort=${initStats.maxVort.toFixed(4)} at (${initStats.maxVortPos})`,
);
console.log(`         energy=${initStats.totalEnergy.toFixed(4)}\n`);

// ── Run simulation ──
const solver = new NavierStokesSolver(field, {
  viscosity,
  dt: 0.05,
  pressureIterations: 20,
});

// Generate initial VOXI snapshot
const initVoxi = fieldToVoxi(field, channel);
const outDir = path.join(__dirname, "output", `${scenario}-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "frame-000.voxi"), initVoxi);

if (useOctree) {
  console.log(
    "Step  | maxVel   | maxVort  | energy   | growth  | leaves  | depth | effRes",
  );
  console.log(
    "------|----------|----------|----------|---------|---------|-------|-------",
  );
} else {
  console.log("Step  | maxVel   | maxVort  | energy   | growth rate");
  console.log("------|----------|----------|----------|------------");
}

let prevMaxVort = initStats.maxVort;

for (let step = 1; step <= totalSteps; step++) {
  const stats = solver.step();

  // Growth rate of max vorticity (key blow-up indicator)
  const growthRate =
    prevMaxVort > 0
      ? (((stats.maxVort - prevMaxVort) / prevMaxVort) * 100).toFixed(1)
      : "N/A";
  prevMaxVort = stats.maxVort;

  // Adaptive refinement (octree only)
  if (useOctree && step % refineEvery === 0) {
    field.adaptiveRefine();
  }

  // Log every step
  const pad = (s, n) => String(s).padStart(n);
  if (useOctree) {
    console.log(
      `${pad(step, 5)} | ${pad(stats.maxVel.toFixed(4), 8)} | ` +
        `${pad(stats.maxVort.toFixed(4), 8)} | ${pad(stats.totalEnergy.toFixed(4), 8)} | ` +
        `${pad(growthRate + "%", 7)} | ${pad(stats.leafCount ?? "?", 7)} | ` +
        `${pad(stats.maxDepth ?? 0, 5)} | ${pad(field.effectiveResolution ?? gridSize, 5)}³`,
    );
  } else {
    console.log(
      `${pad(step, 5)} | ${pad(stats.maxVel.toFixed(4), 8)} | ` +
        `${pad(stats.maxVort.toFixed(4), 8)} | ${pad(stats.totalEnergy.toFixed(4), 8)} | ${growthRate}%`,
    );
  }

  // Save VOXI snapshot every 5 steps
  if (step % 5 === 0 || step === totalSteps) {
    const voxi = fieldToVoxi(field, channel);
    fs.writeFileSync(
      path.join(outDir, `frame-${String(step).padStart(3, "0")}.voxi`),
      voxi,
    );
  }

  // Blow-up warning
  if (stats.maxVort > initStats.maxVort * 100) {
    console.log(`\n⚠ BLOW-UP WARNING: vorticity grew 100x from initial!`);
    console.log(`  Location: (${stats.maxVortPos})`);
    console.log(`  This is where an octree would refine.\n`);
  }
}

// ── Generate animated VOXI ──
console.log(`\nGenerating animated VOXI...`);

// Reset and re-run for animation file
const animField = new VoxelField(gridSize, gridSize, gridSize);
// Re-initialize (copy initial setup)
// For now, just save the snapshots we already have
const snapshotFiles = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith(".voxi"))
  .sort();
const animLines = [`V ${gridSize} ${gridSize} ${gridSize}`];
for (const file of snapshotFiles) {
  const step = parseInt(file.replace("frame-", "").replace(".voxi", ""));
  const content = fs.readFileSync(path.join(outDir, file), "utf8");
  // Extract just the P lines (skip V header)
  const pLines = content.split("\n").filter((l) => l.startsWith("P "));
  animLines.push(`\nT ${step}`);
  animLines.push(`-- frame ${step}`);
  animLines.push(...pLines);
}
fs.writeFileSync(path.join(outDir, "animation.voxi"), animLines.join("\n"));

// ── Summary ──
const final = solver.history[solver.history.length - 1];
console.log(`\n=== Summary ===`);
console.log(`Steps:     ${totalSteps}`);
console.log(
  `Final:     maxVel=${final.maxVel.toFixed(4)}, maxVort=${final.maxVort.toFixed(4)}, energy=${final.totalEnergy.toFixed(4)}`,
);
console.log(`Output:    ${outDir}/`);
console.log(`Animation: ${outDir}/animation.voxi`);
console.log(`\nView with Mind's Eye:`);
console.log(`  node ../voxi-reasoning/minds-eye.js ${outDir}/animation.voxi`);
console.log(`  > FRAMES`);
console.log(`  > FRAME 0 front`);
console.log(`  > FRAME ${totalSteps} front`);
console.log(`  > FDIFF 0 ${totalSteps}`);
