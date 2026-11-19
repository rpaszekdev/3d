# SVG Sketch Language (SSL) — Design Spec

## Overview

A DSL for generating line-art SVG illustrations with animation support. The LLM composes from geometric primitives (circle, rect, path, line, etc.) grouped semantically, and the compiler handles SVG generation with CSS-based animations.

Architecture follows the voxi-creator pattern: CLI entry → LLM generation → compiler → live preview server.

## DSL Syntax

### Scene Declaration

```
scene <width>x<height> [style:line-art] [stroke:<color>] [stroke-width:<n>] [bg:<color>]
```

Defaults: `stroke:#333 stroke-width:2 fill:none bg:#ffffff`

### Primitives

```
circle cx cy r
rect x y w h [rx:<n>]
ellipse cx cy rx ry
line x1 y1 x2 y2
polyline x1,y1 x2,y2 x3,y3 ...
path "M 0,0 Q 10,20 30,0"
text x y "content" [size:<n>] [font:<name>]
arc cx cy r start-deg end-deg
```

All coordinates are absolute within their group context. Style attributes can be appended to any primitive line.

### Styling

Per-element style overrides (appended to primitive line):
```
fill:<color> stroke:<color> stroke-width:<n> opacity:<n> dash:<pattern>
```

Scene defaults cascade to all elements. Per-element overrides win.

### Grouping

```
group "<name>" [at:<x>,<y>] [rotate:<deg>] [scale:<n>]
  # children — coordinates relative to group origin
end
```

Groups can be nested. The `at:` offset sets the local origin for all children.

### Animation

Continuous property animation:
```
animate <target> <property> <from>-><to> [duration:<t>] [loop] [delay:<t>] [ease:<fn>]
```

Properties: `rotate`, `translateX`, `translateY`, `scale`, `opacity`, `stroke-dashoffset`

One-shot entrance animations:
```
entrance <target> <type> [duration:<t>] [delay:<t>]
```

Types: `fade-in`, `draw-on`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `pop`

`draw-on` uses stroke-dasharray/dashoffset to simulate hand-drawing effect.

### Comments

```
# This is a comment
```

## Architecture

```
svg-creator/
├── create.js          # CLI entry — calls LLM, writes .ssl + .svg
├── llm.js             # Claude CLI wrapper (reuse pattern from voxi-creator)
├── prompts.js         # System prompt with SSL reference + examples
├── compiler.js        # SSL → SVG compiler
├── server.js          # Express server for live preview
├── viewer.html        # Browser preview with animation controls
└── output/            # Generated files per run
    └── <timestamp>_<slug>/
        ├── scene.ssl
        └── scene.svg
```

### Flow

1. User runs `node create.js "five people at desks"`
2. `create.js` calls Claude via `llm.js` with system prompt from `prompts.js`
3. LLM returns SSL code
4. `compiler.js` parses SSL → generates SVG with embedded CSS animations
5. Saves `.ssl` + `.svg` to `output/<timestamp>_<slug>/`
6. `server.js` serves `viewer.html` with the SVG, auto-opens browser

### Compiler Pipeline

1. **Lexer** — splits input into lines, strips comments
2. **Parser** — builds AST: scene config, groups (with children), top-level primitives, animations
3. **Resolver** — applies group `at:` transforms, inherits scene styles
4. **Emitter** — generates SVG:
   - `<svg>` root with viewBox from scene dimensions
   - `<style>` block with CSS keyframes for all animations
   - `<g>` elements for groups with `transform="translate(x,y)"`
   - Primitive elements mapped 1:1 to SVG elements
   - `draw-on` uses `stroke-dasharray` + `stroke-dashoffset` animation

### Animation Strategy

CSS `@keyframes` over SMIL `<animate>`:
- Better browser support
- Controllable via JS (`animation-play-state: paused`)
- Easier speed control (`animation-duration` override)
- Works with the viewer's play/pause/speed controls

### Viewer Features

- Inline SVG display (not `<img>`, so animations work)
- Controls: Play / Pause / Restart / Speed (0.5x, 1x, 2x)
- Background toggle: white / dark / grid
- Auto-reload on file change (polling every 2s)
- SVG download button

### System Prompt

The prompt includes:
- Full SSL syntax reference
- 2-3 worked examples (single figure, multi-object scene, animated scene)
- Coordinate guidance: "Canvas is 800-1200px wide. Standing person ~150px tall."
- Rules: output only SSL, use groups for parts, use comments, no markdown

### LLM Interface

Reuses the `claude -p` pattern from voxi-creator:
- System prompt passed via stdin
- Model: sonnet (fast iteration)
- No tools needed (pure text generation)

## Example SSL

```
# Person sitting at a desk with a monitor
scene 400x350 style:line-art stroke:#333 stroke-width:2

group "desk" at:200,280
  rect -80,0 160,60 rx:3              # desk surface
  line -70,60 -70,100                  # left leg
  line 70,60 70,100                    # right leg
end

group "monitor" at:200,240
  rect -40,-50 80,55 rx:2             # screen
  rect -5,5 10,20                      # stand
  rect -15,25 30,5 rx:2               # base
end

group "person" at:200,200
  circle 0,-60 18                      # head
  line 0,-42 0,0                       # torso
  line -25,30 25,30                    # chair seat line
  path "M 0,-30 Q -20,-15 -35,-25"    # left arm reaching to desk
  path "M 0,-30 Q 20,-15 35,-25"      # right arm reaching to desk
  line -10,0 -15,30                    # left upper leg
  line 10,0 15,30                      # right upper leg
end

animate person.right-arm rotate:-3->3 duration:0.3s loop ease:ease-in-out
animate person.left-arm rotate:3->-3 duration:0.3s loop delay:0.15s ease:ease-in-out
entrance desk draw-on duration:1s
entrance monitor draw-on duration:0.8s delay:0.5s
entrance person fade-in duration:0.6s delay:1s
```

## Non-Goals (for v1)

- No critic/feedback loop — manual iteration
- No component library — LLM draws everything
- No SVG import/editing — generation only
- No complex scene composition (z-ordering, masking, clipping)
