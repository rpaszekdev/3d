#!/usr/bin/env node
/**
 * lod-serve.js — Serve the LOD round-trip comparison viewer.
 *
 * Usage: node lod-serve.js [port]
 *   Opens http://localhost:3335
 */

import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 3335;

const app = express();

// Serve output files (voxi, txt, json)
app.use("/output", express.static(path.join(__dirname, "output")));

// Serve models directory
app.use("/models", express.static(path.join(__dirname, "models")));

// Model index endpoint
app.get("/api/models", (req, res) => {
  const modelsDir = path.join(__dirname, "models");
  const files = fs.readdirSync(modelsDir).filter((f) => f.endsWith(".voxi"));
  res.json(files);
});

// Serve the viewer HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "lod-viewer.html"));
});

app.listen(PORT, () => {
  console.log(`LOD Viewer: http://localhost:${PORT}`);
});
