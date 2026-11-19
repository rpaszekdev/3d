#!/usr/bin/env node
// aggregate.mjs — Combine all results into site/data/benchmark-data.json
// and copy images to site/images/
// Usage: node aggregate.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runsDir = path.join(__dirname, "runs");
const siteDir = path.join(__dirname, "site");
const dataDir = path.join(siteDir, "data");
const imagesDir = path.join(siteDir, "images");

// Ensure output dirs exist
fs.mkdirSync(dataDir, { recursive: true });

// Load prompts
const promptsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "prompts.json"), "utf-8"),
);

// Collect all results
const modelDirs = fs.readdirSync(runsDir).filter((d) => {
  const full = path.join(runsDir, d);
  return fs.statSync(full).isDirectory();
});

const results = [];
const modelSet = new Set();

for (const modelDir of modelDirs) {
  modelSet.add(modelDir);
  const dir = path.join(runsDir, modelDir);
  const sslFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".ssl"));

  // Ensure image output directory
  const imgOutDir = path.join(imagesDir, modelDir);
  fs.mkdirSync(imgOutDir, { recursive: true });

  for (const sslFile of sslFiles) {
    const promptId = sslFile.replace(".ssl", "");
    const sslPath = path.join(dir, sslFile);
    const pngPath = path.join(dir, `${promptId}.png`);
    const evalPath = path.join(dir, `${promptId}.eval.json`);
    const metaPath = path.join(dir, `${promptId}.meta.json`);

    const ssl = fs.readFileSync(sslPath, "utf-8");

    let scores = null;
    if (fs.existsSync(evalPath)) {
      try {
        scores = JSON.parse(fs.readFileSync(evalPath, "utf-8"));
      } catch (e) {
        console.warn(`⚠ Bad eval JSON: ${evalPath}`);
      }
    }

    let meta = null;
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch (e) {
        console.warn(`⚠ Bad meta JSON: ${metaPath}`);
      }
    }

    // Copy PNG to site/images/
    const hasPng = fs.existsSync(pngPath);
    if (hasPng) {
      fs.copyFileSync(pngPath, path.join(imgOutDir, `${promptId}.png`));
    }

    results.push({
      promptId,
      model: modelDir,
      ssl,
      lineCount: ssl.split("\n").filter((l) => l.trim()).length,
      hasImage: hasPng,
      imagePath: hasPng ? `images/${modelDir}/${promptId}.png` : null,
      scores: scores
        ? {
            recognizability: scores.recognizability,
            aesthetic: scores.aesthetic,
            creativity: scores.creativity,
            total: scores.total,
            whatISee: scores.what_i_see,
          }
        : null,
      latencyMs: meta?.latencyMs || null,
      generatedAt: meta?.generatedAt || null,
    });
  }
}

// Build leaderboard
const modelNames = [...modelSet];
const leaderboard = modelNames.map((model) => {
  const modelResults = results.filter(
    (r) => r.model === model && r.scores,
  );
  const count = modelResults.length;

  if (count === 0) {
    return { model, avgTotal: 0, avgRecog: 0, avgAesth: 0, avgCreat: 0, count: 0, tierScores: {} };
  }

  const avg = (arr) =>
    Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;

  const avgTotal = avg(modelResults.map((r) => r.scores.total));
  const avgRecog = avg(modelResults.map((r) => r.scores.recognizability));
  const avgAesth = avg(modelResults.map((r) => r.scores.aesthetic));
  const avgCreat = avg(modelResults.map((r) => r.scores.creativity));

  // Per-tier scores
  const tierScores = {};
  for (let tier = 1; tier <= 5; tier++) {
    const tierPromptIds = promptsData.prompts
      .filter((p) => p.tier === tier)
      .map((p) => p.id);
    const tierResults = modelResults.filter((r) =>
      tierPromptIds.includes(r.promptId),
    );
    if (tierResults.length > 0) {
      tierScores[tier] = avg(tierResults.map((r) => r.scores.total));
    }
  }

  return { model, avgTotal, avgRecog, avgAesth, avgCreat, count, tierScores };
});

// Sort leaderboard by avgTotal descending
leaderboard.sort((a, b) => b.avgTotal - a.avgTotal);

// Build final data
const benchmarkData = {
  meta: {
    generatedAt: new Date().toISOString(),
    version: "1.0",
    models: modelNames,
    promptCount: promptsData.prompts.length,
    resultCount: results.length,
    evaluator: "claude-sonnet-4",
  },
  prompts: promptsData.prompts,
  results,
  leaderboard,
};

const outPath = path.join(dataDir, "benchmark-data.json");
fs.writeFileSync(outPath, JSON.stringify(benchmarkData, null, 2));

console.log(`\n=== SSL Benchmark Aggregation ===`);
console.log(`Models: ${modelNames.join(", ")}`);
console.log(`Results: ${results.length}`);
console.log(`Images copied: ${results.filter((r) => r.hasImage).length}`);
console.log(`With scores: ${results.filter((r) => r.scores).length}`);
console.log(`\nLeaderboard:`);
for (const entry of leaderboard) {
  console.log(
    `  ${entry.model.padEnd(20)} ${entry.avgTotal.toFixed(1)} (R:${entry.avgRecog} A:${entry.avgAesth} C:${entry.avgCreat}) [${entry.count} scored]`,
  );
}
console.log(`\nOutput: ${outPath}`);
