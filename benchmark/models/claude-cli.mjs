// Claude Code CLI adapter — FREE (uses your Claude subscription)
// Pipes prompt via stdin to avoid shell argument issues with long prompts
import { spawn } from "child_process";

const CLAUDE_BIN =
  process.env.CLAUDE_BIN || `${process.env.HOME}/.claude/local/claude`;

export const MODEL_ID = "claude-cli";
export const MODEL_NAME = "claude-sonnet-4";

export async function generate(systemPrompt, userPrompt) {
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_BIN, [
      "-p", "-",
      "--output-format", "text",
    ], { timeout: 120_000 });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude exit ${code}: ${stderr.slice(0, 200)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on("error", reject);

    proc.stdin.write(fullPrompt);
    proc.stdin.end();
  });
}
