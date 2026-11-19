# minds-eye-explorer

Interactive demo of the Mind's Eye reasoning skill: VOXI voxel scenes → 6-angle
depth-ASCII that a text-only LLM can read.

## Run the demo

```bash
cd /Users/robertpaszek/Desktop/Research/spatial-reasoning-dsl/minds-eye-explorer
npm install          # first time only
npm run dev          # serves on http://localhost:5181
```

Open http://localhost:5181 in a browser.

If port 5181 is taken, change it in `vite.config.js`.

## What's inside

Two tabs:

- **Explore** — rotatable 3D voxel viewer + live 6-angle depth-ASCII + token /
  byte stats vs dense voxel dump vs 6× RGB image baseline. Editable VOXI
  textarea re-renders both panels live.
- **Watch it reason ▶** — 8 stepped frames walking through a packing problem.
  Each frame shows Claude's inner monologue, the VOXI code lines added that
  step (diff-highlighted), the updated 3D scene, and the specific depth-ASCII
  view being inspected. Auto-play advances every 2.4s; prev/next/reset controls.

## File map

```
src/
  App.jsx                          — shell + tab switcher
  voxi/parser.js                   — browser VOXI parser (V,B,S,C,K,E,P)
  voxi/mindsEye.js                 — 6-angle raycaster + size stats
  components/VoxelViewer.jsx       — react-three-fiber 3D scene
  components/AsciiReader.jsx       — 6 clickable depth panels
  components/ReasoningTab.jsx      — stepped reasoning frames
  components/ReasoningFlow.jsx     — 5-stage flow card (Explore tab)
  components/CodePanel.jsx         — VOXI source + byte/token stats
  components/WhyItMatters.jsx      — size comparison cards + table
  data/scenes.js                   — 3 example scenes (packing / missing / sphere)
  data/reasoningFrames.js          — 8 reasoning frames for the packing problem
```

## Sources ported from the parent repo

- `voxi-reasoning/minds-eye.js` — the 6-angle raycaster (browser port in `voxi/mindsEye.js`)
- `voxi-reasoning/text-view.js` — VOXI parser (browser port in `voxi/parser.js`)
