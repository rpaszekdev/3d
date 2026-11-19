#!/usr/bin/env node
/**
 * SSL Preview — compile and ASCII-render an SSL file.
 *
 * Usage:
 *   node preview.js scene.ssl
 *   node preview.js scene.ssl --cols 120
 *   echo "circle 50 50 20" | node preview.js -
 */

import fs from "fs";
import { compile } from "./compiler.js";
import { renderASCII } from "./ascii-renderer.js";

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
const colsArg = args.indexOf("--cols");
const cols = colsArg !== -1 ? parseInt(args[colsArg + 1]) : 100;

let sslCode;

if (!filePath || filePath === "-") {
  // Read from stdin
  sslCode = fs.readFileSync("/dev/stdin", "utf8");
} else {
  sslCode = fs.readFileSync(filePath, "utf8");
}

const { svg, ast } = compile(sslCode);
const ascii = renderASCII(ast, { cols });

console.log(ascii);

// Also output stats
const groups = ast.children.filter((c) => c.type === "group").length;
const prims = ast.children.reduce(
  (n, c) => n + (c.type === "group" ? c.children.length : 1),
  0
);
console.log(
  `\n${ast.width}x${ast.height} | ${groups} groups | ${prims} primitives | ${ast.animations.length} animations`
);
