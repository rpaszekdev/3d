#!/usr/bin/env node
/**
 * SVG Creator — AI line-art illustration generation using SSL DSL.
 *
 * Usage:
 *   node create.js "a person sitting at a desk"
 *   node create.js "five testers at computers" --open
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { compile, extractSSL } from "./compiler.js";
import { renderASCII } from "./ascii-renderer.js";
import { callBuilder } from "./llm.js";
import { BUILDER_SYSTEM, buildPrompt } from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──
const args = process.argv.slice(2);
const prompt = args.find((a) => !a.startsWith("--"));
const shouldOpen = args.includes("--open");

if (!prompt) {
  console.error(`
SVG Creator — AI line-art illustration generation

Usage:
  node create.js "a person sitting at a desk"
  node create.js "five testers at computers" --open

Options:
  --open    Open the result in the live preview server
`);
  process.exit(1);
}

// ── Setup output directory ──
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const slug = prompt
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .slice(0, 30);
const outDir = path.join(__dirname, "output", `${timestamp}_${slug}`);
fs.mkdirSync(outDir, { recursive: true });

console.log(`\n=== SVG Creator ===`);
console.log(`Prompt:  "${prompt}"`);
console.log(`Output:  ${outDir}\n`);

// ── Generate SSL via LLM ──
console.log("Generating SSL code...");
const raw = await callBuilder(BUILDER_SYSTEM, buildPrompt(prompt));

const sslCode = extractSSL(raw);

if (!sslCode) {
  console.error("Error: LLM returned no valid SSL code.");
  console.error("Raw output:", raw.slice(0, 500));
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, "scene.ssl"), sslCode);
console.log(`SSL: ${sslCode.split("\n").length} lines`);

// ── Compile to SVG ──
console.log("Compiling to SVG...");
const { svg, ast } = compile(sslCode);

const svgPath = path.join(outDir, "scene.svg");
fs.writeFileSync(svgPath, svg);
console.log(`SVG: ${svg.length} bytes → ${svgPath}`);

// ── ASCII Preview ──
console.log("\n=== Preview ===");
const ascii = renderASCII(ast, { cols: 100 });
console.log(ascii);

// ── Copy latest for server ──
const latestDir = path.join(__dirname, "output", "latest");
fs.mkdirSync(latestDir, { recursive: true });
fs.writeFileSync(path.join(latestDir, "scene.ssl"), sslCode);
fs.writeFileSync(path.join(latestDir, "scene.svg"), svg);

console.log(`\n=== Done ===`);
console.log(`SSL:  ${path.join(outDir, "scene.ssl")}`);
console.log(`SVG:  ${svgPath}`);

if (shouldOpen) {
  console.log("\nOpening in browser...");
  try {
    execSync(`open "${svgPath}"`);
  } catch {
    console.log(`Open manually: ${svgPath}`);
  }
}

console.log(`\nTo preview with animations, run:`);
console.log(`  node svg-creator/server.js`);
console.log(`  Then open http://localhost:3457`);
