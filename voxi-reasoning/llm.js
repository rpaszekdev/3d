/**
 * LLM interface using Claude Code CLI in -p mode.
 * Uses spawn for proper stdin handling with large prompts.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Call Claude via CLI -p mode.
 * @param {string} systemPrompt - System prompt (sent as part of user message)
 * @param {string} userText - User message
 * @returns {Promise<string>} Response text
 */
export async function callClaude(systemPrompt, userText) {
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

    // Write combined prompt and close stdin
    proc.stdin.write(combined, () => {
      proc.stdin.end();
    });
  });
}

/**
 * Save base64 screenshots to a persistent directory.
 * Returns array of absolute file paths.
 */
export function saveScreenshots(screenshots, outDir) {
  const paths = [];
  for (const shot of screenshots) {
    const filePath = path.join(outDir, `${shot.name}.jpg`);
    fs.writeFileSync(filePath, Buffer.from(shot.base64, "base64"));
    paths.push(filePath);
  }
  return paths;
}
