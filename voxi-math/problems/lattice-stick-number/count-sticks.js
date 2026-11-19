/**
 * count-sticks.js
 *
 * Counts and validates lattice sticks from a vertex list.
 * Accepts vertex lists as JSON on stdin or as a CLI argument.
 *
 * Usage:
 *   node count-sticks.js '[[0,0,0],[3,0,0],[3,2,0],...]'
 *   echo '[[0,0,0],[3,0,0],...]' | node count-sticks.js
 *
 * Checks:
 *   - Each consecutive pair differs in exactly one coordinate (axis-aligned)
 *   - No zero-length sticks
 *   - Whether the loop closes (first == last vertex)
 *   - Total stick count
 */

import fs from "fs";

// ---------------------------------------------------------------------------
// Parse input
// ---------------------------------------------------------------------------

function parseVertices(input) {
  const trimmed = input.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length < 2) {
      throw new Error("Expected an array of at least 2 vertices");
    }
    for (let i = 0; i < parsed.length; i++) {
      const v = parsed[i];
      if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) {
        throw new Error(`Invalid vertex at index ${i}: ${JSON.stringify(v)}`);
      }
    }
    return parsed;
  } catch (e) {
    console.error(`Parse error: ${e.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function analyzeSticks(vertices) {
  const sticks = [];
  const issues = [];

  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];

    let diffAxis = -1;
    let diffCount = 0;
    for (let j = 0; j < 3; j++) {
      if (a[j] !== b[j]) {
        diffAxis = j;
        diffCount++;
      }
    }

    const axisNames = ["X", "Y", "Z"];
    const length =
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

    if (diffCount === 0) {
      issues.push(`Stick ${i}: zero-length (${a} -> ${b})`);
      sticks.push({
        index: i,
        from: a,
        to: b,
        axis: "?",
        length: 0,
        valid: false,
      });
    } else if (diffCount > 1) {
      issues.push(
        `Stick ${i}: not axis-aligned, differs in ${diffCount} axes (${a} -> ${b})`,
      );
      sticks.push({
        index: i,
        from: a,
        to: b,
        axis: "DIAG",
        length,
        valid: false,
      });
    } else {
      sticks.push({
        index: i,
        from: a,
        to: b,
        axis: axisNames[diffAxis],
        length: Math.abs(a[diffAxis] - b[diffAxis]),
        valid: true,
      });
    }
  }

  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const loopCloses =
    first[0] === last[0] && first[1] === last[1] && first[2] === last[2];

  return {
    vertexCount: vertices.length,
    stickCount: vertices.length - 1,
    validSticks: sticks.filter((s) => s.valid).length,
    loopCloses,
    totalLength: sticks.reduce((sum, s) => sum + s.length, 0),
    sticks,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  let input;

  if (process.argv[2]) {
    input = process.argv[2];
  } else if (!process.stdin.isTTY) {
    input = fs.readFileSync("/dev/stdin", "utf8");
  } else {
    console.error("Usage: node count-sticks.js '[[x,y,z], ...]'");
    console.error("   or: echo '[[x,y,z], ...]' | node count-sticks.js");
    process.exit(1);
  }

  const vertices = parseVertices(input);
  const result = analyzeSticks(vertices);

  console.log("=== Lattice stick analysis ===\n");
  console.log(`Vertices:     ${result.vertexCount}`);
  console.log(`Sticks:       ${result.stickCount}`);
  console.log(`Valid sticks: ${result.validSticks}`);
  console.log(`Loop closes:  ${result.loopCloses}`);
  console.log(`Total length: ${result.totalLength}`);

  console.log("\nStick breakdown:");
  for (const s of result.sticks) {
    const marker = s.valid ? " " : "!";
    console.log(
      `${marker} Stick ${String(s.index).padStart(2)}: (${s.from}) -> (${s.to})  axis=${s.axis}  len=${s.length}`,
    );
  }

  if (result.issues.length > 0) {
    console.log("\nIssues:");
    for (const issue of result.issues) {
      console.log(`  - ${issue}`);
    }
  }

  // Exit code: 0 if all valid + loop closes, 1 otherwise
  const allGood = result.issues.length === 0 && result.loopCloses;
  console.log(
    `\nResult: ${allGood ? "VALID" : "INVALID"} lattice knot with ${result.stickCount} sticks`,
  );
  process.exit(allGood ? 0 : 1);
}

main();
