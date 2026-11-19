# Pretext Library — Full Documentation

> @chenglou/pretext — DOM-free text measurement and layout engine
> By Cheng Lou (React core, ReasonML, Midjourney)
> npm: `npm install @chenglou/pretext`
> GitHub: github.com/chenglou/pretext
> Demos: chenglou.me/pretext/
> Community: pretext.cool / pretextjs.dev / pretext.wiki

## What It Does

Pure JavaScript/TypeScript text layout engine. Measures text without DOM access.
Uses Canvas `measureText()` for glyph widths, then pure arithmetic for line-breaking.
**300-600x faster** than DOM-based measurement (getBoundingClientRect, offsetHeight).

### Two-Phase Architecture
1. **`prepare()`** — Segments text, measures glyphs via Canvas, caches results
2. **`layout()`** — Calculates height/lineCount using pure arithmetic (no DOM)

### Rendering
Pretext does NOT render. It calculates layout positions. You render with:
- **Canvas**: `ctx.fillText(line.text, x, y)`
- **SVG**: Position text elements manually
- **DOM**: Place styled elements using calculated positions
- **WebGL**: Custom text rendering pipeline

---

## Core API

### Basic — Paragraph Height

```typescript
import { prepare, layout } from '@chenglou/pretext'

const prepared = prepare(text, fontSpec, options?)
const { height, lineCount } = layout(prepared, maxWidth, lineHeight)
```

**`prepare(text, fontSpec, options?)`**
- `text` (string): Content to measure
- `fontSpec` (string): CSS font declaration (e.g., `'16px Inter'`)
- `options?`: `{ whiteSpace: 'normal'|'pre-wrap', wordBreak: 'normal'|'keep-all' }`
- Returns: opaque `PreparedText` handle

**`layout(prepared, maxWidth, lineHeight)`**
- `maxWidth` (number): Container width in pixels
- `lineHeight` (number): Line height in pixels
- Returns: `{ height: number, lineCount: number }`

### Advanced — Line-by-Line Layout

```typescript
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const prepared = prepareWithSegments(text, '18px Helvetica')
const { lines } = layoutWithLines(prepared, 320, 26)
for (const line of lines) {
  ctx.fillText(line.text, 0, y)
  y += lineHeight
}
```

**`prepareWithSegments(text, fontSpec, options?)`**
- Enhanced version returning `PreparedTextWithSegments`
- Provides detailed segment data for custom rendering

**`layoutWithLines(prepared, maxWidth, lineHeight)`**
- Returns `{ lines, height, lineCount }`
- Each line includes text and positioning data

### Variable-Width Layout (Text Around Shapes)

```typescript
import { layoutNextLineRange, materializeLineRange } from '@chenglou/pretext'

let cursor = 0
let y = 0
while (cursor < prepared.length) {
  // Width can change per line — enables text flow around obstacles
  const currentWidth = calculateWidthAtY(y, obstacleRect)
  const range = layoutNextLineRange(prepared, cursor, currentWidth)
  const lineText = materializeLineRange(prepared, range)
  ctx.fillText(lineText, x, y)
  cursor = range.end
  y += lineHeight
}
```

**`layoutNextLineRange(prepared, cursor, maxWidth)`**
- Calculates ONE line at a time
- Width can vary per line (key for obstacle-aware layout)
- Returns range object with start/end positions

**`materializeLineRange(prepared, range)`**
- Converts range back to text string for rendering

### Iterator Pattern (Memory-Efficient)

```typescript
import { walkLineRanges } from '@chenglou/pretext'

walkLineRanges(prepared, maxWidth, (lineRange) => {
  // Process each line without building strings
})
```

### Utility Functions

- **`clearCache()`** — Release accumulated font/variant caches
- **`setLocale(locale?)`** — Configure locale for text segmentation
- **`measureLineStats()`** — Get line count and max width without allocations
- **`measureNaturalWidth()`** — Returns widest line when width unconstrained

---

## Rich Inline Text

Module: `@chenglou/pretext/rich-inline`

```typescript
import { prepareRichInline, walkRichInlineLineRanges } from '@chenglou/pretext/rich-inline'

const items = [
  { text: 'Hello ', font: '16px Inter' },
  { text: 'world', font: '16px Inter bold' },
  // Chips/mentions: atomic pills that stay whole
]

const prepared = prepareRichInline(items)
walkRichInlineLineRanges(prepared, maxWidth, (line) => {
  // Each line may contain mixed fonts, code spans, links, chips
})
```

**`prepareRichInline(items)`**
- `items`: array of `{ text, font, break?, extraWidth? }`
- `break` — soft hyphen behavior
- `extraWidth` — for chips/mentions that take space but aren't text

---

## Official Demos (chenglou.me/pretext/)

1. **Accordion** — Expand/collapse with Pretext height calculation
2. **Bubbles** — Tight multiline chat bubbles, less wasted area
3. **Dynamic Layout** — Fixed-height editorial spread with OBSTACLE-AWARE title routing and continuous flow
4. **Variable Typographic ASCII** — Particle-driven ASCII art with proportional glyphs
5. **Editorial Engine** — Animated orbs, live text reflow, pull quotes, multi-column flow
6. **Justification Comparison** — CSS vs greedy vs Knuth-Plass paragraph layout
7. **Rich Text** — Mixed fonts, code spans, links, chips inline
8. **Markdown Chat** — Virtualized chat with marked + rich-inline
9. **Masonry** — Text-card occlusion with height prediction

## Community Demos (pretext.cool)

18+ demos including: Tetris, Breakout, Bad Apple ASCII, Dragon Text Flow, Star Wars Crawl, illustrated manuscripts, explosive text effects.

---

## Key Capability: Obstacle-Aware Text Flow

The `layoutNextLineRange()` function enables text to flow AROUND arbitrary shapes:

```
┌─────────────────────────────┐
│ Text flows normally here    │
│ across the full width of    │
│ the contai ┌──────┐ ner    │
│ but when   │ 3D   │ an     │
│ obstacle   │ OBJ  │ is     │
│ present    └──────┘ the    │
│ width narrows per line      │
│ and text wraps around it    │
│ then resumes full width     │
└─────────────────────────────┘
```

How it works:
1. For each line, calculate available width (full width minus obstacle overlap at that Y)
2. Call `layoutNextLineRange(prepared, cursor, thatWidth)`
3. Render the line at the correct X offset
4. The 3D object is rendered SEPARATELY (Three.js, Canvas, etc.)
5. Pretext just handles the text — the 3D rendering is independent

---

## Important Notes

- Font spec must match CSS exactly: `'16px Inter'`, `'18px "Helvetica Neue"'`
- `system-ui` unreliable on macOS — use named fonts
- Line height is separate from font preparation (parameter to layout, not prepare)
- Cache accumulates across prepare() calls — call clearCache() if memory is an issue
- 15KB package size, zero dependencies
- Full multilingual: CJK, Arabic, Hebrew, Thai, Hindi, Korean, emoji
- Uses `Intl.Segmenter` for correct Unicode segmentation

---

## For ART-CHAT Integration

Pretext handles: text layout, line-breaking, height calculation, obstacle-aware flow
Three.js handles: 3D voxel rendering (InstancedMesh, WebGL)

Architecture:
- Parse response into text blocks + voxi-anim blocks
- For each voxi-anim block: create Three.js canvas at that Y position
- For text blocks: use layoutNextLineRange() with variable width to flow AROUND the 3D canvas
- Text literally wraps around the 3D animation viewport
- Both render at 60fps — Pretext relayout is pure arithmetic, no jank
