/**
 * LLM interface using Claude Code CLI in -p mode.
 * Writes system prompts to temp files to avoid shell escaping issues.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function writeTempFile(content, prefix) {
  const tmpPath = path.join(os.tmpdir(), `voxi-${prefix}-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, content);
  return tmpPath;
}

function runClaude(systemPrompt, userText, extraArgs = []) {
  const sysFile = writeTempFile(systemPrompt, 'sys');
  const sysContent = fs.readFileSync(sysFile, 'utf8');

  return new Promise((resolve, reject) => {
    // Pass system prompt via stdin combined with user text
    const combinedInput = userText;

    const args = [
      '-p',
      '--model', 'sonnet',
      ...extraArgs,
    ];

    const proc = execFile('claude', args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 180000,
      env: { ...process.env },
    }, (err, stdout, stderr) => {
      try { fs.unlinkSync(sysFile); } catch {}
      if (err) {
        reject(new Error(`claude CLI error: ${err.message}\n${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });

    // Prepend system prompt as context in the user message
    proc.stdin.write(`[SYSTEM INSTRUCTIONS - FOLLOW EXACTLY]\n${systemPrompt}\n[END SYSTEM INSTRUCTIONS]\n\n${userText}`);
    proc.stdin.end();
  });
}

/**
 * Call Claude for VOXI code generation.
 */
export async function callBuilder(systemPrompt, userText) {
  return runClaude(systemPrompt, userText, ['--allowedTools', 'Read']);
}

/**
 * Call Claude for critic evaluation (needs Read tool for images).
 */
export async function callCritic(systemPrompt, userText) {
  return runClaude(systemPrompt, userText);
}

/**
 * Save base64 screenshots to a directory.
 */
export function saveScreenshots(screenshots, outDir) {
  const paths = [];
  for (const shot of screenshots) {
    const filePath = path.join(outDir, `${shot.name}.jpg`);
    fs.writeFileSync(filePath, Buffer.from(shot.base64, 'base64'));
    paths.push(filePath);
  }
  return paths;
}
