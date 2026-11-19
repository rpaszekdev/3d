#!/usr/bin/env node
/**
 * crossing-detector.js — Detect knot crossings from Mind's Eye depth maps.
 *
 * Core idea: a crossing occurs where two strands of a curve occupy
 * the same (col, row) position in a 2D projection but at different depths.
 * The Mind's Eye depth map encodes this as different depth values at
 * adjacent positions that belong to the same projected region.
 *
 * Usage:
 *   node crossing-detector.js knot.voxi
 *   node crossing-detector.js knot.voxi --all-views
 *   node crossing-detector.js knot.voxi --find-minimum
 */

import fs from "fs";
import { parseVoxi } from "../voxi-reasoning/text-view.js";

// ── Parse VOXI into a 3D grid ──

function buildOccupancy(code) {
  const { W, H, D, vm } = parseVoxi(code);
  // Build a boolean occupancy grid + depth storage per cell
  const occupied = new Set();
  for (const [key] of vm) {
    occupied.add(key);
  }
  return { W, H, D, vm, occupied };
}

// ── Project along an axis, collect depth values per pixel ──

function projectAndCollectDepths(W, H, D, occupied, view) {
  let viewW, viewH, getCoords;

  switch (view) {
    case "front": // look along +Z
      viewW = W; viewH = H;
      getCoords = (col, row) => {
        const x = col, y = H - 1 - row;
        const depths = [];
        for (let z = 0; z < D; z++) {
          if (occupied.has(`${x},${y},${z}`)) depths.push(z);
        }
        return depths;
      };
      break;
    case "right": // look along -X
      viewW = D; viewH = H;
      getCoords = (col, row) => {
        const z = col, y = H - 1 - row;
        const depths = [];
        for (let x = W - 1; x >= 0; x--) {
          if (occupied.has(`${x},${y},${z}`)) depths.push(W - 1 - x);
        }
        return depths;
      };
      break;
    case "top": // look along -Y
      viewW = W; viewH = D;
      getCoords = (col, row) => {
        const x = col, z = D - 1 - row;
        const depths = [];
        for (let y = H - 1; y >= 0; y--) {
          if (occupied.has(`${x},${y},${z}`)) depths.push(H - 1 - y);
        }
        return depths;
      };
      break;
    default:
      throw new Error(`Unknown view: ${view}`);
  }

  // Collect depths at each pixel
  const depthMap = [];
  const crossings = [];

  for (let row = 0; row < viewH; row++) {
    for (let col = 0; col < viewW; col++) {
      const depths = getCoords(col, row);
      depthMap.push({ col, row, depths });

      // A crossing = 2+ hits at different depths with a gap between them
      if (depths.length >= 2) {
        depths.sort((a, b) => a - b);
        const gap = depths[depths.length - 1] - depths[0];
        if (gap > 1) { // gap > 1 means they're not adjacent — it's a crossing
          crossings.push({ col, row, depths, gap });
        }
      }
    }
  }

  return { viewW, viewH, depthMap, crossings };
}

// ── Cluster nearby crossings into crossing zones ──

function clusterCrossings(crossings) {
  if (crossings.length === 0) return [];

  const clusters = [];
  const used = new Set();

  for (let i = 0; i < crossings.length; i++) {
    if (used.has(i)) continue;

    const cluster = [crossings[i]];
    used.add(i);

    // BFS — find all crossings within distance 2
    const queue = [i];
    while (queue.length > 0) {
      const ci = queue.shift();
      const c = crossings[ci];

      for (let j = 0; j < crossings.length; j++) {
        if (used.has(j)) continue;
        const other = crossings[j];
        const dist = Math.abs(c.col - other.col) + Math.abs(c.row - other.row);
        if (dist <= 2) {
          cluster.push(other);
          used.add(j);
          queue.push(j);
        }
      }
    }

    // Cluster center
    const avgCol = cluster.reduce((s, c) => s + c.col, 0) / cluster.length;
    const avgRow = cluster.reduce((s, c) => s + c.row, 0) / cluster.length;
    const maxGap = Math.max(...cluster.map(c => c.gap));

    clusters.push({
      center: [Math.round(avgCol), Math.round(avgRow)],
      size: cluster.length,
      maxGap,
      pixels: cluster,
    });
  }

  return clusters;
}

// ── Analyze a knot file ──

function analyzeKnot(filePath, options = {}) {
  const code = fs.readFileSync(filePath, "utf8");
  const { W, H, D, occupied } = buildOccupancy(code);
  const views = options.allViews ? ["front", "right", "top"] : ["top"];

  console.log(`\nKnot: ${filePath}`);
  console.log(`Grid: ${W}x${H}x${D}, ${occupied.size} voxels\n`);

  let minCrossings = Infinity;
  let bestView = "";

  for (const view of views) {
    const result = projectAndCollectDepths(W, H, D, occupied, view);
    const clusters = clusterCrossings(result.crossings);

    console.log(`=== ${view.toUpperCase()} view ===`);
    console.log(`  Raw crossing pixels: ${result.crossings.length}`);
    console.log(`  Crossing zones (clustered): ${clusters.length}`);

    for (const cl of clusters) {
      console.log(`    Zone at (${cl.center}): ${cl.size} pixels, max depth gap=${cl.maxGap}`);
    }

    if (clusters.length < minCrossings) {
      minCrossings = clusters.length;
      bestView = view;
    }

    // Depth variance map
    if (options.showVariance) {
      console.log(`  Depth variance map:`);
      for (let row = 0; row < result.viewH; row++) {
        let line = "  ";
        for (let col = 0; col < result.viewW; col++) {
          const entry = result.depthMap.find(d => d.col === col && d.row === row);
          if (!entry || entry.depths.length === 0) {
            line += ".";
          } else if (entry.depths.length === 1) {
            line += "·";
          } else {
            const gap = entry.depths[entry.depths.length - 1] - entry.depths[0];
            line += gap > 1 ? "X" : "·";
          }
        }
        // Only print non-empty rows
        if (line.trim().replace(/\./g, "")) console.log(line);
      }
    }

    console.log("");
  }

  console.log(`RESULT: min crossing zones = ${minCrossings} (${bestView} view)`);
  return { minCrossings, bestView };
}

// ── CLI ──

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith("--"));
const allViews = args.includes("--all-views");
const showVariance = args.includes("--show-variance");

if (!filePath) {
  console.error("Usage: node crossing-detector.js <knot.voxi> [--all-views] [--show-variance]");
  process.exit(1);
}

analyzeKnot(filePath, { allViews, showVariance });
