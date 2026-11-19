#!/usr/bin/env node
// render3d.js — Headless SSL → PNG via Playwright + Three.js renderer
// Usage:
//   node render3d.js input.ssl output.png              (single iso screenshot)
//   node render3d.js input.ssl output_dir/ --angles    (4 angle screenshots)

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const multiAngle = args.includes("--angles");
const filteredArgs = args.filter((a) => a !== "--angles");
const [sslFile, outputPath] = filteredArgs;

if (!sslFile || !outputPath) {
  console.error(
    "Usage: node render3d.js <input.ssl> <output.png|output_dir/> [--angles]",
  );
  process.exit(1);
}

const sslText = fs.readFileSync(sslFile, "utf-8");
const rendererPath = path.join(__dirname, "v25-3d.html");

(async () => {
  const browser = await chromium.launch({
    args: [
      "--disable-web-security",
      "--allow-file-access-from-files",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1000 },
  });

  // Listen for console errors
  page.on("pageerror", (err) => console.error("Page error:", err.message));

  // Use http server approach: serve file via data URL won't work, so just navigate
  await page.goto(`file://${rendererPath}`, { waitUntil: "networkidle" });

  // Wait for Three.js to load — give it more time for CDN fetch
  try {
    await page.waitForFunction(() => typeof window.sslSetCode === "function", {
      timeout: 30000,
    });
  } catch (e) {
    console.error(
      "Three.js failed to load. Trying fallback with old SVG renderer...",
    );
    // Fall back to the SVG renderer
    const svgRenderer = path.join(__dirname, "v25.html");
    await page.goto(`file://${svgRenderer}`);
    await page.waitForSelector("#canvas");
    await page.evaluate((code) => window.sslSetCode(code), sslText);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.sslPresentationMode(true));
    await page.waitForTimeout(100);

    if (multiAngle) {
      const outDir = path.resolve(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const canvas = await page.$("#canvas");
      await canvas.screenshot({
        path: path.join(outDir, "iso.png"),
        type: "png",
      });
      // SVG renderer can only do one angle, copy it for all
      for (const name of ["front", "side", "top"]) {
        fs.copyFileSync(
          path.join(outDir, "iso.png"),
          path.join(outDir, `${name}.png`),
        );
      }
      console.log(`Rendered (SVG fallback): ${outDir}`);
    } else {
      const canvas = await page.$("#canvas");
      await canvas.screenshot({ path: path.resolve(outputPath), type: "png" });
      console.log(`Rendered (SVG fallback): ${outputPath}`);
    }

    await browser.close();
    return;
  }

  // Three.js loaded successfully
  await page.evaluate((code) => window.sslSetCode(code), sslText);
  await page.waitForTimeout(600);

  await page.evaluate(() => window.sslPresentationMode(true));
  await page.waitForTimeout(200);

  if (multiAngle) {
    const angles = ["iso", "front", "side", "top"];
    const outDir = path.resolve(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    for (const angle of angles) {
      await page.evaluate((name) => window.sslSetCamera(name), angle);
      await page.waitForTimeout(400);
      // Force a render frame
      await page.evaluate(() => {
        if (window._renderer && window._scene && window._camera) {
          window._renderer.render(window._scene, window._camera);
        }
      });
      await page.waitForTimeout(100);

      const canvas = await page.$("canvas");
      const pngPath = path.join(outDir, `${angle}.png`);
      await canvas.screenshot({ path: pngPath, type: "png" });
      console.log(`Rendered: ${pngPath}`);
    }
  } else {
    await page.evaluate(() => window.sslSetCamera("iso"));
    await page.waitForTimeout(400);

    const canvas = await page.$("canvas");
    await canvas.screenshot({ path: path.resolve(outputPath), type: "png" });
    console.log(`Rendered: ${outputPath}`);
  }

  await browser.close();
})();
