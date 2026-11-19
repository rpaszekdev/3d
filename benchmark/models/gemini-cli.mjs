// Gemini CLI adapter — FREE (uses Google's gemini CLI)
// Passes prompt directly via -p flag (same as stress-test.sh)
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const MODEL_ID = "gemini-cli";
export const MODEL_NAME = "gemini-2.5-pro";

export async function generate(systemPrompt, userPrompt) {
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const { stdout } = await execFileAsync("gemini", ["-p", fullPrompt], {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });

  // Filter Gemini CLI status/MCP lines
  const lines = stdout.split("\n").filter(
    (l) =>
      !l.startsWith("Loaded") &&
      !l.startsWith("Registering") &&
      !l.startsWith("Server") &&
      !l.startsWith("Scheduling") &&
      !l.startsWith("Executing") &&
      !l.startsWith("MCP"),
  );
  return lines.join("\n");
}
