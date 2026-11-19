#!/usr/bin/env node
// evaluate.mjs — Score each rendered PNG via Claude vision evaluation
// Usage: node evaluate.mjs [--free] [--concurrency 3]
//   --free  Use Claude CLI for evaluation (no API cost, slower, sequential)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import "dotenv/config";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const useFree = args.includes("--free");
const concurrencyIdx = args.indexOf("--concurrency");
const CONCURRENCY = useFree
  ? 1
  : concurrencyIdx !== -1 ? parseInt(args[concurrencyIdx + 1], 10) : 3;

let client = null;
if (!useFree) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  client = new Anthropic();
}

const EVALUATOR_MODEL = useFree ? "claude-cli" : "claude-sonnet-4-20250514";
const CLAUDE_BIN = process.env.CLAUDE_BIN || `${process.env.HOME}/.claude/local/claude`;

const EVAL_SYSTEM = `You are an expert evaluator of 3D spatial sketches rendered from a compact DSL called SSL.
You will be shown an isometric render of a 3D scene and told what the prompt was.
Score the render on three dimensions, each 1-10:

- recognizability: How clearly does this depict the prompted subject? (10 = instantly recognizable, 1 = unrecognizable)
- aesthetic: Visual quality, proportions, spatial arrangement. (10 = beautiful/well-composed, 1 = broken/ugly)
- creativity: Use of shapes, clever composition, detail beyond minimum. (10 = inspired, 1 = bare minimum)

Respond with ONLY a JSON object, no markdown fences:
{"recognizability":N,"aesthetic":N,"creativity":N,"total":N,"what_i_see":"brief 1-sentence description of what you see"}

The "total" should be the average of the three scores, rounded to one decimal.`;

// --- Collect render results ---

const runsDir = path.join(__dirname, "runs");
const promptsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "prompts.json"), "utf-8"),
);
const promptMap = Object.fromEntries(
  promptsData.prompts.map((p) => [p.id, p]),
);

const toEvaluate = [];
const modelDirs = fs.readdirSync(runsDir).filter((d) => {
  const full = path.join(runsDir, d);
  return fs.statSync(full).isDirectory();
});

for (const modelDir of modelDirs) {
  const dir = path.join(runsDir, modelDir);
  const pngFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));

  for (const pngFile of pngFiles) {
    const promptId = pngFile.replace(".png", "");
    const evalPath = path.join(dir, `${promptId}.eval.json`);
    const pngPath = path.join(dir, pngFile);

    // Skip already evaluated
    if (fs.existsSync(evalPath)) continue;

    const promptInfo = promptMap[promptId];
    if (!promptInfo) {
      console.warn(`⚠ Unknown prompt ID: ${promptId} in ${modelDir}`);
      continue;
    }

    toEvaluate.push({
      model: modelDir,
      promptId,
      prompt: promptInfo.prompt,
      pngPath,
      evalPath,
    });
  }
}

console.log(`\n=== SSL Benchmark Evaluation ===`);
console.log(`Evaluator: ${EVALUATOR_MODEL}`);
console.log(`To evaluate: ${toEvaluate.length}`);
console.log(`Concurrency: ${CONCURRENCY}\n`);

if (toEvaluate.length === 0) {
  console.log("Nothing to evaluate.");
  process.exit(0);
}

let done = 0;
let failed = 0;

async function evaluateOne(item) {
  try {
    let raw;

    if (useFree) {
      // Use Claude CLI with image reading
      const absPng = path.resolve(item.pngPath);
      const evalPrompt = `${EVAL_SYSTEM}\n\nRead the image file at ${absPng} and evaluate it. This render was prompted with: "${item.prompt}"\n\nRespond with ONLY a JSON object.`;
      const { stdout } = await execFileAsync(CLAUDE_BIN, [
        "-p", evalPrompt,
        "--output-format", "text",
        "--allowedTools", "Read",
        "--tools", "Read",
      ], { timeout: 120_000, maxBuffer: 1024 * 1024 });
      raw = stdout.trim();
    } else {
      // Use Anthropic API with base64 image
      const imageData = fs.readFileSync(item.pngPath).toString("base64");

      const response = await client.messages.create({
        model: EVALUATOR_MODEL,
        max_tokens: 512,
        system: EVAL_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: imageData,
                },
              },
              {
                type: "text",
                text: `This render was prompted with: "${item.prompt}"\n\nScore it.`,
              },
            ],
          },
        ],
      });
      raw = response.content[0].text.trim();
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const scores = JSON.parse(jsonMatch[0]);

    // Ensure total is computed
    if (!scores.total) {
      scores.total =
        Math.round(
          ((scores.recognizability + scores.aesthetic + scores.creativity) / 3) *
            10,
        ) / 10;
    }

    const result = {
      model: item.model,
      promptId: item.promptId,
      prompt: item.prompt,
      evaluator: EVALUATOR_MODEL,
      evaluatedAt: new Date().toISOString(),
      ...scores,
    };

    fs.writeFileSync(item.evalPath, JSON.stringify(result, null, 2));
    done++;

    const pct = Math.round(((done + failed) / toEvaluate.length) * 100);
    console.log(
      `  [${pct}%] ✓ ${item.model}/${item.promptId} — R:${scores.recognizability} A:${scores.aesthetic} C:${scores.creativity} = ${scores.total}`,
    );
  } catch (err) {
    failed++;
    console.error(
      `  ✗ ${item.model}/${item.promptId}: ${err.message.split("\n")[0]}`,
    );
  }
}

// Run with concurrency limit
const executing = new Set();
for (const item of toEvaluate) {
  const p = evaluateOne(item).then(() => executing.delete(p));
  executing.add(p);
  if (executing.size >= CONCURRENCY) {
    await Promise.race(executing);
  }
}
await Promise.all(executing);

console.log(`\n=== Done ===`);
console.log(`Evaluated: ${done} | Failed: ${failed}`);
