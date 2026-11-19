/**
 * VOXI Render Server
 *
 * Express + WebSocket server that bridges the create.js script
 * with a browser tab running the VOXI renderer.
 *
 * Flow:
 *   create.js → POST /render {code} → server → WebSocket → browser tab
 *   browser tab renders → captures 6 angles via toDataURL() → WebSocket → server
 *   server → responds to POST with base64 images
 */

import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3333;

const app = express();
app.use(express.json({ limit: "50mb" }));

// Serve voxi-creator directory (for sdf-renderer.html)
app.use("/local", express.static(__dirname));

// Serve the parent directory (for v4-voxel.html and its Three.js imports — legacy)
app.use("/renderer", express.static(path.resolve(__dirname, "..")));

// Serve the render client page
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>VOXI Render Client</title></head>
<body style="margin:0;background:#0f1117;color:#e0e0e8;font-family:system-ui;display:flex;flex-direction:column;height:100vh">
<div style="padding:8px 16px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #2d3244;flex-shrink:0">
  <h2 style="font-size:16px;margin:0">VOXI Creator</h2>
  <span id="status" style="color:#6c8cff;font-size:13px">Connecting...</span>
  <span id="cycle-info" style="color:#6c8cff;font-size:13px;margin-left:auto"></span>
</div>
<div style="flex:1;position:relative;overflow:hidden">
  <iframe id="renderer" src="/local/sdf-renderer.html?v=${Date.now()}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none"></iframe>
</div>
<div id="log" style="font-size:11px;color:#8888a0;padding:6px 16px;max-height:80px;overflow-y:auto;border-top:1px solid #2d3244;flex-shrink:0"></div>

<script>
const ANGLES = [
  { name: 'front-iso',  pos: [3, 2.5, 3]   },
  { name: 'front',      pos: [0, 1, 4]     },
  { name: 'right',      pos: [4, 1, 0]     },
  { name: 'back',       pos: [0, 1, -4]    },
  { name: 'left',       pos: [-4, 1, 0]    },
  { name: 'top',        pos: [0.1, 5, 0.1] },
];

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const iframe = document.getElementById('renderer');
let rendererReady = false;

function log(msg) {
  const line = document.createElement('div');
  line.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
  logEl.prepend(line);
}

// Wait for iframe renderer to load
iframe.onload = () => {
  // Give Three.js a moment to initialize
  setTimeout(() => {
    const win = iframe.contentWindow;
    if (win && typeof win.setCameraPosition === 'function') {
      rendererReady = true;
      statusEl.textContent = 'Ready — renderer loaded';
      statusEl.style.color = '#4caf50';
      log('Renderer initialized');
      connectWS();
    } else {
      statusEl.textContent = 'Error: renderer functions not found';
      statusEl.style.color = '#ff6b7a';
    }
  }, 1500);
};

function connectWS() {
  const ws = new WebSocket('ws://' + location.host + '/ws');

  ws.onopen = () => {
    statusEl.textContent = 'Connected — waiting for render requests';
    statusEl.style.color = '#4caf50';
    log('WebSocket connected');
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'render') {
      try {
        const cycleEl = document.getElementById('cycle-info');
        if (cycleEl) cycleEl.textContent = 'Render #' + msg.id;
        statusEl.textContent = 'Building...';
        statusEl.style.color = '#fdd835';
        log('Rendering...');

        const win = iframe.contentWindow;

        // Set the code
        win.sdfSetCode(msg.code);

        // Wait for render
        await new Promise(r => setTimeout(r, 600));

        // Check for errors
        const statusMsg = iframe.contentDocument.getElementById('status-msg');
        if (statusMsg && statusMsg.classList.contains('error')) {
          ws.send(JSON.stringify({
            type: 'render-result',
            id: msg.id,
            error: statusMsg.textContent,
            screenshots: [],
          }));
          log('Error: ' + statusMsg.textContent);
          return;
        }

        // Capture from each angle — use setTimeout instead of rAF for reliability
        const screenshots = [];
        for (const angle of ANGLES) {
          // setCameraPosition now also calls renderer.render() synchronously
          win.setCameraPosition(angle.pos[0], angle.pos[1], angle.pos[2]);
          await new Promise(r => setTimeout(r, 200));
          const canvas = win.getRendererCanvas();
          // Try PNG first to rule out JPEG encoding issues
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          const base64 = dataUrl.split(',')[1];
          log(angle.name + ': ' + Math.round(base64.length/1024) + 'KB');
          screenshots.push({ name: angle.name, base64 });
        }

        // Reset camera
        win.resetCamera();

        const payload = JSON.stringify({
          type: 'render-result',
          id: msg.id,
          error: null,
          screenshots,
        });
        log('Sending ' + screenshots.length + ' angles (' + Math.round(payload.length/1024) + 'KB)');
        ws.send(payload);

        statusEl.textContent = 'Connected — waiting for next cycle';
        statusEl.style.color = '#4caf50';
        log('Done');
      } catch (err) {
        log('ERROR: ' + err.message);
        ws.send(JSON.stringify({
          type: 'render-result',
          id: msg.id,
          error: 'Browser render error: ' + err.message,
          screenshots: [],
        }));
      }
    }
  };

  ws.onerror = (e) => {
    log('WS error: ' + (e.message || 'unknown'));
  };

  ws.onclose = (e) => {
    log('WS closed: code=' + e.code + ' reason=' + e.reason);
    statusEl.textContent = 'Disconnected — reconnecting...';
    statusEl.style.color = '#ff9800';
    setTimeout(connectWS, 2000);
  };
}
</script>
</body>
</html>`);
});

// --- WebSocket setup ---
const server = createServer(app);
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 50 * 1024 * 1024,
});

let browserSocket = null;
const pendingRenders = new Map();

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  browserSocket = ws;
  console.log("  Browser renderer connected");

  ws.on("message", (data) => {
    const msg = JSON.parse(data);
    if (msg.type === "render-result" && pendingRenders.has(msg.id)) {
      pendingRenders.get(msg.id)(msg);
      pendingRenders.delete(msg.id);
    }
  });

  ws.on("close", () => {
    browserSocket = null;
    console.log("  Browser renderer disconnected");
  });
});

// --- HTTP API for create.js ---
let renderIdCounter = 0;

app.post("/render", (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  if (!browserSocket || browserSocket.readyState !== 1) {
    return res.status(503).json({
      error:
        "No browser renderer connected. Open http://localhost:3333 in a browser tab.",
    });
  }

  const id = ++renderIdCounter;

  const timeout = setTimeout(() => {
    if (pendingRenders.has(id)) {
      pendingRenders.delete(id);
      res.status(504).json({ error: "Render timed out" });
    }
  }, 30000);

  pendingRenders.set(id, (result) => {
    clearTimeout(timeout);
    res.json(result);
  });

  console.log(
    `  Render #${id}: sending to browser (ws state=${browserSocket.readyState})`,
  );
  browserSocket.send(JSON.stringify({ type: "render", id, code }));
});

// --- Health check ---
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rendererConnected: browserSocket !== null && browserSocket.readyState === 1,
  });
});

server.listen(PORT, () => {
  console.log(`\n  VOXI Render Server running on http://localhost:${PORT}`);
  console.log(
    `  Open http://localhost:${PORT} in a browser tab to connect the renderer.\n`,
  );
});

export { PORT };
