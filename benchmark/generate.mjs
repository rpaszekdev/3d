#!/usr/bin/env node
// generate.mjs — Generate SSL code from all models for all prompts
// Usage: node generate.mjs --free [--models claude-sonnet-4,gemini-2.5-pro] [--tiers 1,2] [--concurrency 3]
//   --free         Use CLI adapters (claude + gemini) — no API cost
//   --models X,Y   Filter to specific models
//   --tiers 1,2    Filter to specific difficulty tiers
//   --concurrency  Number of parallel generations (default: 3, use 1 for CLI)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Config ---

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const CONCURRENCY = parseInt(getArg("--concurrency") || "3", 10);
const filterModels = getArg("--models")?.split(",") || null;
const filterTiers = getArg("--tiers")?.split(",").map(Number) || null;

// --- SSL System Prompt (from stress-test.sh, battle-tested) ---

const SSL_SYSTEM = `You are a spatial sketch generator. Output ONLY valid SSL code — no markdown fences, no explanation.

SSL format: P1 header, then one shape per line.
SHAPES: 0=box 1=sphere 2=cylinder 3=cone 4=pyramid 10=wedge 11=sweep 12=hull
Standard: T X Y Z W H D C [R REF] [40 COUNT DX DY DZ]
Wedge: 10 X Y Z W1 H D W2 C (tapered box, W1=bottom W2=top width)
Sweep: 11 X1 Y1 Z1 X2 Y2 Z2 R C (curved arch between two points)
Hull: 12 X Y Z RX RY RZ C (ellipsoid with 3 radii)
Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray
Relations: 10=on 11=under 12=left 13=right 14=front 15=back 16=inside
Clone: append "40 COUNT DX DY DZ" to repeat element COUNT times with offset
Anchored: elements with relations use X Y Z as OFFSETS (use 0 0 0 for centered)
Center at X=200 Z=200. Y=0 ground. Range 0-400. Output 40-80 lines. Use clones heavily.

Example — table with anchored composition:
P1
0 150 0 150 100 5 100 7
0 0 0 0 8 60 8 7 11 0
0 90 0 0 8 60 8 7 11 0
0 0 0 90 8 60 8 7 11 0
0 90 0 90 8 60 8 7 11 0
2 0 0 0 10 25 0 4 10 0
1 20 0 -10 8 8 0 1 10 0`;

// --- Load models ---

const useFree = args.includes("--free");

// CLI-based adapters (free — use your existing subscriptions)
const FREE_CONFIGS = [
  { file: "./models/claude-cli.mjs", name: "claude-sonnet-4" },
  { file: "./models/gemini-cli.mjs", name: "gemini-2.5-pro" },
];

// API-based adapters (paid — need API keys in .env)
const API_CONFIGS = [
  { file: "./models/claude.mjs", key: "ANTHROPIC_API_KEY" },
  { file: "./models/openai.mjs", key: "OPENAI_API_KEY" },
  { file: "./models/gemini.mjs", key: "GOOGLE_API_KEY" },
  { file: "./models/together.mjs", key: "TOGETHER_API_KEY" },
  { file: "./models/grok.mjs", key: "XAI_API_KEY" },
  { file: "./models/qwen-cli.mjs", key: "DASHSCOPE_API_KEY" },
];

const models = [];

if (useFree) {
  // Load CLI-based (free) adapters
  for (const cfg of FREE_CONFIGS) {
    if (filterModels && !filterModels.includes(cfg.name)) continue;
    const mod = await import(cfg.file);
    models.push(mod);
  }
  // Also load Qwen if key is set (free tier)
  if (process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY) {
    const mod = await import("./models/qwen-cli.mjs");
    if (!filterModels || filterModels.includes(mod.MODEL_NAME)) {
      models.push(mod);
    }
  }
} else {
  // Load API-based adapters
  for (const cfg of API_CONFIGS) {
    if (!process.env[cfg.key]) {
      console.warn(`  skip ${cfg.file} — ${cfg.key} not set`);
      continue;
    }
    const mod = await import(cfg.file);
    if (filterModels && !filterModels.includes(mod.MODEL_NAME)) continue;
    models.push(mod);
  }
}

if (models.length === 0) {
  console.error("No models available.");
  console.error("  --free       Use claude + gemini CLI (no API cost)");
  console.error("  Or set API keys in .env file");
  process.exit(1);
}

// --- Load prompts ---

const promptsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "prompts.json"), "utf-8"),
);
const prompts = filterTiers
  ? promptsData.prompts.filter((p) => filterTiers.includes(p.tier))
  : promptsData.prompts;

console.log(`\n=== SSL Benchmark Generation ===`);
console.log(`Models: ${models.map((m) => m.MODEL_NAME).join(", ")}`);
console.log(`Prompts: ${prompts.length}`);
console.log(`Total generations: ${models.length * prompts.length}`);
console.log(`Concurrency: ${CONCURRENCY}\n`);

// --- Helpers ---

function cleanSSL(raw) {
  // Strip markdown fences and leading/trailing whitespace
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```\w*\n?/gm, "").replace(/```$/gm, "");
  cleaned = cleaned.replace(/^(Plaintext|plaintext|ssl)\s*\n/i, "");
  cleaned = cleaned.trim();
  return cleaned;
}

function validateSSL(ssl) {
  const lines = ssl.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { valid: false, error: "empty" };

  // Must start with P1 (or similar mode header)
  const header = lines[0].trim();
  if (!/^[PHVGF]/.test(header) && !/^P1/.test(header)) {
    return { valid: false, error: `bad header: ${header}` };
  }

  // At least a few shape lines
  const shapeLines = lines
    .slice(1)
    .filter((l) => !l.startsWith("--") && !l.startsWith("//"));
  if (shapeLines.length < 2) {
    return { valid: false, error: `only ${shapeLines.length} shape lines` };
  }

  return { valid: true, lineCount: shapeLines.length };
}

async function runWithConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task().then((r) => {
      executing.delete(p);
      return r;
    });
    executing.add(p);
    results.push(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// --- Generate ---

const runDir = path.join(__dirname, "runs");

// Create model output directories
for (const model of models) {
  fs.mkdirSync(path.join(runDir, model.MODEL_NAME), { recursive: true });
}

const stats = { success: 0, retry: 0, fail: 0 };
const tasks = [];

for (const prompt of prompts) {
  for (const model of models) {
    tasks.push(async () => {
      const outDir = path.join(runDir, model.MODEL_NAME);
      const sslPath = path.join(outDir, `${prompt.id}.ssl`);
      const metaPath = path.join(outDir, `${prompt.id}.meta.json`);

      // Skip if already generated
      if (fs.existsSync(sslPath) && fs.statSync(sslPath).size > 0) {
        console.log(`  ✓ ${model.MODEL_NAME}/${prompt.id} (cached)`);
        stats.success++;
        return;
      }

      const userPrompt = `Generate: ${prompt.prompt}`;
      const startTime = Date.now();

      try {
        let raw = await model.generate(SSL_SYSTEM, userPrompt);
        let ssl = cleanSSL(raw);
        let validation = validateSSL(ssl);

        // Retry once if invalid
        if (!validation.valid) {
          console.log(
            `  ↻ ${model.MODEL_NAME}/${prompt.id} retry (${validation.error})`,
          );
          const retryPrompt = `The following SSL code has errors. Fix it and output ONLY valid SSL:\n\n${ssl}`;
          raw = await model.generate(SSL_SYSTEM, retryPrompt);
          ssl = cleanSSL(raw);
          validation = validateSSL(ssl);
          stats.retry++;
        }

        if (!validation.valid) {
          console.log(
            `  ✗ ${model.MODEL_NAME}/${prompt.id} FAILED: ${validation.error}`,
          );
          stats.fail++;
          return;
        }

        const latencyMs = Date.now() - startTime;
        fs.writeFileSync(sslPath, ssl);
        fs.writeFileSync(
          metaPath,
          JSON.stringify({
            model: model.MODEL_NAME,
            modelId: model.MODEL_ID,
            promptId: prompt.id,
            prompt: prompt.prompt,
            tier: prompt.tier,
            lineCount: validation.lineCount,
            latencyMs,
            generatedAt: new Date().toISOString(),
          }),
        );

        console.log(
          `  ✓ ${model.MODEL_NAME}/${prompt.id} (${validation.lineCount}L, ${latencyMs}ms)`,
        );
        stats.success++;
      } catch (err) {
        console.error(
          `  ✗ ${model.MODEL_NAME}/${prompt.id} ERROR: ${err.message}`,
        );
        stats.fail++;
      }
    });
  }
}

await runWithConcurrency(tasks, CONCURRENCY);

console.log(`\n=== Done ===`);
console.log(
  `Success: ${stats.success} | Retried: ${stats.retry} | Failed: ${stats.fail}`,
);
console.log(`Output: ${runDir}/`);
