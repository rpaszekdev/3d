#!/usr/bin/env node
/**
 * inspect.js — Interactive Navier-Stokes simulation controller.
 *
 * Full manual control: step one at a time, inspect any view,
 * refine the octree, save snapshots, adjust parameters on the fly.
 *
 * Commands:
 *   STEP [N]          Advance N timesteps (default 1)
 *   LOOK view         Mind's Eye view (front/back/left/right/top/bottom)
 *   SLICE axis=N      Cross-section (y=16, x=8, z=12)
 *   ZOOM cx cy cz r   Zoom into region
 *   STATS             Show max velocity, vorticity, energy, octree info
 *   HISTORY           Show stats for all past steps
 *   SAVE [name]       Save current state as .voxi snapshot
 *   REFINE            Force adaptive refinement now
 *   COARSEN           Force coarsening of calm regions
 *   SET key value     Change parameter (viscosity, dt, refine-threshold)
 *   CHANNEL name      Switch view channel (velocity/vorticity/pressure)
 *   REWIND N          Go back to step N (from saved checkpoints)
 *   WATCH x y z       Track a specific point across steps
 *   HELP              Show all commands
 *   QUIT              Exit
 *
 * Usage:
 *   node inspect.js kida --grid 32 --viscosity 0.01
 *   node inspect.js jet --octree --grid 32
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { VoxelField } from "./field.js";
import { OctreeField } from "./octree.js";
import { NavierStokesSolver } from "./simulate.js";
import { fieldToVoxi } from "./channels.js";

import { textViewFromCode } from "../voxi-reasoning/text-view.js";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──
const args = process.argv.slice(2);
const scenario = args.find((a) => !a.startsWith("--")) || "kida";
const gridSize = parseInt(args[args.indexOf("--grid") + 1]) || 32;
const useOctree = args.includes("--octree");
const maxDepth = parseInt(args[args.indexOf("--max-depth") + 1]) || 6;
const baseCellSize = parseInt(args[args.indexOf("--base-cell") + 1]) || 2;

let viscosity = parseFloat(args[args.indexOf("--viscosity") + 1]) || 0.01;
let dt = parseFloat(args[args.indexOf("--dt") + 1]) || 0.05;
let refineThreshold = parseFloat(args[args.indexOf("--refine") + 1]) || 0.1;
let channel = "velocity";

// ── Initialize field ──
const flatField = new VoxelField(gridSize, gridSize, gridSize);
const center = Math.floor(gridSize / 2);

// Scenario setup (same as evolve.js)
function initScenario(field, name) {
  const G = field.W;
  const c = Math.floor(G / 2);

  switch (name) {
    case "kida": {
      const tubeR = Math.max(2, Math.floor(G * 0.12));
      const speed = 2.5;
      for (let z = 0; z < G; z++)
        for (let y = 0; y < G; y++)
          for (let x = 0; x < G; x++) {
            let vx = 0,
              vy = 0,
              vz = 0;
            const dX = Math.sqrt((y - c) ** 2 + (z - c) ** 2);
            if (dX < tubeR) {
              const s = speed * (1 - dX / tubeR);
              vy += (-s * (z - c)) / Math.max(dX, 0.1);
              vz += (s * (y - c)) / Math.max(dX, 0.1);
            }
            const dY = Math.sqrt((x - c) ** 2 + (z - c) ** 2);
            if (dY < tubeR) {
              const s = speed * (1 - dY / tubeR);
              vx += (s * (z - c)) / Math.max(dY, 0.1);
              vz += (-s * (x - c)) / Math.max(dY, 0.1);
            }
            const dZ = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
            if (dZ < tubeR) {
              const s = speed * (1 - dZ / tubeR);
              vx += (-s * (y - c)) / Math.max(dZ, 0.1);
              vy += (s * (x - c)) / Math.max(dZ, 0.1);
            }
            if (vx || vy || vz) field.set(x, y, z, { vx, vy, vz, p: 0 });
          }
      return `Kida vortex (3 tubes, r=${tubeR})`;
    }
    case "taylor-green": {
      for (let z = 0; z < G; z++)
        for (let y = 0; y < G; y++)
          for (let x = 0; x < G; x++) {
            const px = (x / G) * 2 * Math.PI,
              py = (y / G) * 2 * Math.PI,
              pz = (z / G) * 2 * Math.PI;
            field.set(x, y, z, {
              vx: Math.sin(px) * Math.cos(py) * Math.cos(pz),
              vy: -Math.cos(px) * Math.sin(py) * Math.cos(pz),
              vz: 0,
              p: 0,
            });
          }
      return "Taylor-Green vortex";
    }
    case "jet": {
      const jetR = Math.max(2, Math.floor(G * 0.08));
      for (let z = 0; z < G; z++)
        for (let y = 0; y < G; y++)
          for (let x = 0; x < G; x++) {
            const dist = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
            if (dist < jetR && z < c)
              field.set(x, y, z, {
                vx: 0,
                vy: 0,
                vz: 5 * (1 - dist / jetR),
                p: 0,
              });
            else if (dist < jetR * 3 && z >= c)
              field.set(x, y, z, { vx: 0, vy: 0, vz: -0.5, p: 0 });
          }
      return `Focused jet (r=${jetR})`;
    }
    case "collision": {
      const tubeR = Math.max(2, Math.floor(G * 0.1));
      const offset = Math.floor(G * 0.2);
      for (let z = 0; z < G; z++)
        for (let y = 0; y < G; y++)
          for (let x = 0; x < G; x++) {
            const d1 = Math.sqrt((x - (c - offset)) ** 2 + (y - c) ** 2);
            if (d1 < tubeR) {
              const s = 1.5 * (1 - d1 / tubeR);
              const v = field.get(x, y, z);
              field.set(x, y, z, { vx: s * 0.5, vy: 0, vz: s, p: v.p });
            }
            const d2 = Math.sqrt((x - (c + offset)) ** 2 + (y - c) ** 2);
            if (d2 < tubeR) {
              const s = 1.5 * (1 - d2 / tubeR);
              const v = field.get(x, y, z);
              field.set(x, y, z, { vx: -s * 0.5, vy: 0, vz: -s, p: v.p });
            }
          }
      return `Collision (r=${tubeR})`;
    }
    default:
      return `Unknown scenario: ${name}`;
  }
}

const desc = initScenario(flatField, scenario);

// Convert to octree if requested
let field = useOctree
  ? OctreeField.fromVoxelField(flatField, {
      maxDepth,
      refineThreshold,
      coarsenThreshold: refineThreshold * 0.1,
      baseCellSize,
    })
  : flatField;

let solver = new NavierStokesSolver(field, {
  viscosity,
  dt,
  pressureIterations: 20,
});

// ── State tracking ──
const history = [];
const checkpoints = new Map(); // step → field snapshot
const watchPoints = []; // [{x,y,z}]
let currentStep = 0;

// Save initial checkpoint
checkpoints.set(0, field.clone());

// ── Output dir ──
const outDir = path.join(
  __dirname,
  "output",
  `inspect-${scenario}-${Date.now()}`,
);
fs.mkdirSync(outDir, { recursive: true });

// ── Helper: get current VOXI code for Mind's Eye ──
function getCurrentVoxi() {
  return fieldToVoxi(field, channel);
}

// ── Helper: print stats ──
function printStats(label) {
  const s = field.stats();
  const line = `[Step ${currentStep}] maxVel=${s.maxVel.toFixed(4)} maxVort=${s.maxVort.toFixed(4)} energy=${s.totalEnergy.toFixed(2)}`;
  const octreeInfo = s.leafCount
    ? ` leaves=${s.leafCount} depth=${s.maxDepth} effRes=${field.effectiveResolution}³`
    : "";
  console.log(`${label || ""}${line}${octreeInfo}`);
  return s;
}

// ── Start ──
console.log(`\n=== VOXI Math: Interactive NS Inspector ===`);
console.log(`Scenario:  ${desc}`);
console.log(
  `Grid:      ${gridSize}³${useOctree ? ` octree (maxDepth=${maxDepth})` : " flat"}`,
);
console.log(`Viscosity: ${viscosity}, dt: ${dt}`);
console.log(`Channel:   ${channel}`);
console.log(`Output:    ${outDir}/`);
console.log(`Type HELP for commands.\n`);

printStats("Initial: ");

// ── REPL ──
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `ns[${currentStep}]> `,
});
rl.prompt();

rl.on("line", (input) => {
  const parts = input.trim().split(/\s+/);
  const cmd = (parts[0] || "").toUpperCase();

  try {
    switch (cmd) {
      case "STEP": {
        const n = parseInt(parts[1]) || 1;
        for (let i = 0; i < n; i++) {
          const stats = solver.step();
          currentStep++;
          stats.step = currentStep;
          stats.dt = solver._currentDt;
          history.push(stats);

          // Watch points
          for (const wp of watchPoints) {
            const v = field.get(wp.x, wp.y, wp.z);
            const mag = Math.sqrt(v.vx ** 2 + v.vy ** 2 + v.vz ** 2);
            console.log(
              `  watch(${wp.x},${wp.y},${wp.z}): vel=${mag.toFixed(4)} vx=${v.vx.toFixed(3)} vy=${v.vy.toFixed(3)} vz=${v.vz.toFixed(3)}`,
            );
          }
        }
        printStats(n > 1 ? `Stepped ${n}: ` : "");
        break;
      }

      case "LOOK":
      case "WIDE": {
        const voxi = getCurrentVoxi();
        console.log(textViewFromCode(voxi));
        break;
      }

      case "SLICE":
      case "ZOOM":
      case "WHAT": {
        const voxi = getCurrentVoxi();
        const tmpPath = path.join(outDir, "_tmp.voxi");
        fs.writeFileSync(tmpPath, voxi);
        try {
          const result = execSync(
            `echo "${input.trim()}" | node ../voxi-reasoning/minds-eye.js "${tmpPath}"`,
            { cwd: __dirname, encoding: "utf8", timeout: 10000 },
          );
          console.log(result.split("\n").slice(2).join("\n"));
        } catch (e) {
          console.log(e.stdout || e.message);
        }
        break;
      }

      case "STATS": {
        printStats("");
        const s = field.stats();
        console.log(`  maxVel at:  (${s.maxVelPos})`);
        console.log(`  maxVort at: (${s.maxVortPos})`);
        if (history.length > 1) {
          const prev = history[history.length - 2];
          const curr = history[history.length - 1];
          const vortGrowth =
            prev.maxVort > 0
              ? (((curr.maxVort - prev.maxVort) / prev.maxVort) * 100).toFixed(
                  1,
                )
              : "N/A";
          console.log(`  vorticity growth: ${vortGrowth}%`);
          console.log(`  effective dt: ${curr.dt?.toFixed(6) || dt}`);
        }
        break;
      }

      case "HISTORY": {
        console.log("Step | maxVel   | maxVort  | energy     | growth");
        console.log("-----|----------|----------|------------|-------");
        let prevVort = null;
        for (const h of history) {
          const growth = prevVort
            ? (((h.maxVort - prevVort) / prevVort) * 100).toFixed(1) + "%"
            : "—";
          console.log(
            `${String(h.step).padStart(4)} | ${h.maxVel.toFixed(4).padStart(8)} | ${h.maxVort.toFixed(4).padStart(8)} | ${h.totalEnergy.toFixed(2).padStart(10)} | ${growth}`,
          );
          prevVort = h.maxVort;
        }
        break;
      }

      case "SAVE": {
        const name = parts[1] || `step-${currentStep}`;
        const voxi = getCurrentVoxi();
        const savePath = path.join(outDir, `${name}.voxi`);
        fs.writeFileSync(savePath, voxi);
        checkpoints.set(currentStep, field.clone());
        console.log(`Saved: ${savePath} (${voxi.split("\n").length} lines)`);
        break;
      }

      case "CHECKPOINT": {
        checkpoints.set(currentStep, field.clone());
        console.log(
          `Checkpoint saved at step ${currentStep} (${checkpoints.size} total)`,
        );
        break;
      }

      case "REWIND": {
        const target = parseInt(parts[1]);
        if (isNaN(target) || !checkpoints.has(target)) {
          console.log(
            `No checkpoint at step ${target}. Available: ${[...checkpoints.keys()].sort((a, b) => a - b).join(", ")}`,
          );
        } else {
          field = checkpoints.get(target).clone();
          solver = new NavierStokesSolver(field, {
            viscosity,
            dt,
            pressureIterations: 20,
          });
          currentStep = target;
          history.splice(history.findIndex((h) => h.step > target));
          console.log(`Rewound to step ${target}`);
          printStats("");
        }
        break;
      }

      case "REFINE": {
        if (field.adaptiveRefine) {
          const result = field.adaptiveRefine();
          console.log(
            `Refined: ${result.added} leaves added (total ${result.leafCount}, depth ${result.maxDepth})`,
          );
        } else {
          console.log("Refinement only available with --octree");
        }
        break;
      }

      case "COARSEN": {
        if (field.adaptiveRefine) {
          const before = field._leafCount;
          field.adaptiveRefine(); // coarsening happens inside
          console.log(
            `After coarsen pass: ${field._leafCount} leaves (was ${before})`,
          );
        } else {
          console.log("Coarsening only available with --octree");
        }
        break;
      }

      case "SET": {
        const key = parts[1],
          val = parseFloat(parts[2]);
        if (key === "viscosity") {
          viscosity = val;
          solver.viscosity = val;
          console.log(`viscosity = ${val}`);
        } else if (key === "dt") {
          dt = val;
          solver.dt = val;
          console.log(`dt = ${val}`);
        } else if (key === "refine" || key === "refine-threshold") {
          refineThreshold = val;
          if (field.refineThreshold !== undefined) field.refineThreshold = val;
          console.log(`refine threshold = ${val}`);
        } else if (key === "channel") {
          channel = parts[2];
          console.log(`channel = ${channel}`);
        } else
          console.log(
            `Unknown parameter: ${key}. Available: viscosity, dt, refine, channel`,
          );
        break;
      }

      case "CHANNEL": {
        channel = parts[1] || "velocity";
        console.log(`Channel: ${channel}`);
        break;
      }

      case "WATCH": {
        if (parts.length >= 4) {
          const wp = {
            x: parseInt(parts[1]),
            y: parseInt(parts[2]),
            z: parseInt(parts[3]),
          };
          watchPoints.push(wp);
          const v = field.get(wp.x, wp.y, wp.z);
          console.log(
            `Watching (${wp.x},${wp.y},${wp.z}): vel=${Math.sqrt(v.vx ** 2 + v.vy ** 2 + v.vz ** 2).toFixed(4)}`,
          );
        } else {
          console.log(
            `Watching: ${watchPoints.map((w) => `(${w.x},${w.y},${w.z})`).join(", ") || "none"}`,
          );
        }
        break;
      }

      case "UNWATCH": {
        watchPoints.length = 0;
        console.log("Cleared all watch points");
        break;
      }

      case "PROBE": {
        const x = parseInt(parts[1]),
          y = parseInt(parts[2]),
          z = parseInt(parts[3]);
        const v = field.get(x, y, z);
        const mag = Math.sqrt(v.vx ** 2 + v.vy ** 2 + v.vz ** 2);
        const w = field.vorticity(x, y, z);
        const vortMag = Math.sqrt(w.wx ** 2 + w.wy ** 2 + w.wz ** 2);
        const g = field.gradient(x, y, z);
        const gradMag = Math.sqrt(g.dx ** 2 + g.dy ** 2 + g.dz ** 2);
        console.log(`Probe (${x},${y},${z}):`);
        console.log(
          `  velocity: (${v.vx.toFixed(4)}, ${v.vy.toFixed(4)}, ${v.vz.toFixed(4)})  |v|=${mag.toFixed(4)}`,
        );
        console.log(
          `  vorticity: (${w.wx.toFixed(4)}, ${w.wy.toFixed(4)}, ${w.wz.toFixed(4)})  |ω|=${vortMag.toFixed(4)}`,
        );
        console.log(`  gradient: |∇v|=${gradMag.toFixed(4)}`);
        console.log(`  pressure: ${v.p.toFixed(4)}`);
        break;
      }

      case "HELP": {
        console.log(`
Commands:
  STEP [N]           Advance N steps (default 1)
  LOOK view          View from front/back/left/right/top/bottom
  WIDE               All 6 views at once
  SLICE axis=N       Cross-section (e.g. SLICE y=16)
  ZOOM cx cy cz r    Zoom into region
  WHAT view col row  Identify a pixel
  STATS              Current field statistics
  HISTORY            Stats across all past steps
  PROBE x y z        Full data at a point (vel, vort, grad, pressure)
  WATCH x y z        Track a point each step
  UNWATCH            Clear watch points
  SAVE [name]        Save .voxi snapshot
  CHECKPOINT         Save field state for REWIND
  REWIND N           Restore to step N
  REFINE             Force octree refinement
  SET key value      Change: viscosity, dt, refine, channel
  CHANNEL name       Switch: velocity, vorticity, pressure
  HELP               This message
  QUIT               Exit`);
        break;
      }

      case "QUIT":
      case "EXIT":
      case "Q": {
        console.log("Exiting.");
        process.exit(0);
      }

      case "":
        break;

      default:
        console.log(`Unknown: ${cmd}. Type HELP.`);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }

  rl.setPrompt(`ns[${currentStep}]> `);
  rl.prompt();
});
