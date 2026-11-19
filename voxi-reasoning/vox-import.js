#!/usr/bin/env node
/**
 * vox-import.js — Convert MagicaVoxel .vox files to VOXI code.
 *
 * Usage:
 *   node vox-import.js model.vox                    → prints VOXI to stdout
 *   node vox-import.js model.vox -o model.voxi      → saves to file
 *   node vox-import.js model.vox | node minds-eye.js --stdin  → pipe to Mind's Eye
 *
 * Also works as a module:
 *   import { voxToVoxi } from './vox-import.js';
 *   const voxi = voxToVoxi(buffer);
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import parseMagicaVoxel from "parse-magica-voxel";

// ── VOXI 16-color palette (RGB) ─────────────────────────────────────
const VOXI_PALETTE = [
  [0x11, 0x11, 0x11], // 0 black
  [0xe5, 0x39, 0x35], // 1 red
  [0x43, 0xa0, 0x47], // 2 green
  [0x1e, 0x88, 0xe5], // 3 blue
  [0x00, 0xbc, 0xd4], // 4 cyan
  [0xab, 0x47, 0xbc], // 5 magenta
  [0xfd, 0xd8, 0x35], // 6 yellow
  [0xff, 0x98, 0x00], // 7 orange
  [0xee, 0xee, 0xee], // 8 white
  [0x9e, 0x9e, 0x9e], // 9 gray
  [0x8d, 0x6e, 0x4a], // a brown
  [0xff, 0x9e, 0xb5], // b pink
  [0x2e, 0x7d, 0x32], // c dark-green
  [0xd4, 0xb8, 0x96], // d tan
  [0x8b, 0x1a, 0x1a], // e maroon
  [0x1a, 0x3a, 0x6b], // f navy
];

const VOXI_CODES = "0123456789abcdef";

function rgbToVoxi(r, g, b) {
  let bestDist = Infinity;
  let bestIdx = 9;
  for (let i = 0; i < 16; i++) {
    const [pr, pg, pb] = VOXI_PALETTE[i];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return VOXI_CODES[bestIdx];
}

// ── Convert .vox buffer to VOXI code ────────────────────────────────

export function voxToVoxi(buffer, filename = "model") {
  const parsed = parseMagicaVoxel(buffer);

  const W = parsed.SIZE.x;
  const H = parsed.SIZE.z; // MagicaVoxel Z = VOXI Y (up)
  const D = parsed.SIZE.y; // MagicaVoxel Y = VOXI Z (depth)

  const palette = parsed.RGBA; // array of {r, g, b, a}

  // Build voxel map with color mapping
  const voxels = new Map(); // "x,y,z" → voxi color code

  for (const v of parsed.XYZI) {
    const vx = v.x;
    const vy = v.z; // Z up → Y up
    const vz = v.y; // Y depth → Z depth

    // Color from palette (1-indexed in .vox)
    const palColor = palette[v.c - 1] || { r: 158, g: 158, b: 158 };
    const voxiColor = rgbToVoxi(palColor.r, palColor.g, palColor.b);

    voxels.set(`${vx},${vy},${vz}`, voxiColor);
  }

  // Run-length encode along X for compact output
  const lines = [`V ${W} ${H} ${D}`];
  lines.push(
    `-- Imported from ${filename} (${voxels.size} voxels, ${W}x${H}x${D})`,
  );
  lines.push("");

  for (let y = 0; y < H; y++) {
    const layerVoxels = [];
    for (const [key, color] of voxels) {
      const [vx, vy, vz] = key.split(",").map(Number);
      if (vy === y) layerVoxels.push({ x: vx, z: vz, c: color });
    }
    if (layerVoxels.length === 0) continue;

    // Group by Z for RLE along X
    const byZ = {};
    for (const v of layerVoxels) {
      (byZ[v.z] ??= []).push(v);
    }

    for (const z of Object.keys(byZ).sort((a, b) => a - b)) {
      const row = byZ[z].sort((a, b) => a.x - b.x);
      let i = 0;
      while (i < row.length) {
        const startX = row[i].x;
        const color = row[i].c;
        let run = 1;
        while (
          i + run < row.length &&
          row[i + run].x === startX + run &&
          row[i + run].c === color
        ) {
          run++;
        }
        if (run >= 2) {
          lines.push(`B ${startX} ${y} ${z} ${run} 1 1 ${color}`);
        } else {
          lines.push(`P ${startX} ${y} ${z} ${color}`);
        }
        i += run;
      }
    }
  }

  return lines.join("\n");
}

// ── CLI (only when run directly) ────────────────────────────────────

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: node vox-import.js <model.vox> [-o output.voxi]");
    process.exit(1);
  }

  const inputFile = args[0];
  const outputIdx = args.indexOf("-o");
  const outputFile = outputIdx >= 0 ? args[outputIdx + 1] : null;

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  const buffer = new Uint8Array(fs.readFileSync(inputFile)).buffer;
  const filename = path.basename(inputFile, ".vox");
  const voxi = voxToVoxi(buffer, filename);

  if (outputFile) {
    fs.writeFileSync(outputFile, voxi);
    console.log(`Written to ${outputFile} (${voxi.split("\n").length} lines)`);
  } else {
    console.log(voxi);
  }
}
