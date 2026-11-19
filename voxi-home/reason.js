#!/usr/bin/env node
/**
 * reason.js — VOXI-Home CLI Reasoning Tool
 *
 * Load a .voxihome file, analyze the layout, and chat with Claude
 * about spatial reasoning — furniture placement, fit checks, layout suggestions.
 *
 * Usage:
 *   node reason.js examples/living-room.voxihome
 *   node reason.js examples/living-room.voxihome --view    (show top-down + VOXI)
 *   node reason.js examples/living-room.voxihome --minds-eye (render with Mind's Eye)
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { loadCatalog, parseHome, describeScene } from "./parser.js";
import {
  getViolations,
  constraintsReport,
  findFreeZones,
} from "./constraints.js";
import { compileToVoxi, topDownView } from "./compiler.js";
import { buildSystemPrompt, buildSceneContext } from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI Entry Point ─────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const showView = args.includes("--view");
  const mindsEye = args.includes("--minds-eye");

  if (!filePath) {
    console.log("Usage: node reason.js <file.voxihome> [--view] [--minds-eye]");
    console.log("");
    console.log("  --view       Show top-down ASCII view and VOXI code");
    console.log("  --minds-eye  Render with Mind's Eye (6-angle views)");
    process.exit(1);
  }

  // Load catalog and parse scene
  const catalog = loadCatalog();
  const code = fs.readFileSync(filePath, "utf-8");
  let scene = parseHome(code, catalog);

  if (scene.errors.length) {
    console.log("\x1b[33mParse warnings:\x1b[0m");
    for (const e of scene.errors) console.log(`  ${e}`);
    console.log("");
  }

  if (!scene.room) {
    console.error("\x1b[31mError: No ROOM definition found.\x1b[0m");
    process.exit(1);
  }

  // Display scene info
  printSceneHeader(scene);

  // Show views if requested
  if (showView || mindsEye) {
    console.log("\x1b[36m── Top-Down View ──────────────────────────\x1b[0m");
    console.log(topDownView(scene));
    console.log("");
  }

  if (showView) {
    console.log("\x1b[36m── VOXI Code ──────────────────────────────\x1b[0m");
    console.log(compileToVoxi(scene));
    console.log("");
  }

  if (mindsEye) {
    await renderMindsEye(scene);
  }

  // Start interactive chat
  console.log("\x1b[36m── Chat ───────────────────────────────────\x1b[0m");
  console.log(
    "Ask about your layout. Type 'view' for top-down, 'voxi' for VOXI code,",
  );
  console.log(
    "'info' for scene stats, 'reload' to re-read file, 'quit' to exit.",
  );
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\x1b[33m> \x1b[0m",
  });

  const systemPrompt = buildSystemPrompt(catalog);

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Built-in commands
    if (input === "quit" || input === "exit") {
      console.log("Goodbye!");
      process.exit(0);
    }

    if (input === "view") {
      console.log(topDownView(scene));
      console.log("");
      rl.prompt();
      return;
    }

    if (input === "voxi") {
      console.log(compileToVoxi(scene));
      console.log("");
      rl.prompt();
      return;
    }

    if (input === "info") {
      printSceneHeader(scene);
      rl.prompt();
      return;
    }

    if (input === "constraints") {
      console.log(constraintsReport(scene));
      console.log("");
      rl.prompt();
      return;
    }

    if (input === "reload") {
      const newCode = fs.readFileSync(filePath, "utf-8");
      scene = parseHome(newCode, catalog);
      console.log("\x1b[32mScene reloaded.\x1b[0m");
      printSceneHeader(scene);
      rl.prompt();
      return;
    }

    if (input === "free") {
      const zones = findFreeZones(scene, 0.5, 0.5);
      if (zones.length === 0) {
        console.log("No significant free zones found.");
      } else {
        console.log("Free zones:");
        for (const z of zones.slice(0, 8)) {
          console.log(
            `  ${z.width.toFixed(1)}×${z.depth.toFixed(1)}m at (${z.x.toFixed(1)}, ${z.z.toFixed(1)})`,
          );
        }
      }
      console.log("");
      rl.prompt();
      return;
    }

    // Send to Claude for spatial reasoning — WITH FEEDBACK LOOP
    try {
      console.log("\x1b[90mThinking...\x1b[0m");

      const sceneDesc = describeScene(scene);
      const report = constraintsReport(scene);
      const view = topDownView(scene, 50);
      const context = buildSceneContext(sceneDesc, report, view);

      // Add Mind's Eye views to give Claude visual grounding
      let mindsEyeContext = "";
      const mindsEyeViews = await getMindsEyeViews(scene);
      if (mindsEyeViews) {
        mindsEyeContext = `\n\n## Mind's Eye Views (ASCII depth maps of current room)\n\n${mindsEyeViews}`;
      }

      const response = await callClaude(
        systemPrompt,
        context + mindsEyeContext + "\n\nUser question: " + input,
      );
      console.log("");
      console.log(response);
      console.log("");

      // Check if response contains voxihome code suggestions
      const suggestion = extractVoxiHomeSuggestion(response);
      if (suggestion) {
        console.log(
          "\x1b[36m── Suggested changes ──────────────────────\x1b[0m",
        );
        console.log(suggestion);
        console.log("");

        // FEEDBACK LOOP: Apply suggestion, render, verify
        await feedbackLoop(scene, suggestion, catalog, systemPrompt, filePath);
      }
    } catch (err) {
      console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
}

// ── Claude CLI interface ────────────────────────────────────────────

async function callClaude(systemPrompt, userText) {
  const combined = `INSTRUCTIONS:\n${systemPrompt}\n\nTASK:\n${userText}`;

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn("claude", ["-p", "--model", "sonnet"], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`claude exited ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.stdin.write(combined, () => {
      proc.stdin.end();
    });
  });
}

// ── Mind's Eye integration ──────────────────────────────────────────

async function renderMindsEye(scene) {
  const voxiCode = compileToVoxi(scene);
  const mindsEyePath = path.join(
    __dirname,
    "..",
    "voxi-reasoning",
    "minds-eye.js",
  );

  if (!fs.existsSync(mindsEyePath)) {
    console.log(
      "\x1b[33mMind's Eye not found at voxi-reasoning/minds-eye.js\x1b[0m",
    );
    return;
  }

  // Dynamically import and use Mind's Eye
  try {
    const { MindsEye } = await import(mindsEyePath);
    const eye = new MindsEye(voxiCode);
    console.log("\x1b[36m── Mind's Eye: Top View ────────────────────\x1b[0m");
    console.log(eye.exec("LOOK top"));
    console.log("");
    console.log("\x1b[36m── Mind's Eye: Front View ─────────────────\x1b[0m");
    console.log(eye.exec("LOOK front"));
    console.log("");
  } catch (err) {
    console.log(`\x1b[33mMind's Eye render failed: ${err.message}\x1b[0m`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function printSceneHeader(scene) {
  const r = scene.room;
  const area = (r.width * r.depth).toFixed(1);
  const itemCount = scene.items.length;
  const violations = getViolations(scene);
  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  console.log("");
  console.log(
    "\x1b[32m┌─ VOXI-Home Reasoner ─────────────────────────┐\x1b[0m",
  );
  console.log(
    `\x1b[32m│\x1b[0m Room: ${r.width}m × ${r.depth}m (${area} m²), ceiling ${r.height}m`,
  );
  console.log(
    `\x1b[32m│\x1b[0m Doors: ${scene.doors.length}, Windows: ${scene.windows.length}`,
  );
  console.log(`\x1b[32m│\x1b[0m Furniture: ${itemCount} items`);
  if (scene.items.length) {
    for (const item of scene.items) {
      console.log(
        `\x1b[32m│\x1b[0m   ${item.name} at (${item.x}, ${item.z})m facing ${item.facing}`,
      );
    }
  }

  if (errors.length) {
    console.log(`\x1b[31m│ Errors: ${errors.length}\x1b[0m`);
    for (const e of errors) console.log(`\x1b[31m│   ${e.message}\x1b[0m`);
  }
  if (warnings.length) {
    console.log(`\x1b[33m│ Warnings: ${warnings.length}\x1b[0m`);
    for (const w of warnings) console.log(`\x1b[33m│   ${w.message}\x1b[0m`);
  }
  if (!errors.length && !warnings.length) {
    console.log(`\x1b[32m│ Layout: valid, no violations\x1b[0m`);
  }

  console.log(
    "\x1b[32m└──────────────────────────────────────────────┘\x1b[0m",
  );
  console.log("");
}

// ── Mind's Eye feedback helpers ──────────────────────────────────────

let _mindsEyeModule = null;

async function loadMindsEye() {
  if (_mindsEyeModule) return _mindsEyeModule;
  const mindsEyePath = path.join(
    __dirname,
    "..",
    "voxi-reasoning",
    "minds-eye.js",
  );
  if (!fs.existsSync(mindsEyePath)) return null;
  try {
    _mindsEyeModule = await import(mindsEyePath);
    return _mindsEyeModule;
  } catch {
    return null;
  }
}

/**
 * Get Mind's Eye ASCII views of the current scene (top + front).
 * Returns text string Claude can read, or null if Mind's Eye unavailable.
 */
async function getMindsEyeViews(scene) {
  const mod = await loadMindsEye();
  if (!mod) return null;

  try {
    const voxiCode = compileToVoxi(scene);
    const eye = new mod.MindsEye(voxiCode);
    const top = eye.exec("LOOK top");
    const front = eye.exec("LOOK front");
    return `### Top-down view:\n\`\`\`\n${top}\n\`\`\`\n\n### Front view:\n\`\`\`\n${front}\n\`\`\``;
  } catch {
    return null;
  }
}

/**
 * Feedback loop: apply Claude's suggestion, render, verify, iterate.
 *
 * 1. Parse the suggestion and add items to a test scene
 * 2. Check constraints on the updated scene
 * 3. Render with Mind's Eye
 * 4. Send render + constraints back to Claude for verification
 * 5. If Claude finds issues, let it self-correct (max 2 iterations)
 * 6. If valid, offer to save to file
 */
async function feedbackLoop(
  scene,
  suggestion,
  catalog,
  systemPrompt,
  filePath,
) {
  const MAX_ITERATIONS = 2;
  let currentSuggestion = suggestion;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 1. Apply suggestion to a test scene
    const testCode =
      fs.readFileSync(filePath, "utf-8") + "\n" + currentSuggestion;
    const testScene = parseHome(testCode, catalog);

    if (testScene.errors.length) {
      console.log("\x1b[33mParse errors in suggestion:\x1b[0m");
      for (const e of testScene.errors) console.log(`  ${e}`);
      break;
    }

    // 2. Check constraints
    const violations = getViolations(testScene);
    const errors = violations.filter((v) => v.severity === "error");
    const report = constraintsReport(testScene);

    // 3. Render updated scene
    const updatedView = topDownView(testScene, 50);
    let mindsEyeViews = "";
    const views = await getMindsEyeViews(testScene);
    if (views) mindsEyeViews = views;

    console.log("\x1b[36m── Updated layout ─────────────────────────\x1b[0m");
    console.log(updatedView);
    console.log("");

    if (errors.length === 0) {
      // No errors — layout is valid
      console.log("\x1b[32mLayout is valid after applying suggestion.\x1b[0m");
      console.log("\x1b[90mConstraints:\x1b[0m");
      console.log(report);
      console.log("");

      // Offer to save
      console.log("\x1b[36mApply this change to your file? (yes/no)\x1b[0m");
      break;
    }

    // 4. Errors found — send back to Claude for self-correction
    console.log(
      `\x1b[33mIteration ${i + 1}: ${errors.length} constraint errors found. Asking Claude to fix...\x1b[0m`,
    );

    const verifyPrompt = `Your previous suggestion had constraint violations. Here is the result:

## Updated Scene
${describeScene(testScene)}

## Constraint Violations
${report}

## Top-Down View After Your Changes
\`\`\`
${updatedView}
\`\`\`

${mindsEyeViews ? `## Mind's Eye Render\n${mindsEyeViews}` : ""}

Please fix these violations. Output ONLY the corrected furniture lines (not the full scene), wrapped in \`\`\`voxihome\`\`\` code block.`;

    console.log("\x1b[90mClaude is reviewing and fixing...\x1b[0m");
    const correction = await callClaude(systemPrompt, verifyPrompt);
    console.log("");
    console.log(correction);
    console.log("");

    const corrected = extractVoxiHomeSuggestion(correction);
    if (!corrected) {
      console.log(
        "\x1b[33mClaude did not provide a corrected suggestion.\x1b[0m",
      );
      break;
    }

    currentSuggestion = corrected;
    console.log("\x1b[36m── Corrected suggestion ───────────────────\x1b[0m");
    console.log(currentSuggestion);
    console.log("");
  }
}

function extractVoxiHomeSuggestion(text) {
  const match = text.match(/```voxihome\n([\s\S]*?)```/);
  if (match) return match[1].trim();

  // Also try plain code block with VOXI-Home syntax
  const lines = text.split("\n");
  const voxiLines = lines.filter((l) =>
    /^\s*(ROOM|DOOR|WINDOW|SOFA|TABLE|CHAIR|BED|TV|STORAGE|DESK|RUG|LAMP|NIGHTSTAND)\s/i.test(
      l,
    ),
  );
  return voxiLines.length > 0 ? voxiLines.join("\n") : null;
}

// ── Run ─────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(`\x1b[31mFatal: ${err.message}\x1b[0m`);
  process.exit(1);
});
