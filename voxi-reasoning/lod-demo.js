#!/usr/bin/env node
/**
 * lod-demo.js — LOD Round-Trip Demo: Claude reasons about compressed 3D models.
 *
 * Proves: high-res -> compress -> Claude reasons -> apply transforms -> restore to high-res.
 *
 * Usage:
 *   node lod-demo.js                          # full demo with LLM
 *   node lod-demo.js --goal "Remove the deer"  # custom goal
 *   node lod-demo.js --no-llm                  # test pipeline without LLM calls
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { textView } from "./text-view.js";
import parseMagicaVoxel from "parse-magica-voxel";
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

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const noLlm = args.includes("--no-llm");
const goalIdx = args.indexOf("--goal");
const goal =
  goalIdx >= 0
    ? args[goalIdx + 1]
    : "Move the deer closer to graze near the castle moat. Rotate the knight to face the deer.";

const DOWNSAMPLE_FACTOR = 4;

// ── Output directory ────────────────────────────────────────────────

const outDir = path.join(__dirname, "output", "lod-demo");
fs.mkdirSync(outDir, { recursive: true });

// ── Helper: save text file ──────────────────────────────────────────

function save(filename, content) {
  const fp = path.join(outDir, filename);
  fs.writeFileSync(fp, content);
  console.log(`  Saved: ${filename} (${content.length} bytes)`);
  return fp;
}

// ── Step 1: Load models ─────────────────────────────────────────────

console.log("\n=== LOD Round-Trip Demo ===\n");
console.log(`Goal: "${goal}"`);
console.log(`Downsample factor: ${DOWNSAMPLE_FACTOR}`);
console.log(`LLM calls: ${noLlm ? "DISABLED" : "enabled"}\n`);

console.log("[1/7] Loading models...");

// Castle terrain (32x28x32)
const castleCode = fs.readFileSync(
  path.join(__dirname, "castle-terrain.voxi"),
  "utf-8",
);
const castleMap = parseToVoxelMap(castleCode);
console.log(
  `  castle-terrain: ${castleMap.W}x${castleMap.H}x${castleMap.D}, ${castleMap.voxels.size} voxels`,
);

// Knight (20x20x21)
const knightCode = fs.readFileSync(
  path.join(__dirname, "chr_sword.voxi"),
  "utf-8",
);
const knightMap = parseToVoxelMap(knightCode);
console.log(
  `  knight: ${knightMap.W}x${knightMap.H}x${knightMap.D}, ${knightMap.voxels.size} voxels`,
);

// Deer — parse directly from .vox (existing .voxi is broken, voxToVoxi has array-SIZE bug)
const deerVoxPath = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "parse-magica-voxel",
  "example",
  "deer.vox",
);
let deerMap;
if (fs.existsSync(deerVoxPath)) {
  const deerBuffer = new Uint8Array(fs.readFileSync(deerVoxPath)).buffer;
  const parsed = parseMagicaVoxel(deerBuffer);

  // SIZE may be an array (multi-model files) — take first entry
  const size = Array.isArray(parsed.SIZE) ? parsed.SIZE[0] : parsed.SIZE;
  const deerW = size.x;
  const deerH = size.z; // MagicaVoxel Z = VOXI Y (up)
  const deerD = size.y; // MagicaVoxel Y = VOXI Z (depth)

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
  const rgbToVoxi = (r, g, b) => {
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
  };

  const voxels = new Map();
  for (const v of parsed.XYZI) {
    const palColor = parsed.RGBA[v.c - 1] || { r: 158, g: 158, b: 158 };
    const color = rgbToVoxi(palColor.r, palColor.g, palColor.b);
    voxels.set(`${v.x},${v.z},${v.y}`, color); // remap axes
  }
  deerMap = { W: deerW, H: deerH, D: deerD, voxels };
  console.log(
    `  deer: ${deerMap.W}x${deerMap.H}x${deerMap.D}, ${deerMap.voxels.size} voxels (from .vox)`,
  );
} else {
  // Fallback: use chr_nosword as the "deer"
  console.log("  deer.vox not found, using chr_nosword.voxi as fallback");
  const fallbackCode = fs.readFileSync(
    path.join(__dirname, "chr_nosword.voxi"),
    "utf-8",
  );
  deerMap = parseToVoxelMap(fallbackCode);
  console.log(
    `  deer(fallback): ${deerMap.W}x${deerMap.H}x${deerMap.D}, ${deerMap.voxels.size} voxels`,
  );
}

// ── Step 2: Compose high-res scene ──────────────────────────────────

console.log("\n[2/7] Composing high-res scene (48x28x48)...");

const SCENE_W = 48;
const SCENE_H = 28;
const SCENE_D = 48;

let scene = createScene(SCENE_W, SCENE_H, SCENE_D);

// Terrain as base layer, offset to center
scene = addObject(
  scene,
  "terrain",
  castleMap,
  [8, 0, 8],
  "gray/brown/green landscape with castle",
);

// Knight near the castle
scene = addObject(
  scene,
  "knight",
  knightMap,
  [14, 8, 5],
  "armored figure with sword",
);

// Deer in the far corner
scene = addObject(scene, "deer", deerMap, [35, 8, 35], "brown deer");

const hiresVm = sceneToVoxelMap(scene);
console.log(`  Total voxels in scene: ${hiresVm.size}`);
console.log(`  Objects: ${scene.objects.map((o) => o.name).join(", ")}`);

// ── Step 3: Save BEFORE state ───────────────────────────────────────

console.log("\n[3/7] Saving BEFORE state...");

// High-res
const hiresBeforeVoxi = toVoxiCode(
  SCENE_W,
  SCENE_H,
  SCENE_D,
  hiresVm,
  "LOD Demo — BEFORE (high-res 48x28x48)",
);
save("hires-before.voxi", hiresBeforeVoxi);

const hiresBeforeTV = textView(SCENE_W, SCENE_H, SCENE_D, hiresVm);
save("hires-before-textview.txt", hiresBeforeTV);

// Low-res
const lowresBefore = downsample(scene, DOWNSAMPLE_FACTOR);
const lowresBeforeVoxi = toVoxiCode(
  lowresBefore.W,
  lowresBefore.H,
  lowresBefore.D,
  lowresBefore.voxels,
  `LOD Demo — BEFORE (low-res ${lowresBefore.W}x${lowresBefore.H}x${lowresBefore.D}, factor ${DOWNSAMPLE_FACTOR})`,
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

// ── Scene description ───────────────────────────────────────────────

const sceneDesc = describeScene(scene);
console.log("\n  Scene description:");
console.log(
  sceneDesc
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n"),
);

// ── No-LLM mode: test with hardcoded edits ──────────────────────────

if (noLlm) {
  console.log("\n[--no-llm] Testing pipeline with hardcoded edits...");

  const testEdits = [
    { action: "MOVE", object: "deer", dx: -15, dy: 0, dz: -10 },
    { action: "ROTATE_Y90", object: "knight" },
  ];

  save("edits.json", JSON.stringify(testEdits, null, 2));
  console.log(`  Edits: ${JSON.stringify(testEdits)}`);

  const afterScene = applyEdits(scene, testEdits);
  const afterVm = sceneToVoxelMap(afterScene);

  // Save AFTER state
  const hiresAfterVoxi = toVoxiCode(
    SCENE_W,
    SCENE_H,
    SCENE_D,
    afterVm,
    "LOD Demo — AFTER (high-res 48x28x48)",
  );
  save("hires-after.voxi", hiresAfterVoxi);

  const hiresAfterTV = textView(SCENE_W, SCENE_H, SCENE_D, afterVm);
  save("hires-after-textview.txt", hiresAfterTV);

  const lowresAfter = downsample(afterScene, DOWNSAMPLE_FACTOR);
  const lowresAfterVoxi = toVoxiCode(
    lowresAfter.W,
    lowresAfter.H,
    lowresAfter.D,
    lowresAfter.voxels,
    `LOD Demo — AFTER (low-res, factor ${DOWNSAMPLE_FACTOR})`,
  );
  save("lowres-after.voxi", lowresAfterVoxi);

  const lowresAfterTV = textView(
    lowresAfter.W,
    lowresAfter.H,
    lowresAfter.D,
    lowresAfter.voxels,
  );
  save("lowres-after-textview.txt", lowresAfterTV);

  // Report
  const afterDesc = describeScene(afterScene);
  const report = [
    "=== LOD Round-Trip Demo Report (no-LLM mode) ===",
    "",
    `Goal: "${goal}"`,
    `Downsample factor: ${DOWNSAMPLE_FACTOR}`,
    "",
    "--- BEFORE ---",
    sceneDesc,
    "",
    "--- EDITS (hardcoded) ---",
    JSON.stringify(testEdits, null, 2),
    "",
    "--- AFTER ---",
    afterDesc,
    "",
    "--- BEFORE Text View (low-res) ---",
    lowresBeforeTV,
    "",
    "--- AFTER Text View (low-res) ---",
    lowresAfterTV,
  ].join("\n");
  save("report.txt", report);

  console.log("\n  Before objects:");
  for (const o of scene.objects) {
    console.log(`    ${o.name}: origin=(${o.origin.join(",")})`);
  }
  console.log("  After objects:");
  for (const o of afterScene.objects) {
    console.log(`    ${o.name}: origin=(${o.origin.join(",")})`);
  }

  console.log(`\nDone! Output: ${outDir}`);
  process.exit(0);
}

// ── Step 4: LLM Call 1 — Scene Analysis ─────────────────────────────

console.log("\n[4/7] LLM Call 1: Scene Analysis...");

const analysisSystem = `You are a spatial reasoning assistant analyzing a low-resolution 3D voxel scene.

${VOXI_REFERENCE}

Each cell in this view represents a ${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR} block of high-resolution voxels.
The depth values (0-9) show how close a surface is to the camera. "." means empty space.

Describe the spatial layout. What objects do you see? What are their spatial relationships?
Be specific about positions and distances.`;

const analysisUser = `Here is the scene:

OBJECT REGISTRY:
${sceneDesc}

LOW-RES TEXT VIEW (${lowresBefore.W}x${lowresBefore.H}x${lowresBefore.D}, each cell = ${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR} high-res voxels):
${lowresBeforeTV}

Describe the spatial layout you see. What objects are visible? What are their relationships?`;

const analysis = await callClaude(analysisSystem, analysisUser);
save("analysis.txt", analysis);
console.log("  Analysis preview:");
console.log(
  analysis
    .split("\n")
    .slice(0, 6)
    .map((l) => `    ${l}`)
    .join("\n"),
);
if (analysis.split("\n").length > 6)
  console.log(`    ... (${analysis.split("\n").length} lines total)`);

// ── Step 5: LLM Call 2 — Edit Proposal ──────────────────────────────

console.log("\n[5/7] LLM Call 2: Edit Proposal...");

const editSystem = `You are a spatial reasoning assistant editing a 3D voxel scene.

${VOXI_REFERENCE}

The scene has been downsampled by factor ${DOWNSAMPLE_FACTOR} (each low-res cell = ${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR}x${DOWNSAMPLE_FACTOR} high-res voxels).

You must propose edits using these commands:
- MOVE: { "action": "MOVE", "object": "<name>", "dx": N, "dy": N, "dz": N }
  Shifts the object in HIGH-RES coordinates.
- ROTATE_Y90: { "action": "ROTATE_Y90", "object": "<name>" }
  Rotates the object 90 degrees around the Y (up) axis.
- DELETE: { "action": "DELETE", "object": "<name>" }
  Removes the object from the scene.
- RECOLOR: { "action": "RECOLOR", "object": "<name>", "from": <colorInt>, "to": <colorInt> }
  Changes all voxels of one color to another.

IMPORTANT:
- All coordinates (dx, dy, dz) are in HIGH-RES space, not low-res.
- Objects can only be moved, not resized or reshaped.
- Keep objects within scene bounds: ${SCENE_W}x${SCENE_H}x${SCENE_D}.
- Output your edits as a JSON array inside a \`\`\`json code fence.
- Explain your reasoning BEFORE the JSON block.`;

const editUser = `PREVIOUS ANALYSIS:
${analysis}

OBJECT REGISTRY:
${sceneDesc}

LOW-RES TEXT VIEW:
${lowresBeforeTV}

GOAL: ${goal}

Propose edits to achieve this goal. Think about spatial relationships and output a JSON array of edit commands.`;

const editResponse = await callClaude(editSystem, editUser);
save("edit-proposal.txt", editResponse);
console.log("  Edit proposal preview:");
console.log(
  editResponse
    .split("\n")
    .slice(0, 8)
    .map((l) => `    ${l}`)
    .join("\n"),
);

// ── Parse edits from response ───────────────────────────────────────

console.log("\n[6/7] Parsing and applying edits...");

const jsonMatch = editResponse.match(/```json\n?([\s\S]*?)```/);
let edits = [];
if (jsonMatch) {
  try {
    edits = JSON.parse(jsonMatch[1].trim());
    if (!Array.isArray(edits)) edits = [edits];
  } catch (e) {
    console.error(`  Failed to parse JSON: ${e.message}`);
    console.error(`  Raw JSON: ${jsonMatch[1].trim().slice(0, 200)}`);
  }
} else {
  // Try to find any JSON array in the response
  const arrayMatch = editResponse.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      edits = JSON.parse(arrayMatch[0]);
    } catch (e) {
      console.error(`  Failed to parse fallback JSON: ${e.message}`);
    }
  }
}

save("edits.json", JSON.stringify(edits, null, 2));
console.log(`  Parsed ${edits.length} edits:`);
for (const e of edits) {
  console.log(`    ${JSON.stringify(e)}`);
}

// ── Apply edits to high-res scene ───────────────────────────────────

const afterScene = applyEdits(scene, edits);
const afterVm = sceneToVoxelMap(afterScene);

// ── Step 7: Save AFTER state ────────────────────────────────────────

console.log("\n[7/7] Saving AFTER state...");

const hiresAfterVoxi = toVoxiCode(
  SCENE_W,
  SCENE_H,
  SCENE_D,
  afterVm,
  "LOD Demo — AFTER (high-res 48x28x48)",
);
save("hires-after.voxi", hiresAfterVoxi);

const hiresAfterTV = textView(SCENE_W, SCENE_H, SCENE_D, afterVm);
save("hires-after-textview.txt", hiresAfterTV);

const lowresAfter = downsample(afterScene, DOWNSAMPLE_FACTOR);
const lowresAfterVoxi = toVoxiCode(
  lowresAfter.W,
  lowresAfter.H,
  lowresAfter.D,
  lowresAfter.voxels,
  `LOD Demo — AFTER (low-res, factor ${DOWNSAMPLE_FACTOR})`,
);
save("lowres-after.voxi", lowresAfterVoxi);

const lowresAfterTV = textView(
  lowresAfter.W,
  lowresAfter.H,
  lowresAfter.D,
  lowresAfter.voxels,
);
save("lowres-after-textview.txt", lowresAfterTV);

// ── Final report ────────────────────────────────────────────────────

const afterDesc = describeScene(afterScene);
const report = [
  "=== LOD Round-Trip Demo Report ===",
  "",
  `Goal: "${goal}"`,
  `Downsample factor: ${DOWNSAMPLE_FACTOR}`,
  "",
  "--- SCENE ANALYSIS (Claude) ---",
  analysis,
  "",
  "--- EDIT PROPOSAL (Claude) ---",
  editResponse,
  "",
  "--- PARSED EDITS ---",
  JSON.stringify(edits, null, 2),
  "",
  "--- BEFORE ---",
  sceneDesc,
  "",
  "--- AFTER ---",
  afterDesc,
  "",
  "--- BEFORE Text View (low-res) ---",
  lowresBeforeTV,
  "",
  "--- AFTER Text View (low-res) ---",
  lowresAfterTV,
].join("\n");
save("report.txt", report);

// Console summary
console.log("\n=== Summary ===");
console.log("Before:");
for (const o of scene.objects) {
  console.log(
    `  ${o.name}: origin=(${o.origin.join(",")}), bounds=${o.bounds.join("x")}`,
  );
}
console.log("After:");
for (const o of afterScene.objects) {
  console.log(
    `  ${o.name}: origin=(${o.origin.join(",")}), bounds=${o.bounds.join("x")}`,
  );
}
console.log(`\nEdits applied: ${edits.length}`);
console.log(`Output: ${outDir}`);
