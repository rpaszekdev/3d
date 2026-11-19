#!/usr/bin/env node
// story-gen.mjs — Convert a story into a 3D voxel storybook
// Usage: node story-gen.mjs story.txt [output.json]

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

const storyFile = process.argv[2];
const outFile = process.argv[3] || storyFile?.replace(/\.\w+$/, '') + '-scenes.json';

if (!storyFile) {
  console.error("Usage: node story-gen.mjs <story.txt> [output.json]");
  process.exit(1);
}

const storyText = fs.readFileSync(storyFile, "utf-8").trim();

// Split story into scenes (by double newline or paragraph)
const scenes = storyText
  .split(/\n\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 10);

console.log(`Story: ${path.basename(storyFile)}`);
console.log(`Scenes: ${scenes.length}\n`);

const SYSTEM = `You are a voxel 3D scene generator. Given a story paragraph, output ONLY valid voxel code that illustrates the scene. No markdown fences, no explanation.

PRIMITIVES:
V W H D          -- grid size
B X Y Z W H D C  -- box (position + size + color)
S X Y Z R C      -- sphere (center + radius + color)
C X Y Z R H C    -- cylinder (center + radius + height + color)
K X Y Z R H C    -- cone (center base + radius + height + color)
P X Y Z C        -- single point
E X Y Z RX RY RZ C -- ellipsoid
G name / /G      -- define group
@ name X Y Z     -- place group copy at offset

COLORS: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray

RULES:
- Use V 64 40 64 grid for scenes
- Y is up, Y=0 is ground
- Center the main subject around X=32 Z=32
- Add a ground plane: B 0 0 0 64 1 64 [color]
- Use groups + @ for repeated elements (trees, soldiers, etc.)
- Make it visually interesting — add environment, details
- 15-40 lines of code typical`;

const results = [];

for (let i = 0; i < scenes.length; i++) {
  const text = scenes[i];
  const prompt = `${SYSTEM}\n\nIllustrate this scene:\n"${text}"`;

  console.log(`[${i + 1}/${scenes.length}] ${text.slice(0, 60)}...`);

  try {
    const { stdout } = await execFileAsync("gemini", ["-p", prompt], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });

    // Clean output
    let code = stdout
      .split("\n")
      .filter(l =>
        !l.startsWith("Loaded") &&
        !l.startsWith("Registering") &&
        !l.startsWith("Server") &&
        !l.startsWith("Scheduling") &&
        !l.startsWith("Executing") &&
        !l.startsWith("MCP")
      )
      .join("\n")
      .trim();

    // Strip markdown fences
    code = code.replace(/^```\w*\n?/gm, "").replace(/```$/gm, "").trim();

    const lineCount = code.split("\n").filter(l => l.trim()).length;
    console.log(`  ✓ ${lineCount} lines\n`);

    results.push({ scene: i + 1, text, code });
  } catch (err) {
    console.error(`  ✗ ${err.message.split("\n")[0]}\n`);
    results.push({ scene: i + 1, text, code: `-- Error generating scene ${i + 1}\nV 64 40 64\nB 0 0 0 64 1 64 9` });
  }
}

// Build output
const output = {
  title: path.basename(storyFile, path.extname(storyFile)).replace(/[-_]/g, ' '),
  generatedAt: new Date().toISOString(),
  sceneCount: results.length,
  scenes: results,
};

fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
console.log(`\nDone! ${results.length} scenes → ${outFile}`);
console.log(`Open v4-voxel.html and load this file to play the story.`);
