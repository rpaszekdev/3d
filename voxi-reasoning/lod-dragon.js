#!/usr/bin/env node
/**
 * lod-dragon.js — Make the dragon breathe fire.
 *
 * Loads the dragon model, compresses it, asks Claude to analyze the
 * dragon's pose and add fire from its mouth using VOXI code, then
 * applies the result back to the high-res scene.
 *
 * Usage:
 *   node lod-dragon.js              # full LLM run
 *   node lod-dragon.js --no-llm     # test pipeline only
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import parseMagicaVoxel from "parse-magica-voxel";
import { textView } from "./text-view.js";
import { callClaude } from "./llm.js";
import { VOXI_REFERENCE } from "./prompts.js";
import {
  parseToVoxelMap,
  createScene,
  addObject,
  downsample,
  toVoxiCode,
  applyEdits,
  describeScene,
  sceneToVoxelMap,
} from "./lod-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const noLlm = process.argv.includes("--no-llm");

const DOWNSAMPLE_FACTOR = 8; // 126->16 is good for Claude

// ── Output ──────────────────────────────────────────────────────────

const outDir = path.join(__dirname, "output", "lod-dragon");
fs.mkdirSync(outDir, { recursive: true });

function save(filename, content) {
  const fp = path.join(outDir, filename);
  fs.writeFileSync(fp, content);
  console.log(`  Saved: ${filename} (${content.length} bytes)`);
  return fp;
}

// ── Color conversion ────────────────────────────────────────────────

const VOXI_PALETTE = [
  [0x11, 0x11, 0x11],
  [0xe5, 0x39, 0x35],
  [0x43, 0xa0, 0x47],
  [0x1e, 0x88, 0xe5],
  [0x00, 0xbc, 0xd4],
  [0xab, 0x47, 0xbc],
  [0xfd, 0xd8, 0x35],
  [0xff, 0x98, 0x00],
  [0xee, 0xee, 0xee],
  [0x9e, 0x9e, 0x9e],
  [0x8d, 0x6e, 0x4a],
  [0xff, 0x9e, 0xb5],
  [0x2e, 0x7d, 0x32],
  [0xd4, 0xb8, 0x96],
  [0x8b, 0x1a, 0x1a],
  [0x1a, 0x3a, 0x6b],
];
function rgbToVoxi(r, g, b) {
  let best = 9,
    bestD = Infinity;
  for (let i = 0; i < 16; i++) {
    const [pr, pg, pb] = VOXI_PALETTE[i];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// ── Step 1: Load dragon ─────────────────────────────────────────────

console.log("\n=== Dragon Fire-Breathing Demo ===\n");

const voxPath = path.join(__dirname, "models", "dragon.vox");
const buf = new Uint8Array(fs.readFileSync(voxPath)).buffer;
const parsed = parseMagicaVoxel(buf);
const size = Array.isArray(parsed.SIZE) ? parsed.SIZE[0] : parsed.SIZE;
const modelW = size.x,
  modelH = size.z,
  modelD = size.y;

const dragonVoxels = new Map();
for (const v of parsed.XYZI) {
  const pc = parsed.RGBA[v.c - 1] || { r: 158, g: 158, b: 158 };
  dragonVoxels.set(`${v.x},${v.z},${v.y}`, rgbToVoxi(pc.r, pc.g, pc.b));
}
const dragonMap = { W: modelW, H: modelH, D: modelD, voxels: dragonVoxels };
console.log(
  `[1/6] Dragon: ${modelW}x${modelH}x${modelD}, ${dragonVoxels.size} voxels`,
);

// ── Step 2: Build scene with margin for fire ────────────────────────

// Add extra space in front of the dragon for the fire breath
const MARGIN = 40;
const SCENE_W = modelW + MARGIN;
const SCENE_H = modelH + 20;
const SCENE_D = modelD + MARGIN;

console.log(
  `[2/6] Scene: ${SCENE_W}x${SCENE_H}x${SCENE_D} (dragon + margin for fire)`,
);

let scene = createScene(SCENE_W, SCENE_H, SCENE_D);
scene = addObject(
  scene,
  "dragon",
  dragonMap,
  [MARGIN, 0, Math.floor(MARGIN / 2)],
  "green/gray scanned dragon",
);

const hiresVm = sceneToVoxelMap(scene);

// ── Step 3: Save BEFORE state ───────────────────────────────────────

console.log("[3/6] Saving BEFORE state...");

const hiresBeforeVoxi = toVoxiCode(
  SCENE_W,
  SCENE_H,
  SCENE_D,
  hiresVm,
  "Dragon BEFORE",
);
save("hires-before.voxi", hiresBeforeVoxi);

const hiresBeforeTV = textView(SCENE_W, SCENE_H, SCENE_D, hiresVm);
save("hires-before-textview.txt", hiresBeforeTV);

const lowresBefore = downsample(scene, DOWNSAMPLE_FACTOR);
const lowresBeforeVoxi = toVoxiCode(
  lowresBefore.W,
  lowresBefore.H,
  lowresBefore.D,
  lowresBefore.voxels,
  `Dragon low-res (${DOWNSAMPLE_FACTOR}:1)`,
);
save("lowres-before.voxi", lowresBeforeVoxi);

const lowresBeforeTV = textView(
  lowresBefore.W,
  lowresBefore.H,
  lowresBefore.D,
  lowresBefore.voxels,
);
save("lowres-before-textview.txt", lowresBeforeTV);

console.log(
  `  Low-res: ${lowresBefore.W}x${lowresBefore.H}x${lowresBefore.D}, ${lowresBefore.voxels.size} voxels`,
);

const sceneDesc = describeScene(scene);
console.log("\n" + sceneDesc);

// ── No-LLM mode ────────────────────────────────────────────────────

if (noLlm) {
  console.log("[--no-llm] Testing with hardcoded fire...");

  // Hardcode fire: a cone of red/yellow/orange voxels in front of the dragon's head
  // Dragon head is roughly at the low-X end based on the model
  const fireVoxi = `V 30 20 20
-- Fire breath
B 0 5 8 8 4 4 1
B 8 6 9 6 3 3 7
B 14 7 9 5 2 2 6
B 19 7 10 4 2 1 6
B 23 8 10 3 1 1 1
B 0 4 7 4 2 5 7
B 4 5 8 4 2 4 1
B 0 9 8 6 2 4 7
B 6 8 9 4 2 3 1
B 0 6 6 3 1 2 6
B 0 7 12 3 1 2 6`;

  const testEdits = [
    {
      action: "STAMP",
      name: "fire",
      origin: [10, 30, 18],
      colorHint: "red/yellow/orange fire breath",
      voxi: fireVoxi,
    },
  ];

  save("edits.json", JSON.stringify(testEdits, null, 2));
  const afterScene = applyEdits(scene, testEdits);
  const afterVm = sceneToVoxelMap(afterScene);

  save(
    "hires-after.voxi",
    toVoxiCode(SCENE_W, SCENE_H, SCENE_D, afterVm, "Dragon AFTER (fire)"),
  );
  save(
    "hires-after-textview.txt",
    textView(SCENE_W, SCENE_H, SCENE_D, afterVm),
  );

  const lowresAfter = downsample(afterScene, DOWNSAMPLE_FACTOR);
  save(
    "lowres-after.voxi",
    toVoxiCode(
      lowresAfter.W,
      lowresAfter.H,
      lowresAfter.D,
      lowresAfter.voxels,
      "Dragon low-res AFTER",
    ),
  );
  save(
    "lowres-after-textview.txt",
    textView(lowresAfter.W, lowresAfter.H, lowresAfter.D, lowresAfter.voxels),
  );

  console.log("\n  After:", describeScene(afterScene));
  console.log(`Done! Output: ${outDir}`);
  process.exit(0);
}

// ── Step 4: LLM Call 1 — Analyze the dragon ─────────────────────────

console.log("[4/6] LLM: Analyzing the dragon...");

const analysisSystem = `You are a spatial reasoning assistant analyzing a low-resolution 3D voxel scene.

${VOXI_REFERENCE}

Each cell in this view represents a ${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR} block of high-resolution voxels.
The depth values (0-9) show how close a surface is to the camera. "." means empty space.

The scene contains a scanned 3D dragon model. Analyze its pose:
- Where is the head? Which direction does it face?
- Where is the mouth opening?
- Where is the body, tail, wings?
- What colors make up different body parts?

Be very specific about coordinates. Use the LOW-RES coordinate system.
Remember: each low-res cell = ${DOWNSAMPLE_FACTOR} high-res voxels.`;

const analysisUser = `OBJECT REGISTRY:
${sceneDesc}

LOW-RES TEXT VIEW (${lowresBefore.W}x${lowresBefore.H}x${lowresBefore.D}, each cell = ${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR} high-res voxels):
${lowresBeforeTV}

Describe the dragon's pose and anatomy. Where exactly is the head and mouth? Which direction would fire come from?`;

const analysis = await callClaude(analysisSystem, analysisUser);
save("analysis.txt", analysis);
console.log("  Analysis:");
console.log(
  analysis
    .split("\n")
    .slice(0, 8)
    .map((l) => `    ${l}`)
    .join("\n"),
);
if (analysis.split("\n").length > 8)
  console.log(`    ... (${analysis.split("\n").length} lines total)`);

// ── Step 5: LLM Call 2 — Generate fire ──────────────────────────────

console.log("\n[5/6] LLM: Generating fire breath...");

const fireSystem = `You are a spatial reasoning assistant that adds new geometry to 3D voxel scenes.

${VOXI_REFERENCE}

The scene contains a dragon at HIGH-RES resolution ${SCENE_W}x${SCENE_H}x${SCENE_D}.
The dragon itself occupies origin (${MARGIN}, 0, ${Math.floor(MARGIN / 2)}) with bounds ${modelW}x${modelH}x${modelD}.

The downsample factor is ${DOWNSAMPLE_FACTOR}, so multiply low-res coordinates by ${DOWNSAMPLE_FACTOR} to get high-res.

You can create new geometry using STAMP:
{
  "action": "STAMP",
  "name": "<object name>",
  "origin": [X, Y, Z],
  "colorHint": "<description>",
  "voxi": "<VOXI code string>"
}

The VOXI code inside "voxi" defines geometry LOCAL to the origin. Use V to set local grid size.
Available colors for fire: 1=red, 6=yellow, 7=orange. Use all three for realistic flames.

CRITICAL SIZE CONSTRAINTS:
- The VOXI grid for fire MUST be small: V 40 20 20 or smaller
- The fire stream should be about 30-40 voxels LONG and 8-15 voxels wide at most
- Total fire voxels should be 200-600, NOT thousands
- Do NOT use huge solid boxes. Use thin layered shapes.

FIRE DESIGN RULES:
- Fire should START narrow at the mouth (2-4 voxels wide) and EXPAND outward
- ORDER MATTERS: write red (1) boxes FIRST, then orange (7) OVER them, then yellow (6) core LAST
  (later commands overwrite earlier ones, so the core color should be written last)
- Use mostly thin B commands (1-3 voxels thick), not solid cubes
- Add 8-12 scattered P sparks around the edges
- Fire shoots in the direction the mouth faces

Output your edits as a JSON array inside a \`\`\`json code fence.
The array should contain one STAMP command for the fire.`;

const fireUser = `DRAGON ANALYSIS:
${analysis}

SCENE INFO:
${sceneDesc}

LOW-RES TEXT VIEW:
${lowresBeforeTV}

TASK: Add a dramatic fire breath coming from the dragon's mouth. The fire should:
1. Start narrow at the mouth
2. Expand outward in the direction the mouth faces
3. Use red (1), yellow (6), and orange (7) colors
4. Be proportional to the dragon (the dragon is ${modelW}x${modelH}x${modelD})

Think carefully about WHERE the mouth is in HIGH-RES coordinates, and WHICH DIRECTION the fire should go.
Output a JSON array with a STAMP command.`;

const fireResponse = await callClaude(fireSystem, fireUser);
save("edit-proposal.txt", fireResponse);
console.log("  Fire proposal:");
console.log(
  fireResponse
    .split("\n")
    .slice(0, 10)
    .map((l) => `    ${l}`)
    .join("\n"),
);

// ── Parse edits ─────────────────────────────────────────────────────

console.log("\n[6/6] Applying fire...");

const jsonMatch = fireResponse.match(/```json\n?([\s\S]*?)```/);
let edits = [];
if (jsonMatch) {
  try {
    edits = JSON.parse(jsonMatch[1].trim());
    if (!Array.isArray(edits)) edits = [edits];
  } catch (e) {
    console.error(`  JSON parse error: ${e.message}`);
    // Try to find any JSON array
    const fallback = fireResponse.match(/\[[\s\S]*?\]/);
    if (fallback) {
      try {
        edits = JSON.parse(fallback[0]);
      } catch {}
    }
  }
}

save("edits.json", JSON.stringify(edits, null, 2));
console.log(`  Parsed ${edits.length} edits`);
for (const e of edits) {
  console.log(`    ${e.action} "${e.name}" at (${e.origin?.join(",") || "?"})`);
  if (e.voxi) console.log(`    VOXI: ${e.voxi.split("\n").length} lines`);
}

// Apply
const afterScene = applyEdits(scene, edits);
const afterVm = sceneToVoxelMap(afterScene);

// Save AFTER
const hiresAfterVoxi = toVoxiCode(
  SCENE_W,
  SCENE_H,
  SCENE_D,
  afterVm,
  "Dragon AFTER — fire breathing",
);
save("hires-after.voxi", hiresAfterVoxi);
save("hires-after-textview.txt", textView(SCENE_W, SCENE_H, SCENE_D, afterVm));

const lowresAfter = downsample(afterScene, DOWNSAMPLE_FACTOR);
save(
  "lowres-after.voxi",
  toVoxiCode(
    lowresAfter.W,
    lowresAfter.H,
    lowresAfter.D,
    lowresAfter.voxels,
    "Dragon low-res AFTER",
  ),
);
save(
  "lowres-after-textview.txt",
  textView(lowresAfter.W, lowresAfter.H, lowresAfter.D, lowresAfter.voxels),
);

// Report
const report = [
  "=== Dragon Fire-Breathing Report ===",
  "",
  "--- ANALYSIS ---",
  analysis,
  "",
  "--- FIRE PROPOSAL ---",
  fireResponse,
  "",
  "--- EDITS ---",
  JSON.stringify(edits, null, 2),
  "",
  "--- BEFORE ---",
  sceneDesc,
  "",
  "--- AFTER ---",
  describeScene(afterScene),
].join("\n");
save("report.txt", report);

console.log("\n=== Summary ===");
console.log(`Dragon: ${dragonVoxels.size} voxels`);
console.log(`Fire edits: ${edits.length}`);
for (const o of afterScene.objects) {
  console.log(
    `  ${o.name}: origin=(${o.origin.join(",")}), ${o.localVoxels.size} voxels`,
  );
}
console.log(`\nOutput: ${outDir}`);
