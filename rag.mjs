#!/usr/bin/env node
// rag.mjs — Search voxel model database, copy matching model + prompt to clipboard
// Usage: node rag.mjs "cow"
// Usage: node rag.mjs "a horse running" --gen  (also generate via Gemini)

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const query = process.argv[2];
const doGen = process.argv.includes("--gen");

if (!query) {
  console.error("Usage: node rag.mjs <prompt> [--gen]");
  console.error("  node rag.mjs cow           → copies cow model to clipboard");
  console.error("  node rag.mjs 'a dog' --gen → finds closest model, sends to Gemini, copies result");
  process.exit(1);
}

// --- Build index from all .v4 files ---
const SEARCH_DIRS = [
  path.join(__dirname, "animals"),
  path.join(__dirname, "models"),
  path.join(__dirname, "rag-db"),
];

const db = [];

for (const dir of SEARCH_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".v4")) continue;
    const name = file.replace(".v4", "").replace(/[-_]/g, " ");
    const code = fs.readFileSync(path.join(dir, file), "utf-8");
    const lines = code.split("\n").filter(l => l.trim() && !l.startsWith("--")).length;
    db.push({ name, file, dir, code, lines });
  }
}

if (db.length === 0) {
  console.error("No .v4 models found. Voxelize some models first:");
  console.error("  node voxelize.mjs model.stl 32 animals/model.v4");
  process.exit(1);
}

console.log(`Database: ${db.length} models\n`);

// --- Search: simple keyword matching ---
function score(model, query) {
  const q = query.toLowerCase().split(/\s+/);
  const n = model.name.toLowerCase();
  let s = 0;
  for (const word of q) {
    if (n.includes(word)) s += 10;  // exact substring match
    // Fuzzy: check if any word in name starts with query word
    for (const nameWord of n.split(/\s+/)) {
      if (nameWord.startsWith(word)) s += 5;
      if (word.startsWith(nameWord)) s += 3;
    }
  }
  // Semantic aliases
  const aliases = {
    "dog": ["spot", "canine", "puppy"],
    "cat": ["kitten", "feline"],
    "horse": ["pony", "stallion", "mare"],
    "cow": ["bull", "cattle", "bovine"],
    "bird": ["sparrow", "eagle", "hawk"],
    "fish": ["salmon", "trout"],
    "car": ["vehicle", "automobile", "beetle"],
    "bug": ["beetle", "insect"],
    "rabbit": ["bunny", "hare"],
  };
  for (const [key, vals] of Object.entries(aliases)) {
    if (q.includes(key) && vals.some(v => n.includes(v))) s += 7;
    if (vals.some(v => q.includes(v)) && n.includes(key)) s += 7;
  }
  return s;
}

const results = db
  .map(m => ({ ...m, score: score(m, query) }))
  .sort((a, b) => b.score - a.score);

const best = results[0];

if (best.score === 0) {
  if (doGen) {
    // No match but --gen flag: use the first model as loose reference
    console.log(`No exact match for "${query}". Using "${best.name}" as loose reference.`);
  } else {
    console.log(`No match for "${query}". Available models:`);
    db.forEach(m => console.log(`  - ${m.name} (${m.lines} lines)`));
    console.log(`\nTip: use --gen to generate anyway with closest model as reference.`);
    process.exit(0);
  }
}

console.log(`Match: "${best.name}" (score: ${best.score}, ${best.lines} lines)`);
if (results.length > 1 && results[1].score > 0) {
  console.log(`  Also: ${results.slice(1, 4).filter(r => r.score > 0).map(r => `"${r.name}" (${r.score})`).join(", ")}`);
}

if (!doGen) {
  // Just copy the model
  try {
    execSync(`pbcopy`, { input: best.code });
    console.log(`\nCopied "${best.name}" to clipboard (${best.lines} lines). Paste into v4-voxel.html`);
  } catch {
    // pbcopy not available, print to stdout
    console.log(`\n${best.code}`);
  }
} else {
  // Generate with Gemini using the model as reference
  console.log(`\nGenerating "${query}" using "${best.name}" as reference...`);

  const SYSTEM = `You are a voxel 3D model generator. Output ONLY valid voxel code — no markdown, no explanation.

PRIMITIVES:
V W H D          -- grid size
B X Y Z W H D C  -- box
S X Y Z R C      -- sphere
C X Y Z R H C    -- cylinder
K X Y Z R H C    -- cone
P X Y Z C        -- point
E X Y Z RX RY RZ C -- ellipsoid
G name / /G / @ name X Y Z -- groups

COLORS: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray

Here is a reference model of a "${best.name}" for structural inspiration:
${best.code}

Now create: ${query}
Use appropriate colors. Make it detailed and recognizable. Keep it under 60 lines.`;

  try {
    const { execFileSync } = await import("child_process");
    const result = execFileSync("gemini", ["-p", SYSTEM], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    }).toString();

    // Clean output
    let code = result
      .split("\n")
      .filter(l =>
        !l.startsWith("Loaded") && !l.startsWith("Registering") &&
        !l.startsWith("Server") && !l.startsWith("Scheduling") &&
        !l.startsWith("Executing") && !l.startsWith("MCP")
      )
      .join("\n")
      .trim()
      .replace(/^```\w*\n?/gm, "")
      .replace(/```$/gm, "")
      .trim();

    try {
      execSync(`pbcopy`, { input: code });
      console.log(`\nGenerated and copied to clipboard. Paste into v4-voxel.html`);
    } catch {
      console.log(`\n${code}`);
    }
  } catch (err) {
    console.error(`Generation failed: ${err.message.split("\n")[0]}`);
    // Fall back to just copying the reference
    try {
      execSync(`pbcopy`, { input: best.code });
      console.log(`Copied reference "${best.name}" instead.`);
    } catch {
      console.log(best.code);
    }
  }
}
