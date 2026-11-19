# SSL V3 — Spatial Vocabulary Language

> **Shapes are words. Scenes are sentences. The transformer composes space like it composes meaning.**

---

## 0. Design Philosophy

LLMs store every word as a learned embedding vector. The word "red" → vector in 4096-dim space.
The word "above" → another vector. Through training, the transformer learns how these vectors
compose: "red sphere above blue box" activates spatial reasoning circuits.

**V3 treats geometric primitives the same way.** Each shape, size, color, and relation is a
vocabulary token with its own learned embedding. The transformer doesn't decode numbers into
spatial meaning — it THINKS in spatial tokens natively, the same way it thinks in English tokens.

### Why this works

```
Natural language:    "The"  "cat"  "sat"  "on"  "the"  "mat"
                      ↓      ↓      ↓      ↓      ↓      ↓
                    [vec]  [vec]  [vec]  [vec]  [vec]  [vec]
                              ↓ attention learns composition ↓
                         meaning: cat is on top of mat

Spatial vocabulary:  sphere  large  white  ·  sphere  medium  white  on
                      ↓       ↓      ↓    ↓    ↓       ↓       ↓     ↓
                    [vec]   [vec]  [vec]  [·]  [vec]  [vec]   [vec]  [vec]
                              ↓ attention learns composition ↓
                         meaning: medium white sphere on top of large white sphere
```

### V1 → V2 → V3 evolution

| Version | Format | Tokens for snowman | How LLM processes it |
|---------|--------|-------------------|---------------------|
| V1 | `ball @200 80 /25 #white` | ~40 tokens | Parses keywords + coordinates mixed |
| V2 | `1 200 80 200 25 25 0 8` | ~24 tokens | Counts slot positions, numbers are ambiguous |
| V3 | `sphere m white on` | ~8 tokens | Each token has direct spatial meaning |

---

## 1. Vocabulary

Total: **~75 tokens** — a tiny language where every word is spatial.

### 1.1 Shape Tokens (nouns) — 10 tokens

The things that exist in the scene.

| Token | Meaning | Geometric properties |
|-------|---------|---------------------|
| `box` | Rectangular solid | 6 faces, sharp edges |
| `sphere` | Ball | Continuous curvature, no edges |
| `cylinder` | Tube / pillar | Circular cross-section, 2 caps |
| `cone` | Pointed cylinder | Circular base, apex |
| `pyramid` | Pointed box | Square base, 4 triangular faces |
| `torus` | Ring / donut | Hole in center |
| `line` | Connection / edge | No volume, directional |
| `dot` | Point / marker | No volume, positional |
| `text` | Label | Rendered as string |
| `arc` | Curved line | Partial circle |

### 1.2 Size Tokens (adjectives) — 6 tokens

How big, on a fixed scale. The renderer maps these to unit values.

| Token | Semantic | Suggested units |
|-------|----------|----------------|
| `xs` | Extra small / tiny | 10 |
| `s` | Small | 20 |
| `m` | Medium (default) | 40 |
| `l` | Large | 70 |
| `xl` | Extra large | 110 |
| `xxl` | Massive | 160 |

If omitted, default is `m`.

### 1.3 Proportion Tokens (shape modifiers) — 5 tokens

Modify the aspect ratio. These compose with size.

| Token | Effect | Example |
|-------|--------|---------|
| `tall` | Height = 2.5x width | `box m tall` → tall pillar |
| `wide` | Width = 2.5x height | `box m wide` → flat platform |
| `flat` | Height = 0.15x width | `cylinder l flat` → disc |
| `thin` | Width = 0.3x size | `cylinder m thin` → pole |
| `thick` | Width = 1.5x size | `cylinder m thick` → stout barrel |

### 1.4 Color Tokens (adjectives) — 10 tokens

| Token | Hex | Index |
|-------|-----|-------|
| `black` | #1a1a1a | 0 |
| `red` | #e53935 | 1 |
| `green` | #43a047 | 2 |
| `blue` | #1e88e5 | 3 |
| `cyan` | #00bcd4 | 4 |
| `magenta` | #8e24aa | 5 |
| `yellow` | #fdd835 | 6 |
| `orange` | #fb8c00 | 7 |
| `white` | #ffffff | 8 |
| `gray` | #9e9e9e | 9 |

If omitted, default is `gray`.

### 1.5 Relation Tokens (prepositions) — 12 tokens

How this element relates to its **reference element** (default: previous element).

| Token | Spatial meaning | Axis |
|-------|----------------|------|
| `on` | On top of | +Y |
| `under` | Below | -Y |
| `left` | To the left | -X |
| `right` | To the right | +X |
| `front` | Toward viewer | -Z |
| `back` | Away from viewer | +Z |
| `in` | Inside / centered within | same position |
| `beside` | Next to (same Y level) | +X with gap |
| `across` | Opposite side | -X mirrored |
| `around` | Encircling | same center, larger |
| `between` | Midpoint of two refs | avg position |
| `center` | Scene center (no ref) | absolute |

### 1.6 Distance Tokens (adverbs) — 4 tokens

Modify how close the relation places elements.

| Token | Meaning |
|-------|---------|
| `flush` | Touching, no gap (default) |
| `near` | Small gap (0.25x size) |
| `far` | Large gap (1x size) |
| `offset` | Partial overlap (0.5x into ref) |

### 1.7 Repetition Tokens — 3 tokens

| Token | Meaning | Example |
|-------|---------|---------|
| `xN` | Repeat N times in relation direction | `box s gray on x4` → 4 stacked boxes |
| `ring N` | Repeat N times in a circle | `cone s red ring 8` → 8 cones in ring |
| `row N` | Repeat N times side by side | `box s blue row 3` → 3 boxes in a row |

### 1.8 Reference Token — 1 pattern

| Token | Meaning |
|-------|---------|
| `@N` | Reference element N (0-indexed) |

Default reference is always the previous element. `@N` overrides this.

### 1.9 Structural Tokens — 4 tokens

| Token | Meaning |
|-------|---------|
| `·` | Element separator (newline also works) |
| `>` | Connection arrow between elements |
| `( )` | Group (elements inside share a reference frame) |
| `"text"` | String content for text elements |

---

## 2. Grammar

### 2.1 Element Syntax

```
<element> ::= <shape> [<size>] [<proportion>] [<color>] [<relation> [<distance>] [<ref>]] [<repeat>]
```

**Token order is flexible** — like English adjectives, the transformer learns valid orderings:
- `sphere large white on` ✓
- `sphere white large on` ✓
- `large white sphere on` ✓

The parser recognizes tokens by category, not position. This matches how transformers
process meaning through attention, not through slot position.

### 2.2 Scene Syntax

```
<scene> ::= <element> (<separator> <element>)*
<separator> ::= · | newline
```

### 2.3 Connections

```
<connection> ::= <ref> > <ref> [> <ref>]*
```

Example: `@0 > @2 > @4` — connect element 0 to 2 to 4.

### 2.4 Groups

```
<group> ::= ( <element> [<separator> <element>]* ) [<relation> [<ref>]]
```

Groups share a reference frame. Placing a group with a relation moves all elements together.

---

## 3. Examples — V2 to V3 Translation

### 3.1 Snowman (V2 score: 23/30)

**V2** (13 lines, ~100 tokens):
```
P1
1 200 30 200 35 35 0 8
1 200 80 200 25 25 0 8
1 200 115 200 18 18 0 8
3 200 133 200 5 18 0 7
7 191 120 183 3 3 0 0
7 209 120 183 3 3 0 0
6 165 80 200 235 80 200 0
0 160 76 197 5 3 50 7
0 230 76 197 5 3 50 7
```

**V3** (8 lines, ~30 tokens):
```
sphere l white
sphere m white on
sphere s white on
cone xs orange on front
dot xs black left @2 · dot xs black right @2
dot xs black front @2 row 3
line black left @1 · line black right @1
box xs wide orange left @1 · box xs wide orange right @1
```

### 3.2 Chess Piece / King (V2 score: 24/30)

**V2** (7 lines):
```
P1
2 200 0 200 45 15 0 8
2 200 15 200 35 10 0 8
2 200 25 200 18 65 0 8
2 200 90 200 32 12 0 8
1 200 120 200 25 25 0 8
0 196 145 196 8 30 8 8
0 190 163 190 20 8 20 8
```

**V3** (~20 tokens):
```
cylinder xl flat white
cylinder l flat white on
cylinder m tall white on
cylinder l flat white on
sphere m white on
box xs tall white on
box s flat wide white on
```

### 3.3 Tree (V2 score: 24/30)

**V2** (4 lines):
```
P1
2 200 0 200 12 80 0 7
1 200 70 200 45 45 0 2
1 200 100 200 35 35 0 2
1 200 125 200 25 25 0 2
```

**V3** (~15 tokens):
```
cylinder m thin tall orange
sphere l green on
sphere m green on
sphere s green on
```

### 3.4 Lamp (V2 score: 24/30)

**V2** (4 lines):
```
P1
2 200 0 200 25 8 0 9
2 200 8 200 8 60 0 9
3 200 68 200 35 30 0 6
2 200 68 200 6 32 0 8
```

**V3** (~15 tokens):
```
cylinder l flat gray
cylinder m thin tall gray on
cone l yellow on
cylinder xs thin tall white in @2
```

### 3.5 Rocket Ship (V2 score: 22/30)

**V3** (~25 tokens):
```
cylinder xl tall gray
cone l red on
box s tall red left @0
box s tall red right @0
box s tall red front @0
box s tall red back @0
cone m orange under @0
sphere s yellow in @6
```

### 3.6 Lighthouse (V2 score: 22/30)

**V3** (~30 tokens):
```
cylinder xl tall white
cylinder l gray on
cylinder m red on
cone m red on
sphere s yellow in @3
box xl flat gray under @0
cylinder xl flat gray under @0
line yellow right @4 far
line yellow left @4 far
line yellow front @4 far
line yellow back @4 far
```

### 3.7 Table with Objects (V2 score: 23/30)

**V3** (~35 tokens):
```
box xl flat wide orange
box xs tall orange under left front
box xs tall orange under right front
box xs tall orange under left back
box xs tall orange under right back
cylinder s cyan on @0
sphere s red on @0 right
box m flat wide blue on @0 left
cylinder xs flat white on @0
sphere xs yellow on @0 left back
```

### 3.8 Castle (V2 score: 20/30)

**V3** (~20 tokens):
```
box xl gray
box xl flat gray on
(box s tall gray · cone s red on) on left front
(box s tall gray · cone s red on) on right front
(box s tall gray · cone s red on) on left back
(box s tall gray · cone s red on) on right back
box m tall orange front @0
box l wide gray on @6
pyramid l red on
box s blue front @0
```

---

## 4. Comparison with LLM Internals

### 4.1 Token Embedding Alignment

```
GPT vocabulary (50k tokens):                SSL V3 vocabulary (~75 tokens):
─────────────────────────────               ──────────────────────────────
"sphere" → embedding[26218]                 sphere → embedding[1]
  (polluted: sports, geometry,              (pure: ONLY means "round 3D
   astronomy, figurative...)                 shape" — 100% spatial signal)

"on" → embedding[263]                       on → embedding[42]
  (polluted: "on time", "on fire",          (pure: ONLY means "+Y spatial
   "turned on", "on Monday"...)              placement" — 100% relational)
```

With 75 tokens and dedicated training data, EVERY training example reinforces spatial meaning.
No dilution from non-spatial uses. The embeddings become razor-sharp spatial representations.

### 4.2 Compositionality = Attention Patterns

The transformer learns attention patterns that mirror spatial composition:

```
sphere  m  white  ·  sphere  s  white  on
  ↓                    ↓                ↓
  │                    │                │
  │                    └── attends to → "on" (learns: place above)
  │                    └── attends to → "sphere m white" (learns: ref = prev element)
  └── attends to → nothing before (learns: first element = base)
```

This is identical to how it learns "The cat sat on the mat":
- "sat" attends to "cat" (who did the action)
- "on" attends to "sat" (spatial relation)
- "mat" attends to "on" (where)

### 4.3 Why ~75 Tokens is the Sweet Spot

| Vocabulary size | Embedding quality | Expressiveness | Training data needed |
|----------------|-------------------|----------------|---------------------|
| 10 tokens | Perfect embeddings | Too limited | Very little |
| **75 tokens** | **Sharp, clean** | **Covers 95% of scenes** | **Moderate** |
| 500 tokens | Good embeddings | Redundant tokens | A lot |
| 8192 (DALL-E) | Noisy, needs millions | Covers everything | Enormous |
| 50k (GPT) | Diluted by context | Universal | Internet-scale |

75 tokens is small enough that every embedding becomes highly specialized,
but large enough to describe virtually any 3D scene through composition.

### 4.4 The VQ-VAE Connection

VQ-VAE learns a codebook of ~8192 discrete visual tokens. Each token represents a
learned patch of visual information. SSL V3 is the same idea, but:

1. **Hand-designed, not learned** — each token has clear semantic meaning
2. **Hierarchical** — shapes compose through relations, not through spatial adjacency
3. **Interpretable** — humans can read and write it
4. **Tiny codebook** — 75 tokens vs 8192, enabling sharper embeddings

```
VQ-VAE:   image → encoder → [token_4521, token_887, token_3102, ...] → decoder → image
                              (opaque patches, no semantic meaning)

SSL V3:   prompt → LLM → [sphere, l, white, ·, sphere, m, white, on, ...] → renderer → image
                          (semantic tokens, human readable, composable)
```

---

## 5. Training Data Generation

### 5.1 Parallel Corpus Structure

```
{ "prompt": "a snowman",
  "ssl": "sphere l white · sphere m white on · sphere s white on · cone xs orange on front" }

{ "prompt": "a simple house",
  "ssl": "box l gray · pyramid l wide red on · box s blue front" }

{ "prompt": "a tree",
  "ssl": "cylinder m thin tall orange · sphere l green on · sphere m green on · sphere s green on" }
```

### 5.2 Augmentation

Because relations are relative, the same scene can be described multiple ways:
- `sphere l white · sphere m white on` (bottom-up construction)
- `sphere m white · sphere l white under` (top-down construction)

Both are valid. Training on both teaches the model flexible composition.

### 5.3 Curriculum

1. **Phase 1**: Single elements — `box l red`, `sphere s blue`
2. **Phase 2**: Two-element compositions — `box l gray · sphere s red on`
3. **Phase 3**: Multi-element scenes — full snowman, house, tree
4. **Phase 4**: Complex scenes with groups, repetition, connections

---

## 6. Renderer Requirements

The V3 renderer must resolve relative positions into absolute coordinates:

### 6.1 Resolution Algorithm

```
For each element in sequence:
  1. Map size token → unit value (xs=10, s=20, m=40, l=70, xl=110, xxl=160)
  2. Apply proportion modifier (tall → h*=2.5, flat → h*=0.15, etc.)
  3. If first element or "center": place at scene center
  4. If relation present:
     a. Find reference element (default = previous, or @N)
     b. Compute placement based on relation:
        - "on"    → ref.y + ref.h/2 + self.h/2
        - "under" → ref.y - ref.h/2 - self.h/2
        - "left"  → ref.x - ref.w/2 - self.w/2
        - "right" → ref.x + ref.w/2 + self.w/2
        - "front" → ref.z - ref.d/2 - self.d/2
        - "back"  → ref.z + ref.d/2 + self.d/2
        - "in"    → same center as ref
     c. Apply distance modifier (flush=0, near=+gap, far=+big gap)
  5. Store resolved position
```

### 6.2 Ambiguity as Feature

When the LLM generates `sphere m red right`, the renderer decides the exact gap.
This is intentional — like human language, the DSL specifies **intent**, not pixels.
The renderer interprets, just like a human drawing from a verbal description.

---

## 7. Future Extensions

### 7.1 Learned Size Tokens
Replace fixed size tokens with learned embeddings that encode continuous size distributions.
`sphere [0.73]` where the float maps to a learned size through a small decoder head.

### 7.2 Compound Tokens
Frequently co-occurring patterns could merge into single tokens:
- `sphere m white on` → `snowball` (a compound spatial token)
- `box l gray · pyramid l red on` → `house` (a macro)

This mirrors BPE merging in text tokenizers — common patterns become single tokens.

### 7.3 Scene-Level Tokens
- `indoor` / `outdoor` — set default lighting, ground plane
- `symmetric` — enforce bilateral symmetry
- `organic` / `geometric` — bias shape selection
