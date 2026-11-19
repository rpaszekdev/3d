#!/usr/bin/env node
// render.js — Headless SSL → PNG via Playwright
// Usage: node render.js input.ssl output.png

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const [, , sslFile, pngFile] = process.argv;
if (!sslFile || !pngFile) {
  console.error("Usage: node render.js <input.ssl> <output.png>");
  process.exit(1);
}

const sslText = fs.readFileSync(sslFile, "utf-8");
const playgroundPath = path.join(__dirname, "playground.html");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });

  await page.goto(`file://${playgroundPath}`);
  await page.waitForSelector("#canvas");

  // Inject SSL code and trigger rendering
  await page.evaluate((code) => window.sslSetCode(code), sslText);

  // Wait for render to settle
  await page.waitForTimeout(400);

  // Enable presentation mode: hide grid, axis labels, index labels
  await page.evaluate(() => window.sslPresentationMode(true));
  await page.waitForTimeout(100);

  // Screenshot just the SVG canvas element
  const canvas = await page.$("#canvas");
  await canvas.screenshot({ path: path.resolve(pngFile), type: "png" });

  await browser.close();
  console.log(`Rendered: ${pngFile}`);
})();
