/**
 * SVG Creator — Preview Server
 *
 * Serves the viewer.html and provides API to load the latest generated SVG.
 * Much simpler than voxi-creator's server — no WebSocket needed.
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3457;

const app = express();
app.use(express.json());

// Serve viewer
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "viewer.html"));
});

// Serve static files from output directory
app.use("/output", express.static(path.join(__dirname, "output")));

// API: get latest SVG and SSL
app.get("/api/latest", (req, res) => {
  const latestDir = path.join(__dirname, "output", "latest");

  try {
    const svgPath = path.join(latestDir, "scene.svg");
    const sslPath = path.join(latestDir, "scene.ssl");

    const svg = fs.existsSync(svgPath)
      ? fs.readFileSync(svgPath, "utf8")
      : null;
    const ssl = fs.existsSync(sslPath)
      ? fs.readFileSync(sslPath, "utf8")
      : null;

    if (!svg) {
      return res.json({
        svg: null,
        ssl: null,
        message: 'No SVG generated yet. Run: node create.js "your prompt"',
      });
    }

    res.json({ svg, ssl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: list all generated scenes
app.get("/api/scenes", (req, res) => {
  const outputDir = path.join(__dirname, "output");

  try {
    const dirs = fs
      .readdirSync(outputDir)
      .filter(
        (d) =>
          d !== "latest" && fs.statSync(path.join(outputDir, d)).isDirectory(),
      )
      .sort()
      .reverse();

    const scenes = dirs.map((d) => {
      const sslPath = path.join(outputDir, d, "scene.ssl");
      const svgPath = path.join(outputDir, d, "scene.svg");
      return {
        name: d,
        hasSsl: fs.existsSync(sslPath),
        hasSvg: fs.existsSync(svgPath),
      };
    });

    res.json(scenes);
  } catch {
    res.json([]);
  }
});

// API: load a specific scene
app.get("/api/scene/:name", (req, res) => {
  const sceneDir = path.join(__dirname, "output", req.params.name);

  try {
    const svgPath = path.join(sceneDir, "scene.svg");
    const sslPath = path.join(sceneDir, "scene.ssl");

    const svg = fs.existsSync(svgPath)
      ? fs.readFileSync(svgPath, "utf8")
      : null;
    const ssl = fs.existsSync(sslPath)
      ? fs.readFileSync(sslPath, "utf8")
      : null;

    if (!svg) {
      return res.status(404).json({ error: "Scene not found" });
    }

    // Also copy to latest so the viewer picks it up
    const latestDir = path.join(__dirname, "output", "latest");
    fs.mkdirSync(latestDir, { recursive: true });
    fs.writeFileSync(path.join(latestDir, "scene.svg"), svg);
    if (ssl) fs.writeFileSync(path.join(latestDir, "scene.ssl"), ssl);

    res.json({ svg, ssl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  SVG Sketch Viewer running on http://localhost:${PORT}`);
  console.log(
    `  Generate illustrations with: node svg-creator/create.js "your prompt"\n`,
  );
});
