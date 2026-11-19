#!/usr/bin/env node
/**
 * generate-training-data.js — Build a clean VOXI training dataset
 *
 * Uses Claude to generate short, semantic VOXI code for simple objects.
 * Each example is 10-50 lines with comments, multiple colors, clear structure.
 *
 * Usage:
 *   node generate-training-data.js                    # generate all
 *   node generate-training-data.js --count 50         # generate 50
 *   node generate-training-data.js --category animals # only animals
 *   node generate-training-data.js --resume            # skip existing
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "training-data");
const JSONL_PATH = path.join(OUT_DIR, "train-clean.jsonl");

// ── Object prompts organized by category ────────────────────────────

const OBJECTS = {
  furniture: [
    "a wooden chair with four legs",
    "a red armchair",
    "a round dining table",
    "a desk with drawers",
    "a bookshelf with books",
    "a bed with pillows",
    "a wardrobe with doors",
    "a coffee table",
    "a bar stool",
    "a rocking chair",
    "a couch with cushions",
    "a bunk bed",
    "a TV stand",
    "a nightstand with a lamp on top",
    "a kitchen counter",
  ],
  animals: [
    "a penguin standing",
    "a cat sitting",
    "a dog standing",
    "a fish",
    "a bird on a branch",
    "a frog",
    "a turtle",
    "a rabbit",
    "a duck",
    "a bear standing",
    "a snake coiled",
    "a pig",
    "a chicken",
    "a horse standing",
    "a cow",
  ],
  vehicles: [
    "a car from the side",
    "a truck",
    "a boat",
    "a airplane",
    "a bicycle",
    "a bus",
    "a train engine",
    "a helicopter",
    "a sailboat",
    "a rocket",
    "a tractor",
    "a motorcycle",
    "a submarine",
    "a hot air balloon",
    "a spaceship",
  ],
  buildings: [
    "a small house with a roof",
    "a castle tower",
    "a church with a steeple",
    "a lighthouse",
    "a windmill",
    "a skyscraper",
    "a barn",
    "a bridge",
    "a pyramid",
    "an igloo",
    "a log cabin",
    "a pagoda",
    "a water tower",
    "a gazebo",
    "a tent",
  ],
  objects: [
    "a sword",
    "a crown",
    "a trophy",
    "a Christmas tree with ornaments",
    "a mushroom",
    "a cactus",
    "a flower in a pot",
    "a snowman",
    "a robot",
    "a treasure chest",
    "an hourglass",
    "a lantern",
    "a guitar",
    "a key",
    "a candle on a holder",
  ],
  people: [
    "a person standing with arms out",
    "a person sitting",
    "a knight with a shield",
    "a wizard with a hat",
    "a dancer",
    "a person waving",
    "a person running",
    "a skeleton",
    "a scarecrow",
    "an astronaut",
  ],
  food: [
    "an apple",
    "a birthday cake with candles",
    "a popsicle",
    "a hamburger",
    "a slice of pizza",
    "an ice cream cone",
    "a donut",
    "a cupcake",
    "a banana",
    "a watermelon slice",
  ],
  nature: [
    "a tree with a thick trunk",
    "a palm tree",
    "a pine tree",
    "a mountain",
    "a volcano",
    "a waterfall scene",
    "an island with a palm tree",
    "a rock formation",
    "a campfire",
    "a sun with rays",
  ],
};

// ── System prompt for generating clean VOXI ─────────────────────────

const SYSTEM_PROMPT = `You are a VOXI voxel model generator. Output ONLY valid VOXI code, nothing else.

VOXI primitives:
  V W H D          — Grid size (use 16 16 16 or 24 24 24 for simple objects, 32 32 32 for detailed)
  B X Y Z W H D C  — Box at (X,Y,Z) with size (W,H,D), color C
  S X Y Z R C      — Sphere at center (X,Y,Z), radius R, color C
  C X Y Z R H C    — Cylinder at center (X,Y,Z), radius R, height H, color C
  E X Y Z RX RY RZ C — Ellipsoid at center, radii (RX,RY,RZ), color C
  -- comment       — Comment line

Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray a=brown b=pink c=dark-green d=tan e=maroon f=navy

Y axis is UP. Grid origin (0,0,0) is bottom-left-front corner.

RULES:
1. Use 10-50 lines of code (NOT hundreds)
2. Use COMMENTS (--) to label each body part or section
3. Use MULTIPLE COLORS — different parts should be different colors
4. Use SEMANTIC structure — build from parts (legs, body, head), not random boxes
5. Keep it SIMPLE — convey the shape clearly, don't try for photorealism
6. Use primitives wisely — spheres for heads, boxes for bodies, cylinders for limbs
7. Center the object in the grid
8. Make sure the object sits on the ground (Y=0 or Y=1)

Output the VOXI code directly. No markdown, no explanation, no backticks.`;

// ── Generate one example ────────────────────────────────────────────

async function generateOne(description) {
  const prompt = `Create a VOXI voxel model of: ${description}`;

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn("claude", ["-p", "--model", "sonnet"], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`claude exited ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on("error", reject);

    const input = `INSTRUCTIONS:\n${SYSTEM_PROMPT}\n\nTASK:\n${prompt}`;
    proc.stdin.write(input, () => { proc.stdin.end(); });
  });
}

// ── Validate VOXI code ──────────────────────────────────────────────

function validateVoxi(code) {
  const lines = code.split("\n").filter((l) => l.trim() && !l.trim().startsWith("--"));

  // Must start with V
  const hasGrid = lines.some((l) => /^\s*V\s+\d+\s+\d+\s+\d+/.test(l));
  if (!hasGrid) return { valid: false, reason: "No V (grid) line" };

  // Must have primitives
  const primitiveCount = lines.filter((l) => /^\s*[BSCEKP]\s+/.test(l)).length;
  if (primitiveCount < 3) return { valid: false, reason: `Only ${primitiveCount} primitives (need ≥3)` };
  if (primitiveCount > 80) return { valid: false, reason: `Too many primitives (${primitiveCount}, max 80)` };

  // Must have comments (semantic structure)
  const commentCount = code.split("\n").filter((l) => l.trim().startsWith("--")).length;
  if (commentCount < 2) return { valid: false, reason: "Too few comments (need semantic labels)" };

  // Must use multiple colors
  const colors = new Set();
  for (const line of lines) {
    const match = line.match(/\s([0-9a-f])\s*$/);
    if (match) colors.add(match[1]);
  }
  if (colors.size < 2) return { valid: false, reason: `Only ${colors.size} color(s) used` };

  // No markdown or backticks
  if (code.includes("```")) return { valid: false, reason: "Contains markdown backticks" };

  return { valid: true, primitiveCount, commentCount, colorCount: colors.size };
}

// ── Clean VOXI output ───────────────────────────────────────────────

function cleanVoxi(raw) {
  // Remove markdown fencing if present
  let code = raw;
  code = code.replace(/```voxi\n?/g, "").replace(/```\n?/g, "");
  code = code.replace(/^Here.*:\n/im, "");
  // Remove any non-VOXI text before the first V line
  const vIdx = code.search(/^V\s+\d/m);
  if (vIdx > 0) code = code.slice(vIdx);
  // Remove trailing non-VOXI text
  const lines = code.split("\n");
  const lastPrimIdx = lines.findLastIndex((l) =>
    /^\s*(V|B|S|C|K|P|E|D|G|\/G|@|--)\s*/i.test(l.trim()) || l.trim() === ""
  );
  if (lastPrimIdx >= 0) code = lines.slice(0, lastPrimIdx + 1).join("\n");
  return code.trim();
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes("--resume");
  const countIdx = args.indexOf("--count");
  const maxCount = countIdx >= 0 ? parseInt(args[countIdx + 1]) : Infinity;
  const catIdx = args.indexOf("--category");
  const onlyCategory = catIdx >= 0 ? args[catIdx + 1] : null;

  // Create output directory
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Load existing data if resuming
  const existing = new Set();
  if (resume && fs.existsSync(JSONL_PATH)) {
    const lines = fs.readFileSync(JSONL_PATH, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      const entry = JSON.parse(line);
      existing.add(entry.instruction);
    }
    console.log(`Resuming — ${existing.size} existing entries`);
  }

  // Build task list
  const tasks = [];
  for (const [category, prompts] of Object.entries(OBJECTS)) {
    if (onlyCategory && category !== onlyCategory) continue;
    for (const prompt of prompts) {
      // Create 3 instruction variants per object
      const variants = [
        `Generate a VOXI voxel model of: ${prompt}`,
        `Create a 3D voxel model: ${prompt}`,
        `VOXI code for: ${prompt}`,
      ];
      for (const instruction of variants) {
        if (!existing.has(instruction)) {
          tasks.push({ instruction, description: prompt, category });
        }
      }
    }
  }

  const total = Math.min(tasks.length, maxCount);
  console.log(`Generating ${total} examples...`);
  console.log("");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const task = tasks[i];
    const progress = `[${i + 1}/${total}]`;

    try {
      process.stdout.write(`${progress} "${task.description}" ... `);
      const raw = await generateOne(task.description);
      const code = cleanVoxi(raw);
      const validation = validateVoxi(code);

      if (!validation.valid) {
        console.log(`SKIP (${validation.reason})`);
        failed++;
        continue;
      }

      // Save as JSONL entry
      const entry = {
        instruction: task.instruction,
        output: code,
        category: task.category,
        stats: {
          primitives: validation.primitiveCount,
          comments: validation.commentCount,
          colors: validation.colorCount,
          lines: code.split("\n").length,
        },
      };

      fs.appendFileSync(JSONL_PATH, JSON.stringify(entry) + "\n");

      // Also save individual .voxi file
      const safeName = task.description.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const voxiPath = path.join(OUT_DIR, `${task.category}_${safeName}.voxi`);
      fs.writeFileSync(voxiPath, code);

      console.log(`OK (${validation.primitiveCount} prims, ${validation.colorCount} colors, ${code.split("\n").length} lines)`);
      success++;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("");
  console.log(`Done! ${success} generated, ${failed} failed/skipped`);
  console.log(`Dataset: ${JSONL_PATH}`);
  console.log(`Individual files: ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
