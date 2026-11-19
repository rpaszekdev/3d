#!/usr/bin/env node
/**
 * VOXI Creator — AI 3D model generation with builder-critic loop.
 * Uses `claude -p` for LLM calls. Images passed as file paths for Claude to read.
 *
 * Prerequisites:
 *   1. node server.js
 *   2. Open http://localhost:3333 in browser
 *
 * Usage:
 *   node create.js "a penguin"
 *   node create.js "a penguin" --cycles 4
 *   node create.js "a penguin" --ref penguin.png --cycles 8
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderSdf, checkRendererHealth } from "./render-service.js";
import { callBuilder, callCritic, saveScreenshots } from "./llm.js";
import { BUILDER_SYSTEM, CRITIC_SYSTEM } from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Extract only valid SDF DSL lines from LLM output */
function extractSdfCode(raw) {
  const cleaned = raw.replace(/```[\w]*\n?/g, "").replace(/```$/gm, "");
  const lines = cleaned.split("\n");
  const sdfLines = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // Valid SDF lines start with a primitive, boolean op, comment, or are blank (within code)
    if (!started) {
      if (/^(sphere|box|cylinder|torus|subtract|intersect|#)/.test(trimmed)) {
        started = true;
        sdfLines.push(line);
      }
    } else {
      if (
        trimmed === "" ||
        /^(sphere|box|cylinder|torus|subtract|intersect|#)/.test(trimmed)
      ) {
        sdfLines.push(line);
      } else {
        break;
      }
    }
  }
  return sdfLines.join("\n").trim();
}

// --- CLI args ---
const args = process.argv.slice(2);
const prompt = args.find((a) => !a.startsWith("--"));
const cycles = parseInt(args[args.indexOf("--cycles") + 1]) || 6;
const refPath = args.includes("--ref") ? args[args.indexOf("--ref") + 1] : null;

if (!prompt) {
  console.error(`
VOXI Creator — AI 3D model generation

Usage:
  node create.js "a penguin"
  node create.js "a cute cat" --cycles 4
  node create.js "a dragon" --ref dragon.png --cycles 8

Prerequisites:
  1. node server.js     (start render server)
  2. Open http://localhost:3333 in browser
`);
  process.exit(1);
}

// --- Check render server ---
const rendererOk = await checkRendererHealth();
if (!rendererOk) {
  console.error(
    `Renderer not connected. Start server & open http://localhost:3333`,
  );
  process.exit(1);
}

// --- Setup output ---
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const slug = prompt
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .slice(0, 30);
const outDir = path.join(__dirname, "output", `${timestamp}_${slug}`);
fs.mkdirSync(outDir, { recursive: true });

const refAbsPath = refPath
  ? path.isAbsolute(refPath)
    ? refPath
    : path.resolve(process.cwd(), refPath)
  : null;

if (refAbsPath && !fs.existsSync(refAbsPath)) {
  console.error(`Reference image not found: ${refAbsPath}`);
  process.exit(1);
}

console.log(`\n=== SDF Creator ===`);
console.log(`Prompt:  "${prompt}"`);
console.log(`Cycles:  ${cycles}`);
if (refAbsPath) console.log(`Ref:     ${refAbsPath}`);
console.log(`Output:  ${outDir}\n`);

let currentCode = null;
const log = [];

for (let cycle = 0; cycle < cycles; cycle++) {
  const label = `[${cycle + 1}/${cycles}]`;

  // ── BUILDER ──
  console.log(`${label} Builder generating...`);

  let builderPrompt;
  if (cycle === 0) {
    builderPrompt = `Create a 3D model of: ${prompt}`;
    if (refAbsPath) {
      builderPrompt += `\n\nRead this reference image and match its shape/proportions: ${refAbsPath}`;
    }
    builderPrompt += `\n\nOutput ONLY valid SDF DSL code. No explanation, no markdown.`;
  } else {
    const feedback = log[log.length - 1].criticFeedback;
    builderPrompt = `Improve your 3D model of: ${prompt}

Your previous SDF DSL code:
${currentCode}

The critic reviewed renders from 6 angles and said:

${feedback}

Rewrite the COMPLETE SDF DSL code with all improvements applied. Output ONLY SDF DSL code. No explanation, no markdown.`;
  }

  currentCode = await callBuilder(BUILDER_SYSTEM, builderPrompt);

  // Strip everything before the first SDF command
  currentCode = extractSdfCode(currentCode);

  fs.writeFileSync(path.join(outDir, `cycle-${cycle + 1}.sdf`), currentCode);
  console.log(`${label} Code: ${currentCode.split("\n").length} lines`);

  // ── RENDER ──
  console.log(`${label} Rendering...`);
  const renderResult = await renderSdf(currentCode);

  if (renderResult.error) {
    console.error(`${label} Render error: ${renderResult.error}`);
    currentCode = await callBuilder(
      BUILDER_SYSTEM,
      `Your SDF DSL code had a parse error: ${renderResult.error}\n\nCode:\n${currentCode}\n\nFix it. Output ONLY corrected SDF DSL code.`,
    );
    currentCode = extractSdfCode(currentCode);
    log.push({ cycle: cycle + 1, error: renderResult.error });
    continue;
  }

  // Save screenshots to cycle-specific subdir
  const shotDir = path.join(outDir, `cycle-${cycle + 1}-shots`);
  fs.mkdirSync(shotDir, { recursive: true });
  const shotPaths = saveScreenshots(renderResult.screenshots, shotDir);
  console.log(`${label} Captured ${shotPaths.length} angles`);

  // ── CRITIC ──
  console.log(`${label} Critic evaluating...`);

  const imageList = shotPaths.map((p) => `  - ${p}`).join("\n");
  let criticPrompt = `Evaluate this 3D model. The user requested: "${prompt}"

Read these 6 screenshot files showing the model from different angles:
${imageList}

The angles are: front-iso, front, right, back, left, top.`;

  if (refAbsPath) {
    criticPrompt += `\n\nAlso read this reference image to compare: ${refAbsPath}`;
  }

  const criticText = await callCritic(CRITIC_SYSTEM, criticPrompt);

  // Parse score
  const scoreMatch = criticText.match(/SCORE:\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

  fs.writeFileSync(
    path.join(outDir, `cycle-${cycle + 1}-critic.txt`),
    criticText,
  );

  log.push({
    cycle: cycle + 1,
    score,
    criticFeedback: criticText,
    codeLines: currentCode.split("\n").length,
  });

  console.log(`${label} Score: ${score}/10`);

  const priorityMatch = criticText.match(/PRIORITY_FIX:\s*(.+)/);
  if (priorityMatch) {
    console.log(`${label} Fix: ${priorityMatch[1].trim()}`);
  }

  if (score >= 9) {
    console.log(`\n${label} Score >= 9 — done!`);
    break;
  }

  console.log("");
}

// ── Final ──
fs.writeFileSync(path.join(outDir, "final.sdf"), currentCode);
fs.writeFileSync(path.join(outDir, "log.json"), JSON.stringify(log, null, 2));

console.log("\n=== Results ===");
for (const entry of log) {
  if (entry.error) {
    console.log(`  Cycle ${entry.cycle}: ERROR — ${entry.error}`);
  } else {
    console.log(
      `  Cycle ${entry.cycle}: Score ${entry.score}/10 (${entry.codeLines} lines)`,
    );
  }
}
console.log(`\nFinal: ${path.join(outDir, "final.sdf")}`);
console.log(`All:   ${outDir}`);
