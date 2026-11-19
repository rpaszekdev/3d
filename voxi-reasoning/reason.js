#!/usr/bin/env node
/**
 * VOXI Reasoning — Spatial algorithm reasoning with text-based verification.
 *
 * The agent reasons about a spatial problem, sketches intermediate states
 * in VOXI code, and verifies via 6-view depth projections rendered as text.
 *
 * No images. No vision model. Pure text spatial perception.
 *
 * Modes:
 *   --text     Text-only verification (default, no server needed)
 *   --visual   Screenshot verification (requires server + browser)
 *
 * Usage:
 *   node reason.js "What happens when two boxes overlap in voxel space?"
 *   node reason.js "Trace marching cubes on a sphere" --steps 8
 *   node reason.js --interactive
 *   node reason.js --visual "question"   (legacy screenshot mode)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { renderVoxi, checkRendererHealth } from "./render-service.js";
import { callClaude, saveScreenshots } from "./llm.js";
import { REASONER_SYSTEM, VERIFIER_SYSTEM } from "./prompts.js";
import { textViewFromCode } from "./text-view.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Extract VOXI code from markdown-fenced blocks */
function extractVoxiCode(raw) {
  // Look for ```voxi ... ``` blocks first
  const fenced = raw.match(/```voxi\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Fallback: look for ```\n(V ...) blocks
  const generic = raw.match(/```\n?(V\s+\d[\s\S]*?)```/);
  if (generic) return generic[1].trim();

  // Last resort: find lines starting with V/B/S/C/K/P/E/D/G/--
  const lines = raw.split("\n");
  const voxiLines = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      if (/^(V|B|S|C|K|P|E|D|G|\/G|@|--)/.test(trimmed)) {
        started = true;
        voxiLines.push(line);
      }
    } else {
      if (trimmed === "" || /^(V|B|S|C|K|P|E|D|G|\/G|@|--)/.test(trimmed)) {
        voxiLines.push(line);
      } else {
        break;
      }
    }
  }
  return voxiLines.join("\n").trim();
}

// --- CLI args ---
const args = process.argv.slice(2);
const interactive = args.includes("--interactive");
const useVisual = args.includes("--visual");
const maxSteps = parseInt(args[args.indexOf("--steps") + 1]) || 10;
const question = args.find((a) => !a.startsWith("--"));

if (!question && !interactive) {
  console.error(`
VOXI Reasoning — Spatial algorithm reasoning with text-based verification

Usage:
  node reason.js "What happens when two boxes overlap in voxel space?"
  node reason.js "Trace marching cubes on a sphere" --steps 8
  node reason.js --interactive
  node reason.js --visual "question"   (screenshot mode, needs server)

Text mode (default) needs no server — VOXI code is projected into
6-view depth maps rendered as pure text.
`);
  process.exit(1);
}

// --- Check render server (only in visual mode) ---
if (useVisual) {
  const rendererOk = await checkRendererHealth();
  if (!rendererOk) {
    console.error(
      `Renderer not connected. Start server & open http://localhost:3334`,
    );
    process.exit(1);
  }
}

// --- Setup output ---
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const slug = (question || "interactive")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .slice(0, 30);
const outDir = path.join(__dirname, "output", `${timestamp}_${slug}`);
fs.mkdirSync(outDir, { recursive: true });

console.log(`\n=== VOXI Reasoning ===`);
if (question) console.log(`Question: "${question}"`);
console.log(`Max steps: ${maxSteps}`);
console.log(`Output:    ${outDir}\n`);

// --- Conversation history ---
const history = [];
const log = [];

async function reasoningStep(userMessage, step) {
  const label = `[Step ${step}]`;

  // Build conversation context
  let fullPrompt = "";
  if (history.length > 0) {
    fullPrompt += "CONVERSATION SO FAR:\n";
    for (const h of history.slice(-6)) {
      fullPrompt += `\n${h.role.toUpperCase()}:\n${h.content}\n`;
    }
    fullPrompt += "\n---\n\n";
  }
  fullPrompt += userMessage;

  console.log(`${label} Reasoning...`);
  const response = await callClaude(REASONER_SYSTEM, fullPrompt);

  history.push({ role: "user", content: userMessage });
  history.push({ role: "assistant", content: response });

  // Check if response contains VOXI code to render
  const voxiCode = extractVoxiCode(response);
  let screenshots = null;

  if (
    voxiCode &&
    (response.includes("CHECK") ||
      response.includes("check it") ||
      response.includes("```voxi"))
  ) {
    console.log(
      `${label} Sketch detected (${voxiCode.split("\n").length} lines) — projecting...`,
    );

    // Save sketch
    fs.writeFileSync(path.join(outDir, `step-${step}-sketch.voxi`), voxiCode);

    if (useVisual) {
      // ── VISUAL MODE: render screenshots (legacy) ──
      const renderResult = await renderVoxi(voxiCode);

      if (renderResult.error) {
        console.log(`${label} Render error: ${renderResult.error}`);
        history.push({
          role: "user",
          content: `Your VOXI sketch had a render error: ${renderResult.error}\nFix the code and try again.`,
        });
      } else {
        const shotDir = path.join(outDir, `step-${step}-shots`);
        fs.mkdirSync(shotDir, { recursive: true });
        const shotPaths = saveScreenshots(renderResult.screenshots, shotDir);
        screenshots = shotPaths;
        console.log(`${label} Captured ${shotPaths.length} angles`);

        console.log(`${label} Verifying sketch...`);
        const imageList = shotPaths.map((p) => `  - ${p}`).join("\n");
        const verifyPrompt = `The reasoner wrote this about their sketch:

${response}

Now read these 6 screenshots of the rendered sketch:
${imageList}

Does the render match what the reasoner expected? What spatial errors do you see?`;

        const verification = await callClaude(VERIFIER_SYSTEM, verifyPrompt);
        fs.writeFileSync(
          path.join(outDir, `step-${step}-verify.txt`),
          verification,
        );

        history.push({
          role: "user",
          content: `VISUAL VERIFICATION of your sketch:\n\n${verification}\n\nContinue reasoning. If the sketch was correct, move to the next step. If not, fix your understanding and sketch again.`,
        });

        console.log(`${label} Verification complete`);
      }
    } else {
      // ── TEXT MODE: 6-view depth projection (default) ──
      const blueprint = textViewFromCode(voxiCode);
      fs.writeFileSync(
        path.join(outDir, `step-${step}-textview.txt`),
        blueprint,
      );

      console.log(`${label} Text projection generated`);
      console.log(blueprint);
      console.log("");

      history.push({
        role: "user",
        content: `TEXT VIEW of your sketch (6 orthographic depth projections, 0=close 9=far .=empty):\n\n${blueprint}\n\nRead the depth maps. Does this match what you intended? Continue reasoning. If something looks wrong, fix your VOXI code and sketch again.`,
      });

      screenshots = "text";
    }
  } else {
    console.log(`${label} Text reasoning (no sketch)`);
  }

  // Save step
  fs.writeFileSync(path.join(outDir, `step-${step}-reasoning.txt`), response);
  log.push({
    step,
    hasSketch: !!voxiCode,
    sketchLines: voxiCode ? voxiCode.split("\n").length : 0,
    hasScreenshots: !!screenshots,
    responseLength: response.length,
  });

  // Print reasoning output (truncated for console)
  const preview = response.split("\n").slice(0, 8).join("\n");
  console.log(`${label} ---`);
  console.log(preview);
  if (response.split("\n").length > 8)
    console.log(`  ... (${response.split("\n").length} lines total)`);
  console.log("");

  return response;
}

// --- Main loop ---
if (interactive) {
  // Interactive mode: user asks questions, agent reasons + sketches
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log("Interactive reasoning mode. Type your spatial question.\n");
  let step = 1;

  while (step <= maxSteps) {
    const input = await ask(`You [${step}/${maxSteps}]: `);
    if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") break;
    if (!input.trim()) continue;

    await reasoningStep(input, step);
    step++;
  }

  rl.close();
} else {
  // Auto mode: reason about the question for up to maxSteps
  let step = 1;

  // Initial question
  await reasoningStep(
    `Reason about this spatial problem step by step. Use VOXI sketches to visualize intermediate states and verify your understanding visually.\n\nPROBLEM: ${question}`,
    step,
  );
  step++;

  // Continue reasoning until done or max steps
  while (step <= maxSteps) {
    const lastResponse = history[history.length - 1]?.content || "";

    // Check if reasoner thinks they're done
    if (
      lastResponse.includes("CONCLUSION") ||
      lastResponse.includes("SOLVED") ||
      lastResponse.includes("ANSWER:")
    ) {
      console.log(`Reasoner reached a conclusion at step ${step - 1}.`);
      break;
    }

    // If last message was verification feedback, let reasoner continue
    if (history[history.length - 1]?.role === "user") {
      await reasoningStep(history[history.length - 1].content, step);
    } else {
      // Prompt to continue
      await reasoningStep(
        "Continue your reasoning. Sketch the next state if it would help verify your understanding.",
        step,
      );
    }
    step++;
  }
}

// --- Save final log ---
fs.writeFileSync(path.join(outDir, "log.json"), JSON.stringify(log, null, 2));

// Save full conversation
fs.writeFileSync(
  path.join(outDir, "conversation.md"),
  history
    .map((h) => `## ${h.role.toUpperCase()}\n\n${h.content}\n`)
    .join("\n---\n\n"),
);

console.log("\n=== Summary ===");
for (const entry of log) {
  const sketch = entry.hasSketch ? ` — sketch ${entry.sketchLines} lines` : "";
  const verified = entry.hasScreenshots ? " ✓ verified" : "";
  console.log(`  Step ${entry.step}${sketch}${verified}`);
}
console.log(`\nOutput: ${outDir}`);
