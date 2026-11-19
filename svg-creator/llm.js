/**
 * LLM interface using Claude Code CLI in -p mode.
 * Adapted from voxi-creator/llm.js for SSL generation.
 */

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

function runClaude(systemPrompt, userText) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--model", "sonnet"];

    const proc = execFile(
      "claude",
      args,
      {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000,
        env: { ...process.env },
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`claude CLI error: ${err.message}\n${stderr}`));
          return;
        }
        resolve(stdout.trim());
      }
    );

    proc.stdin.write(
      `[SYSTEM INSTRUCTIONS - FOLLOW EXACTLY]\n${systemPrompt}\n[END SYSTEM INSTRUCTIONS]\n\n${userText}`
    );
    proc.stdin.end();
  });
}

export async function callBuilder(systemPrompt, userText) {
  return runClaude(systemPrompt, userText);
}
