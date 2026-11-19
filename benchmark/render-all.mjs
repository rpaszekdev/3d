#!/usr/bin/env node
// render-all.mjs — Batch render all SSL files to PNG via render3d.js
// Usage: node render-all.mjs [--concurrency 2]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const concurrencyIdx = args.indexOf("--concurrency");
const CONCURRENCY = concurrencyIdx !== -1 ? parseInt(args[concurrencyIdx + 1], 10) : 2;

const runsDir = path.join(__dirname, "runs");
const rendererScript = path.join(__dirname, "..", "render3d.js");

// Verify render3d.js exists
if (!fs.existsSync(rendererScript)) {
  console.error(`render3d.js not found at: ${rendererScript}`);
  process.exit(1);
}

// Collect all .ssl files across model directories
const sslFiles = [];
const modelDirs = fs.readdirSync(runsDir).filter((d) => {
  const full = path.join(runsDir, d);
  return fs.statSync(full).isDirectory();
});

for (const modelDir of modelDirs) {
  const dir = path.join(runsDir, modelDir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ssl"));
  for (const file of files) {
    const sslPath = path.join(dir, file);
    const pngPath = sslPath.replace(".ssl", ".png");
    sslFiles.push({ sslPath, pngPath, model: modelDir, id: file.replace(".ssl", "") });
  }
}

// Filter out already-rendered
const toRender = sslFiles.filter((f) => !fs.existsSync(f.pngPath));

console.log(`\n=== SSL Batch Renderer ===`);
console.log(`Total SSL files: ${sslFiles.length}`);
console.log(`Already rendered: ${sslFiles.length - toRender.length}`);
console.log(`To render: ${toRender.length}`);
console.log(`Concurrency: ${CONCURRENCY}\n`);

if (toRender.length === 0) {
  console.log("Nothing to render.");
  process.exit(0);
}

let done = 0;
let failed = 0;

async function renderOne(file) {
  try {
    await execFileAsync("node", [rendererScript, file.sslPath, file.pngPath], {
      timeout: 60_000,
    });
    done++;
    const pct = Math.round(((done + failed) / toRender.length) * 100);
    console.log(`  [${pct}%] ✓ ${file.model}/${file.id}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${file.model}/${file.id}: ${err.message.split("\n")[0]}`);
  }
}

// Run with concurrency limit
const executing = new Set();
for (const file of toRender) {
  const p = renderOne(file).then(() => executing.delete(p));
  executing.add(p);
  if (executing.size >= CONCURRENCY) {
    await Promise.race(executing);
  }
}
await Promise.all(executing);

console.log(`\n=== Done ===`);
console.log(`Rendered: ${done} | Failed: ${failed}`);
