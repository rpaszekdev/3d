/**
 * SSL (SVG Sketch Language) → SVG Compiler
 *
 * Parses SSL DSL and generates SVG with CSS animations.
 * Lenient parser — skips malformed lines rather than crashing.
 */

// ── AST Node Types ──────────────────────────────────────────────

function createScene(width, height, styles) {
  return { type: "scene", width, height, styles, children: [], animations: [] };
}

function createGroup(name, attrs) {
  return { type: "group", name, attrs, children: [] };
}

function createPrimitive(kind, args, styles) {
  return { type: "primitive", kind, args, styles };
}

function createAnimation(target, property, from, to, opts) {
  return { type: "animate", target, property, from, to, ...opts };
}

function createEntrance(target, entranceType, opts) {
  return { type: "entrance", target, entranceType, ...opts };
}

// ── Parser ──────────────────────────────────────────────────────

function parseStyleAttrs(tokens) {
  const styles = {};
  for (const tok of tokens) {
    const m = tok.match(
      /^(fill|stroke|stroke-width|opacity|dash|rx|ry|size|font|rotate|scale|at|bg|style):(.+)$/,
    );
    if (m) styles[m[1]] = m[2];
  }
  return styles;
}

function parseNumber(s) {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function extractQuotedString(tokens, startIdx) {
  // Find a quoted string that may span multiple tokens
  const joined = tokens.slice(startIdx).join(" ");
  const m = joined.match(/^"([^"]*)"/) || joined.match(/^'([^']*)'/);
  if (m) {
    // Count how many tokens this consumed
    const consumed = m[0].split(/\s+/).length;
    return { value: m[1], consumed };
  }
  return { value: tokens[startIdx], consumed: 1 };
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  // Tokenize — preserve quoted strings
  const tokens = [];
  let remaining = trimmed;
  while (remaining.length > 0) {
    remaining = remaining.trimStart();
    if (remaining.startsWith('"')) {
      const end = remaining.indexOf('"', 1);
      if (end !== -1) {
        tokens.push(remaining.slice(0, end + 1));
        remaining = remaining.slice(end + 1);
      } else {
        tokens.push(remaining);
        remaining = "";
      }
    } else if (remaining.startsWith("'")) {
      const end = remaining.indexOf("'", 1);
      if (end !== -1) {
        tokens.push(remaining.slice(0, end + 1));
        remaining = remaining.slice(end + 1);
      } else {
        tokens.push(remaining);
        remaining = "";
      }
    } else {
      const spaceIdx = remaining.search(/\s/);
      if (spaceIdx === -1) {
        tokens.push(remaining);
        remaining = "";
      } else {
        tokens.push(remaining.slice(0, spaceIdx));
        remaining = remaining.slice(spaceIdx);
      }
    }
  }

  if (tokens.length === 0) return null;

  const cmd = tokens[0].toLowerCase();

  // Expand comma-separated numeric pairs into separate tokens
  // e.g. "-90,-5" → ["-90", "-5"] but leave "at:250,300" untouched
  const expandedTokens = [tokens[0]];
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.includes(":") || tok.startsWith('"') || tok.startsWith("'")) {
      expandedTokens.push(tok);
    } else if (tok.includes(",")) {
      const parts = tok.split(",");
      for (const p of parts) expandedTokens.push(p);
    } else {
      expandedTokens.push(tok);
    }
  }

  // ── Scene ──
  if (cmd === "scene") {
    const dimMatch = tokens.find((t) => /^\d+x\d+$/.test(t));
    let width = 800,
      height = 500;
    if (dimMatch) {
      [width, height] = dimMatch.split("x").map(Number);
    }
    const styles = parseStyleAttrs(tokens.slice(1));
    return { parsed: "scene", width, height, styles };
  }

  // ── Group ──
  if (cmd === "group") {
    const nameToken = tokens[1] || '"unnamed"';
    const name = nameToken.replace(/['"]/g, "");
    const styles = parseStyleAttrs(tokens.slice(2));
    return { parsed: "group", name, attrs: styles };
  }

  // ── End ──
  if (cmd === "end") {
    return { parsed: "end" };
  }

  // For primitives, use expandedTokens (comma-separated values split)
  const et = expandedTokens;

  // ── Primitives ──
  if (cmd === "circle") {
    // circle cx cy r [styles...]
    const cx = parseNumber(et[1]);
    const cy = parseNumber(et[2]);
    const r = parseNumber(et[3]);
    const styles = parseStyleAttrs(tokens.slice(1));
    return { parsed: "primitive", kind: "circle", args: { cx, cy, r }, styles };
  }

  if (cmd === "rect") {
    // rect x y w h [rx:n] [styles...]
    const x = parseNumber(et[1]);
    const y = parseNumber(et[2]);
    const w = parseNumber(et[3]);
    const h = parseNumber(et[4]);
    const styles = parseStyleAttrs(tokens.slice(1));
    return { parsed: "primitive", kind: "rect", args: { x, y, w, h }, styles };
  }

  if (cmd === "ellipse") {
    // ellipse cx cy rx ry
    const cx = parseNumber(et[1]);
    const cy = parseNumber(et[2]);
    const rx = parseNumber(et[3]);
    const ry = parseNumber(et[4]);
    const styles = parseStyleAttrs(tokens.slice(1));
    return {
      parsed: "primitive",
      kind: "ellipse",
      args: { cx, cy, rx, ry },
      styles,
    };
  }

  if (cmd === "line") {
    // line x1 y1 x2 y2
    const x1 = parseNumber(et[1]);
    const y1 = parseNumber(et[2]);
    const x2 = parseNumber(et[3]);
    const y2 = parseNumber(et[4]);
    const styles = parseStyleAttrs(tokens.slice(1));
    return {
      parsed: "primitive",
      kind: "line",
      args: { x1, y1, x2, y2 },
      styles,
    };
  }

  if (cmd === "polyline") {
    // polyline x1,y1 x2,y2 x3,y3 ...
    const points = [];
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.includes(":")) break; // style attr
      const parts = tok.split(",");
      if (parts.length === 2) {
        points.push({ x: parseNumber(parts[0]), y: parseNumber(parts[1]) });
      }
    }
    const styles = parseStyleAttrs(tokens.slice(1));
    return { parsed: "primitive", kind: "polyline", args: { points }, styles };
  }

  if (cmd === "path") {
    // path "M 0,0 Q 10,20 30,0" [styles...]
    const pathToken = tokens.find(
      (t) => t.startsWith('"') || t.startsWith("'"),
    );
    let d = "";
    if (pathToken) {
      // Reconstruct the full path string from tokens
      const joined = tokens.slice(1).join(" ");
      const m = joined.match(/^"([^"]*)"/) || joined.match(/^'([^']*)'/);
      d = m ? m[1] : pathToken.replace(/['"]/g, "");
    }
    const styles = parseStyleAttrs(tokens);
    return { parsed: "primitive", kind: "path", args: { d }, styles };
  }

  if (cmd === "text") {
    // text x y "content" [size:n]
    const x = parseNumber(tokens[1]);
    const y = parseNumber(tokens[2]);
    const joined = tokens.slice(3).join(" ");
    const m = joined.match(/^"([^"]*)"/) || joined.match(/^'([^']*)'/);
    const content = m ? m[1] : tokens[3] || "";
    const styles = parseStyleAttrs(tokens.slice(3));
    return {
      parsed: "primitive",
      kind: "text",
      args: { x, y, content },
      styles,
    };
  }

  if (cmd === "arc") {
    // arc cx cy r start-deg end-deg
    const cx = parseNumber(et[1]);
    const cy = parseNumber(et[2]);
    const r = parseNumber(et[3]);
    const startDeg = parseNumber(et[4]);
    const endDeg = parseNumber(et[5]);
    const styles = parseStyleAttrs(tokens.slice(1));
    return {
      parsed: "primitive",
      kind: "arc",
      args: { cx, cy, r, startDeg, endDeg },
      styles,
    };
  }

  // ── Animate ──
  if (cmd === "animate") {
    // animate <target> <property> <from>-><to> [duration:1s] [loop] [delay:0.5s] [ease:ease-in-out]
    // Also handles combined format: animate <target> <property>:<from>-><to>
    const target = tokens[1] || "";
    let property = tokens[2] || "rotate";
    let from = 0,
      to = 0;
    let restStartIdx = 4;

    // Check if property and range are combined (e.g. "rotate:-2->2")
    if (property.includes("->")) {
      const colonIdx = property.indexOf(":");
      if (colonIdx !== -1) {
        const rangeStr = property.slice(colonIdx + 1);
        property = property.slice(0, colonIdx);
        const rangeParts = rangeStr.split("->");
        if (rangeParts.length === 2) {
          from = parseNumber(rangeParts[0]);
          to = parseNumber(rangeParts[1]);
        }
        restStartIdx = 3;
      }
    } else {
      const rangeToken = tokens[3] || "0->0";
      const rangeParts = rangeToken.split("->");
      if (rangeParts.length === 2) {
        from = parseNumber(rangeParts[0]);
        to = parseNumber(rangeParts[1]);
      }
    }
    const opts = {
      duration: "1s",
      loop: false,
      delay: "0s",
      ease: "ease-in-out",
    };
    for (const tok of tokens.slice(restStartIdx)) {
      if (tok === "loop") opts.loop = true;
      else if (tok.startsWith("duration:")) opts.duration = tok.split(":")[1];
      else if (tok.startsWith("delay:")) opts.delay = tok.split(":")[1];
      else if (tok.startsWith("ease:")) opts.ease = tok.split(":")[1];
    }
    return { parsed: "animate", target, property, from, to, ...opts };
  }

  // ── Entrance ──
  if (cmd === "entrance") {
    // entrance <target> <type> [duration:0.5s] [delay:0s]
    const target = tokens[1] || "";
    const entranceType = tokens[2] || "fade-in";
    const opts = {
      duration: "0.5s",
      delay: "0s",
    };
    for (const tok of tokens.slice(3)) {
      if (tok.startsWith("duration:")) opts.duration = tok.split(":")[1];
      else if (tok.startsWith("delay:")) opts.delay = tok.split(":")[1];
    }
    return { parsed: "entrance", target, entranceType, ...opts };
  }

  // Unknown line — skip
  return null;
}

function buildAST(sslCode) {
  const lines = sslCode.split("\n");
  const scene = createScene(800, 500, {});
  const groupStack = []; // stack for nested groups
  let currentContainer = scene;

  for (const line of lines) {
    // Strip inline comments (but not inside quoted strings)
    const commentIdx = line.indexOf("#");
    const cleanLine =
      commentIdx > 0 && !line.slice(0, commentIdx).includes('"')
        ? line.slice(0, commentIdx)
        : line.startsWith("#")
          ? ""
          : line;

    const result = parseLine(line);
    if (!result) continue;

    switch (result.parsed) {
      case "scene":
        scene.width = result.width;
        scene.height = result.height;
        scene.styles = { ...scene.styles, ...result.styles };
        break;

      case "group": {
        const group = createGroup(result.name, result.attrs);
        currentContainer.children.push(group);
        groupStack.push(currentContainer);
        currentContainer = group;
        break;
      }

      case "end":
        if (groupStack.length > 0) {
          currentContainer = groupStack.pop();
        }
        break;

      case "primitive":
        currentContainer.children.push(
          createPrimitive(result.kind, result.args, result.styles),
        );
        break;

      case "animate":
        scene.animations.push(
          createAnimation(
            result.target,
            result.property,
            result.from,
            result.to,
            {
              duration: result.duration,
              loop: result.loop,
              delay: result.delay,
              ease: result.ease,
            },
          ),
        );
        break;

      case "entrance":
        scene.animations.push(
          createEntrance(result.target, result.entranceType, {
            duration: result.duration,
            delay: result.delay,
          }),
        );
        break;
    }
  }

  return scene;
}

// ── SVG Emitter ─────────────────────────────────────────────────

function styleAttrsToSvg(styles, sceneDefaults) {
  const merged = { ...sceneDefaults, ...styles };
  const parts = [];
  if (merged.fill) parts.push(`fill="${merged.fill}"`);
  if (merged.stroke) parts.push(`stroke="${merged.stroke}"`);
  if (merged["stroke-width"])
    parts.push(`stroke-width="${merged["stroke-width"]}"`);
  if (merged.opacity) parts.push(`opacity="${merged.opacity}"`);
  if (merged.dash) parts.push(`stroke-dasharray="${merged.dash}"`);
  if (merged.rx) parts.push(`rx="${merged.rx}"`);
  if (merged.ry) parts.push(`ry="${merged.ry}"`);
  return parts.join(" ");
}

function arcToPath(cx, cy, r, startDeg, endDeg) {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function emitPrimitive(node, defaults, indent) {
  const pad = "  ".repeat(indent);
  const s = styleAttrsToSvg(node.styles, defaults);

  switch (node.kind) {
    case "circle":
      return `${pad}<circle cx="${node.args.cx}" cy="${node.args.cy}" r="${node.args.r}" ${s}/>`;

    case "rect": {
      return `${pad}<rect x="${node.args.x}" y="${node.args.y}" width="${node.args.w}" height="${node.args.h}" ${s}/>`;
    }

    case "ellipse":
      return `${pad}<ellipse cx="${node.args.cx}" cy="${node.args.cy}" rx="${node.args.rx}" ry="${node.args.ry}" ${s}/>`;

    case "line":
      return `${pad}<line x1="${node.args.x1}" y1="${node.args.y1}" x2="${node.args.x2}" y2="${node.args.y2}" ${s}/>`;

    case "polyline": {
      const pts = node.args.points.map((p) => `${p.x},${p.y}`).join(" ");
      return `${pad}<polyline points="${pts}" ${s}/>`;
    }

    case "path":
      return `${pad}<path d="${node.args.d}" ${s}/>`;

    case "text": {
      const size = node.styles.size || "14";
      const font = node.styles.font || "system-ui, sans-serif";
      return `${pad}<text x="${node.args.x}" y="${node.args.y}" font-size="${size}" font-family="${font}" ${s}>${escapeXml(node.args.content)}</text>`;
    }

    case "arc": {
      const d = arcToPath(
        node.args.cx,
        node.args.cy,
        node.args.r,
        node.args.startDeg,
        node.args.endDeg,
      );
      return `${pad}<path d="${d}" ${s}/>`;
    }

    default:
      return "";
  }
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emitNode(node, defaults, indent) {
  if (node.type === "primitive") {
    return emitPrimitive(node, defaults, indent);
  }

  if (node.type === "group") {
    const pad = "  ".repeat(indent);
    const tx = node.attrs.at ? node.attrs.at.split(",").map(Number) : [0, 0];
    const transforms = [];
    transforms.push(`translate(${tx[0]}, ${tx[1]})`);
    if (node.attrs.rotate) transforms.push(`rotate(${node.attrs.rotate})`);
    if (node.attrs.scale) transforms.push(`scale(${node.attrs.scale})`);

    const lines = [];
    lines.push(
      `${pad}<g id="${sanitizeId(node.name)}" transform="${transforms.join(" ")}">`,
    );
    for (const child of node.children) {
      lines.push(emitNode(child, defaults, indent + 1));
    }
    lines.push(`${pad}</g>`);
    return lines.join("\n");
  }

  return "";
}

function sanitizeId(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function generateAnimationCSS(animations) {
  const cssBlocks = [];
  let keyframeIdx = 0;

  for (const anim of animations) {
    const targetId = sanitizeId(anim.target);

    if (anim.type === "animate") {
      const kfName = `anim-${targetId}-${keyframeIdx++}`;
      let kfBody = "";
      let cssProp = "";

      switch (anim.property) {
        case "rotate":
          kfBody = `  from { transform: rotate(${anim.from}deg); }\n  to { transform: rotate(${anim.to}deg); }`;
          break;
        case "translateX":
          kfBody = `  from { transform: translateX(${anim.from}px); }\n  to { transform: translateX(${anim.to}px); }`;
          break;
        case "translateY":
          kfBody = `  from { transform: translateY(${anim.from}px); }\n  to { transform: translateY(${anim.to}px); }`;
          break;
        case "scale":
          kfBody = `  from { transform: scale(${anim.from}); }\n  to { transform: scale(${anim.to}); }`;
          break;
        case "opacity":
          kfBody = `  from { opacity: ${anim.from}; }\n  to { opacity: ${anim.to}; }`;
          break;
        default:
          kfBody = `  from { transform: rotate(${anim.from}deg); }\n  to { transform: rotate(${anim.to}deg); }`;
      }

      cssBlocks.push(`@keyframes ${kfName} {\n${kfBody}\n}`);

      const iteration = anim.loop ? "infinite" : "1";
      const direction = anim.loop ? "alternate" : "normal";
      cssBlocks.push(
        `#${targetId} {\n  animation: ${kfName} ${anim.duration} ${anim.ease} ${anim.delay} ${iteration} ${direction};\n  transform-box: fill-box;\n  transform-origin: center;\n}`,
      );
    }

    if (anim.type === "entrance") {
      const kfName = `entrance-${targetId}-${keyframeIdx++}`;

      switch (anim.entranceType) {
        case "fade-in":
          cssBlocks.push(
            `@keyframes ${kfName} {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  opacity: 0;\n  animation: ${kfName} ${anim.duration} ease-out ${anim.delay} 1 forwards;\n}`,
          );
          break;

        case "draw-on":
          // draw-on uses stroke-dasharray trick — set via JS in viewer since we need path length
          cssBlocks.push(
            `@keyframes ${kfName} {\n  from { stroke-dashoffset: var(--path-length, 1000); }\n  to { stroke-dashoffset: 0; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  stroke-dasharray: var(--path-length, 1000);\n  stroke-dashoffset: var(--path-length, 1000);\n  animation: ${kfName} ${anim.duration} ease-in-out ${anim.delay} 1 forwards;\n}`,
          );
          break;

        case "slide-left":
          cssBlocks.push(
            `@keyframes ${kfName} {\n  from { transform: translateX(-60px); opacity: 0; }\n  to { transform: translateX(0); opacity: 1; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  opacity: 0;\n  animation: ${kfName} ${anim.duration} ease-out ${anim.delay} 1 forwards;\n}`,
          );
          break;

        case "slide-right":
          cssBlocks.push(
            `@keyframes ${kfName} {\n  from { transform: translateX(60px); opacity: 0; }\n  to { transform: translateX(0); opacity: 1; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  opacity: 0;\n  animation: ${kfName} ${anim.duration} ease-out ${anim.delay} 1 forwards;\n}`,
          );
          break;

        case "slide-up":
          cssBlocks.push(
            `@keyframes ${kfName} {\n  from { transform: translateY(40px); opacity: 0; }\n  to { transform: translateY(0); opacity: 1; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  opacity: 0;\n  animation: ${kfName} ${anim.duration} ease-out ${anim.delay} 1 forwards;\n}`,
          );
          break;

        case "slide-down":
          cssBlocks.push(
            `@keyframes ${kfName} {\n  from { transform: translateY(-40px); opacity: 0; }\n  to { transform: translateY(0); opacity: 1; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  opacity: 0;\n  animation: ${kfName} ${anim.duration} ease-out ${anim.delay} 1 forwards;\n}`,
          );
          break;

        case "pop":
          cssBlocks.push(
            `@keyframes ${kfName} {\n  0% { transform: scale(0); opacity: 0; }\n  70% { transform: scale(1.15); opacity: 1; }\n  100% { transform: scale(1); opacity: 1; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  opacity: 0;\n  transform-box: fill-box;\n  transform-origin: center;\n  animation: ${kfName} ${anim.duration} ease-out ${anim.delay} 1 forwards;\n}`,
          );
          break;

        default:
          // Default to fade-in
          cssBlocks.push(
            `@keyframes ${kfName} {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}`,
          );
          cssBlocks.push(
            `#${targetId} {\n  opacity: 0;\n  animation: ${kfName} ${anim.duration} ease-out ${anim.delay} 1 forwards;\n}`,
          );
      }
    }
  }

  return cssBlocks.join("\n\n");
}

// ── Main Compile Function ───────────────────────────────────────

export function compile(sslCode) {
  const ast = buildAST(sslCode);

  const sceneDefaults = {
    fill: ast.styles.fill || "none",
    stroke: ast.styles.stroke || "#333",
    "stroke-width": ast.styles["stroke-width"] || "2",
  };

  const bg = ast.styles.bg || "#ffffff";

  // Generate animation CSS
  const animCSS = generateAnimationCSS(ast.animations);

  // Build SVG body
  const bodyLines = [];
  for (const child of ast.children) {
    bodyLines.push(emitNode(child, sceneDefaults, 1));
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ast.width} ${ast.height}" width="${ast.width}" height="${ast.height}">
<style>
  svg { background: ${bg}; }
  * { vector-effect: non-scaling-stroke; }
${animCSS}
</style>
${bodyLines.join("\n")}
</svg>`;

  return { svg, ast };
}

/**
 * Extract valid SSL code from LLM output (strip markdown fences, preamble, etc.)
 */
export function extractSSL(raw) {
  const cleaned = raw.replace(/```[\w]*\n?/g, "").replace(/```$/gm, "");
  const lines = cleaned.split("\n");
  const sslLines = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      if (
        /^(scene|group|circle|rect|ellipse|line|polyline|path|text|arc|animate|entrance|#)/.test(
          trimmed,
        )
      ) {
        started = true;
        sslLines.push(line);
      }
    } else {
      if (
        trimmed === "" ||
        trimmed === "end" ||
        /^(scene|group|circle|rect|ellipse|line|polyline|path|text|arc|animate|entrance|end|#)/.test(
          trimmed,
        )
      ) {
        sslLines.push(line);
      } else {
        // Allow style-only lines inside groups (indented)
        if (line.startsWith("  ") || line.startsWith("\t")) {
          sslLines.push(line);
        } else {
          break;
        }
      }
    }
  }

  return sslLines.join("\n").trim();
}
