#!/usr/bin/env node
/**
 * reason-server.js — VOXI-Home Reasoning Server
 *
 * Serves the renderer + bridges WebSocket between browser and Claude.
 * The renderer streams spatial state → server sends to Claude → response
 * streams back → renderer applies changes. Full feedback loop.
 *
 * Usage:
 *   node reason-server.js [--port 8090]
 *
 * Then open http://localhost:8090 in browser.
 */

import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";
import { loadCatalog } from "./parser.js";
import { buildSystemPrompt } from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--port") || "8090");

// ── Load catalog and build system prompt ────────────────────────────

const catalog = loadCatalog();
const systemPrompt = buildSystemPrompt(catalog);

// ── HTTP Server (serves renderer files) ─────────────────────────────

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/renderer.html" : req.url;
  // Strip query strings
  filePath = filePath.split("?")[0];
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(fullPath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(fullPath).pipe(res);
});

// ── WebSocket Server ────────────────────────────────────────────────

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("\x1b[32m[ws] Browser connected\x1b[0m");

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "reason") {
        // Browser sends spatial state + user question
        // msg.spatialState: string (computed by renderer)
        // msg.question: string (user typed in chat)
        console.log(`\x1b[36m[reason] "${msg.question}"\x1b[0m`);

        ws.send(JSON.stringify({ type: "thinking" }));

        const fullContext = `${systemPrompt}\n\nTASK:\n${msg.spatialState}\n\nUser question: ${msg.question}`;
        const response = await callClaude(fullContext);

        console.log(`\x1b[32m[claude] Response: ${response.slice(0, 100)}...\x1b[0m`);

        ws.send(JSON.stringify({
          type: "response",
          text: response,
          suggestion: extractSuggestion(response),
        }));
      }

      if (msg.type === "verify") {
        // Feedback loop: renderer applied suggestion, sends updated state
        // msg.spatialState: updated state after applying suggestion
        // msg.violations: constraint violations found
        console.log(`\x1b[33m[verify] ${msg.violations.length} violations\x1b[0m`);

        if (msg.violations.length === 0) {
          ws.send(JSON.stringify({ type: "verified", ok: true }));
          return;
        }

        ws.send(JSON.stringify({ type: "thinking" }));

        const fixPrompt = `${systemPrompt}\n\nTASK:\nYour previous suggestion had constraint violations. Here is the updated scene:

${msg.spatialState}

Violations:
${msg.violations.map((v) => `- [${v.severity}] ${v.message}`).join("\n")}

Fix these violations. Output ONLY the corrected furniture lines in a \`\`\`voxihome\`\`\` code block.`;

        const correction = await callClaude(fixPrompt);
        console.log(`\x1b[32m[claude] Correction: ${correction.slice(0, 100)}...\x1b[0m`);

        ws.send(JSON.stringify({
          type: "correction",
          text: correction,
          suggestion: extractSuggestion(correction),
        }));
      }
    } catch (err) {
      console.error(`\x1b[31m[error] ${err.message}\x1b[0m`);
      ws.send(JSON.stringify({ type: "error", message: err.message }));
    }
  });

  ws.on("close", () => {
    console.log("\x1b[33m[ws] Browser disconnected\x1b[0m");
  });
});

// ── Claude CLI ──────────────────────────────────────────────────────

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn("claude", ["-p", "--model", "sonnet"], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`claude exited ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on("error", reject);

    proc.stdin.write(prompt, () => { proc.stdin.end(); });
  });
}

function extractSuggestion(text) {
  const match = text.match(/```voxihome\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  const lines = text.split("\n").filter((l) =>
    /^\s*(SOFA|TABLE|CHAIR|BED|TV|STORAGE|DESK|RUG|LAMP|NIGHTSTAND)\s/i.test(l)
  );
  return lines.length > 0 ? lines.join("\n") : null;
}

// ── Start ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log("");
  console.log("\x1b[32m┌─ VOXI-Home Reasoning Server ─────────────────┐\x1b[0m");
  console.log(`\x1b[32m│\x1b[0m  http://localhost:${PORT}`);
  console.log(`\x1b[32m│\x1b[0m  WebSocket: ws://localhost:${PORT}`);
  console.log(`\x1b[32m│\x1b[0m  Catalog: ${Object.keys(catalog).filter((k) => !k.startsWith("_")).length} types loaded`);
  console.log("\x1b[32m└──────────────────────────────────────────────┘\x1b[0m");
  console.log("");
});
