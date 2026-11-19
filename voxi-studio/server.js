#!/usr/bin/env node
/**
 * VOXI Creator Server
 * Bridges the browser UI with Claude CLI for screenshot → DSL generation.
 *
 * Usage: node server.js
 * Opens http://localhost:8090
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = 8090;
const CLAUDE_PATH = '/Users/robertpaszek/.claude/local/claude';
const CREATOR_HTML = path.join(__dirname, 'creator.html');
const TMP_DIR = '/tmp/voxi-creator';

// Ensure tmp dir exists
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const SYSTEM_PROMPT = `You are a UI sketch generator. Given a screenshot of a website or app, generate a VOXI UI Sketch DSL recreation.

FORMAT RULES:
- First line: CANVAS width height #bgcolor
- Each element: TYPE x y w h z #color [options]
- Types: RECT, TEXT, LINE, ELLIPSE, IMG
- z = depth layer (0=back, higher=front)
- TEXT x y "content" size z #color [bold]
- RECT x y w h z #color [radius]
- LINE x1 y1 x2 y2 z #color [width]
- ELLIPSE cx cy rx ry z #color
- IMG x y w h z [label]
- Comments: -- description
- Standard canvas: 1440x900 for desktop, 390x844 for mobile

OUTPUT ONLY THE DSL CODE. No explanations, no markdown, no backticks. Just the DSL starting with CANVAS.

Be detailed — capture every visible element: headers, nav items, buttons, text blocks, images, cards, dividers, icons (as small ellipses or rects).`;

function handleRequest(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Serve creator.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(CREATOR_HTML, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // API: generate DSL from screenshot
  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { image, prompt } = data;

        // Save base64 image to temp file
        const imgPath = path.join(TMP_DIR, `screenshot-${Date.now()}.png`);
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(imgPath, Buffer.from(base64Data, 'base64'));

        // Build the prompt
        const userPrompt = prompt
          ? `Analyze this screenshot and ${prompt}. Generate VOXI UI Sketch DSL code.`
          : 'Analyze this screenshot and recreate it as VOXI UI Sketch DSL code.';

        const fullPrompt = `${userPrompt}\n\nImage: ${imgPath}`;

        console.log(`Generating DSL from screenshot... (${imgPath})`);

        // Call claude CLI
        const args = [
          '-p', fullPrompt,
          '--allowedTools', '',
          '--append-system-prompt', SYSTEM_PROMPT,
          '--max-budget-usd', '0.50',
        ];

        const child = execFile(CLAUDE_PATH, args, {
          timeout: 120000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env },
        }, (err, stdout, stderr) => {
          // Clean up temp file
          try { fs.unlinkSync(imgPath); } catch (e) {}

          if (err) {
            console.error('Claude error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          // Extract DSL from output — find lines starting with CANVAS
          let dsl = stdout.trim();

          // Strip markdown code fences if present
          dsl = dsl.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();

          // If it doesn't start with CANVAS, try to find it
          if (!dsl.startsWith('CANVAS')) {
            const idx = dsl.indexOf('CANVAS');
            if (idx >= 0) dsl = dsl.substring(idx);
          }

          console.log(`Generated ${dsl.split('\n').length} lines of DSL`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ dsl }));
        });

      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: generate from text prompt only
  if (req.method === 'POST' && req.url === '/prompt') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { prompt } = data;

        console.log(`Generating DSL from prompt: "${prompt.substring(0, 60)}..."`);

        const args = [
          '-p', `${prompt}\n\nGenerate VOXI UI Sketch DSL code for this.`,
          '--allowedTools', '',
          '--append-system-prompt', SYSTEM_PROMPT,
          '--max-budget-usd', '0.30',
        ];

        execFile(CLAUDE_PATH, args, {
          timeout: 120000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env },
        }, (err, stdout, stderr) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          let dsl = stdout.trim();
          dsl = dsl.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
          if (!dsl.startsWith('CANVAS')) {
            const idx = dsl.indexOf('CANVAS');
            if (idx >= 0) dsl = dsl.substring(idx);
          }

          console.log(`Generated ${dsl.split('\n').length} lines of DSL`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ dsl }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`VOXI Creator Server running at http://localhost:${PORT}`);
  require('child_process').exec(`open http://localhost:${PORT}`);
});
