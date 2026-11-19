# SSL V2.5 — Numeric Relations

> **V2 density + compositional semantics. Still pure numbers. The model learns
> how shapes combine, not just where they are.**

---

## 0. The Problem V2.5 Solves

V2 tells the model WHERE everything is. But it doesn't tell it WHY.

```
V2 snowman:
1 200 30  200 35 35 0 8    ← large white sphere
1 200 80  200 25 25 0 8    ← medium white sphere (Y is higher... but why?)
1 200 115 200 18 18 0 8    ← small white sphere (Y is even higher... pattern?)
```

The model must INFER that element 1 is "on top of" element 0 by comparing Y coordinates.
For simple scenes this works. For complex scenes with 20+ elements at various angles,
the implicit relationships become very hard to learn.

V2.5 makes it explicit:

```
V2.5 snowman:
1 200 30  200 35 35 0 8           ← large white sphere (base)
1 200 80  200 25 25 0 8  10 0    ← medium white sphere, ON (10) element 0
1 200 115 200 18 18 0 8  10 1    ← small white sphere, ON (10) element 1
```

Now the model learns: "code 10 means stacked. When I see 10, Y increases."
The coordinates confirm the relationship. The relation code names it.

---

## 1. Format

### 1.1 Element Line (extended)

```
T  X  Y  Z  W  H  D  C  [R  REF]  [RX RY RZ]

Positions 0-7:   Same as V2 (type, position, size, color)
Position 8:      Relation code (optional, range 10-39)
Position 9:      Reference element index (required if R present)
Positions 10-12: Rotation angles (optional, same as V2)
```

If no relation: line has 8 values (or 11 with rotation) — identical to V2.
If relation present: line has 10 values (or 13 with rotation).

**Backward compatible**: every valid V2 file is also valid V2.5.

### 1.2 Extended Shape Types (10-12)

Types 0-9 are the original primitives. Types 10-12 add curved/organic shapes:

| Type | Name | Format | Description |
|------|------|--------|-------------|
| 10 | WEDGE | `10 X Y Z W1 H D W2 C` | Tapered box: W1=bottom width, W2=top width |
| 11 | SWEEP | `11 X1 Y1 Z1 X2 Y2 Z2 R C` | Curved tube from point 1 to point 2, R=thickness |
| 12 | HULL | `12 X Y Z R1 R2 R3 C` | Ellipsoid blob: R1=X radius, R2=Y radius, R3=Z radius |

#### WEDGE (type 10)
A box that tapers — bottom face is W1 wide, top face is W2 wide.
```
10 X Y Z W1 H D W2 C
```
- W1 = width at Y=0 (bottom)
- W2 = width at Y=H (top)
- D = depth (same top and bottom)
- If W2 < W1: narrows upward (pyramid-like wall)
- If W2 > W1: flares upward (inverted taper)
- If W2 = 0: becomes a triangular prism (ridge roof)

```
Example — tapered tower wall:
10 150 0 150 60 100 40 30 9     ← 60 wide at base, 30 at top
```

#### SWEEP (type 11)
A curved tube/beam connecting two 3D points.
```
11 X1 Y1 Z1 X2 Y2 Z2 R C
```
- (X1,Y1,Z1) = start point
- (X2,Y2,Z2) = end point
- R = radius/thickness of the tube
- The renderer draws a smooth curved path between the points
- For arches: set Y1=Y2=0 and the midpoint rises to form an arc

```
Example — arch:
11 150 0 200 250 0 200 5 9      ← arch from X=150 to X=250, radius 5
```

#### HULL (type 12)
An ellipsoid — a stretched sphere with independent X, Y, Z radii.
```
12 X Y Z RX RY RZ C
```
- (X,Y,Z) = center position
- RX = radius along X axis
- RY = radius along Y axis
- RZ = radius along Z axis
- If RX=RY=RZ: sphere (same as type 1)
- If RY < RX,RZ: flattened disc/pebble
- If RY > RX,RZ: tall egg shape

```
Example — car body shape:
12 200 20 200 60 15 25 9         ← wide, low, medium depth
```

### 1.3 Number Range Channels

The model learns semantic meaning from number magnitude:

```
Range 0-9:       Type codes and Color codes (categorical)
Range 10-39:     Relation codes (NEW — spatial & CSG relationships)
Range 0-400:     Coordinates and Sizes (continuous spatial values)
Range -180-180:  Rotation angles (degrees, optional)
```

Why this works: the model sees a `10` in position 8 and learns "this is a relation
code" just from its magnitude and position. Types are 0-9, relations are 10-39,
coordinates are large numbers. Each range is a semantic channel.

---

## 2. Relation Codes

### 2.1 Spatial Relations (10-19)

| Code | Meaning | Spatial effect | Inverse |
|------|---------|----------------|---------|
| 10 | ON / above | self.Y = ref.top + gap | 11 |
| 11 | UNDER / below | self.Y = ref.bottom - gap | 10 |
| 12 | LEFT | self.X = ref.left - gap | 13 |
| 13 | RIGHT | self.X = ref.right + gap | 12 |
| 14 | FRONT | self.Z = ref.front - gap | 15 |
| 15 | BACK | self.Z = ref.back + gap | 14 |
| 16 | IN / inside | self.center = ref.center | — |
| 17 | BESIDE | self.X = ref.right + large_gap | — |
| 18 | BETWEEN | self.center = midpoint(ref, ref2) | — |
| 19 | AROUND | self.center = ref.center, self.size > ref.size | — |

### 2.2 CSG Operations (20-22)

| Code | Meaning | Effect |
|------|---------|--------|
| 20 | UNION | Merge geometry of self and ref |
| 21 | SUBTRACT | Cut ref's shape out of self |
| 22 | INTERSECT | Keep only overlapping geometry |

These replace the separate `U a b`, `S a b`, `I a b` lines in V2.
Now CSG is part of the element line — the model learns subtraction
as a RELATIONSHIP between shapes, not a separate operation.

### 2.3 Compositional Patterns (30-39)

| Code | Meaning | Effect |
|------|---------|--------|
| 30 | STACK | Place on top, aligned center (like 10 but implies group) |
| 31 | MIRROR | Mirror position across ref's center axis |
| 32 | ORBIT | Place at angle around ref (uses rotation field) |
| 33 | ARRAY | Repeat in direction of previous relation |
| 34 | ATTACH | Surface-attach to ref (sticks to nearest face) |
| 35 | HANG | Like UNDER but from ref's bottom face |
| 36 | WRAP | Surround ref (like AROUND but conform to shape) |

### 2.4 Clone Operator (40)

| Code | Meaning | Parameters |
|------|---------|------------|
| 40 | CLONE | COUNT DX DY DZ |

Appended after the relation code (or after the color if no relation).
Creates COUNT copies of the element, each offset by (DX, DY, DZ) from the previous.

```
Format:  T X Y Z W H D C [R REF] 40 COUNT DX DY DZ
```

The original element is placed at (X, Y, Z). Clone 1 is at (X+DX, Y+DY, Z+DZ).
Clone 2 is at (X+2*DX, Y+2*DY, Z+2*DZ). And so on.

#### Examples

**Fence posts** — 8 posts spaced 15 apart along X:
```
Before (8 lines):
0 100 0 200 3 30 3 7
0 115 0 200 3 30 3 7
0 130 0 200 3 30 3 7
0 145 0 200 3 30 3 7
0 160 0 200 3 30 3 7
0 175 0 200 3 30 3 7
0 190 0 200 3 30 3 7
0 205 0 200 3 30 3 7

After (1 line):
0 100 0 200 3 30 3 7 40 8 15 0 0
```

**Crenellations on a wall** — 6 merlons along X:
```
Before (6 lines):
0 140 60 130 12 15 10 9
0 160 60 130 12 15 10 9
0 180 60 130 12 15 10 9
0 200 60 130 12 15 10 9
0 220 60 130 12 15 10 9
0 240 60 130 12 15 10 9

After (1 line):
0 140 60 130 12 15 10 9 40 6 20 0 0
```

**Stacked discs** — 4 cylinders stacked vertically:
```
Before:
2 200 0  200 20 5 0 8
2 200 8  200 20 5 0 8
2 200 16 200 20 5 0 8
2 200 24 200 20 5 0 8

After:
2 200 0 200 20 5 0 8 40 4 0 8 0
```

**With relation code** — 4 legs UNDER a table:
```
0 135 0 135 10 70 10 7 11 0 40 4 120 0 120
```
This creates 4 boxes at (135,0,135), (255,0,255), (375,0,375), (495,0,495).
Note: for non-linear patterns like table legs at 4 corners, use separate lines.

#### Grid Pattern (two clone lines)

For a 4×3 grid of crenellations, combine two clones:
```
0 140 82 120 10 12 10 8 40 4 20 0 0
0 140 82 230 10 12 10 8 40 4 20 0 0
```
Two lines = 8 merlons (4 on front wall, 4 on back wall).

#### Token Savings

| Scene | Without clone | With clone | Savings |
|-------|-------------|-----------|---------|
| Castle (71 elements) | 71 lines | ~30 lines | 58% |
| Village (120 elements) | 120 lines | ~50 lines | 58% |
| Fence (20 posts) | 20 lines | 1 line | 95% |
| Chess board (32 pieces) | 32 lines | ~10 lines | 69% |

### 2.5 Anchored Composition

When an element has a relation code, its X, Y, Z values become **offsets** instead
of absolute positions. The renderer computes the actual position from the relation.

```
ANCHOR (no relation):     0 200 0 200 100 5 100 7     ← absolute position
RELATIVE (has relation):  2 0 0 0 12 30 0 4 10 0      ← ON element 0, offset (0,0,0)
RELATIVE with offset:     1 20 0 -10 8 8 0 1 10 0     ← ON element 0, offset (20,0,-10)
```

Rules:
- Elements WITHOUT relations: coordinates are absolute (anchors)
- Elements WITH relations: coordinates are offsets from computed position
- Offset (0,0,0): centered on the computed position
- Offset (20,0,0): 20 units to the right of computed center
- Only activates when X,Y,Z are small (within -100..100 range)
- Elements with large coordinates (>100) keep absolute positions for backward compatibility

This lets the LLM focus on STRUCTURE instead of coordinate math:

```
Old V2.5 (absolute coords — LLM must calculate exact positions):
0 200 0 200 100 5 100 7           ← table at 200,0,200
0 205 0 205 10 70 10 7 11 0       ← leg: LLM must compute 205 = 200 + 5
0 285 0 205 10 70 10 7 11 0       ← leg: LLM must compute 285 = 200 + 85

Anchored (offsets — LLM just says "under, corner"):
0 200 0 200 100 5 100 7           ← table at 200,0,200 (anchor)
0 0 0 0 10 70 10 7 11 0           ← leg UNDER table, centered
0 45 0 45 10 70 10 7 11 0         ← leg UNDER table, offset to corner
```

The LLM never has to add 200+85=285. It just says "under, offset 45."

---

## 3. Examples

### 3.1 Snowman

**V2** — relationships are implicit:
```
P1
1 200 30  200 35 35 0 8
1 200 80  200 25 25 0 8
1 200 115 200 18 18 0 8
3 200 133 200 5  18 0 7
7 191 120 183 3  3  0 0
7 209 120 183 3  3  0 0
6 165 80  200 235 80 200 0
0 160 76  197 5  3  50  7
0 230 76  197 5  3  50  7
```

**V2.5** — relationships are explicit:
```
P1
1 200 30  200 35 35 0 8
1 200 80  200 25 25 0 8  10 0
1 200 115 200 18 18 0 8  10 1
3 200 133 200 5  18 0 7  14 2
7 191 120 183 3  3  0 0  12 2
7 209 120 183 3  3  0 0  13 2
6 165 80  200 235 80 200 0  12 1
0 160 76  197 5  3  50  7  34 6
0 230 76  197 5  3  50  7  13 1
```

What the model learns from this:
- Elements 0→1→2: chain of 10 (ON) = stacking pattern = tower/snowman
- Element 3: 14 (FRONT) on 2 = something protruding from the head = nose
- Elements 4,5: 12/13 (LEFT/RIGHT) on 2 = symmetric pair on head = eyes
- Element 6: 12 (LEFT) on 1 = extending from body = arm
- Element 7: 34 (ATTACH) to 6 = attached to arm end = hand

### 3.2 House with Chimney

**V2.5**:
```
P1
0 130 0   130 140 60  140 9
4 200 60  200 170 50  0   1   10 0
0 180 0   115 40  45  15  3   14 0
0 270 60  160 20  40  20  1   10 0
```

What the model learns:
- Element 0: gray box (base/walls)
- Element 1: red pyramid ON (10) element 0 = roof on house
- Element 2: blue box FRONT (14) element 0 = door
- Element 3: red box ON (10) element 0 = chimney on roof

Pattern: `box + pyramid ON = house` — this becomes a learned spatial idiom.

### 3.3 Chess Piece (King)

**V2.5**:
```
P1
2 200 0   200 45 15 0 8
2 200 15  200 35 10 0 8  10 0
2 200 25  200 18 65 0 8  10 1
2 200 90  200 32 12 0 8  10 2
1 200 120 200 25 25 0 8  10 3
0 196 145 196 8  30 8 8  10 4
0 190 163 190 20 8  20 8 10 5
```

What the model learns:
- Pure chain of 10 (ON) codes = vertical stack
- Cylinder→cylinder→cylinder→cylinder→sphere→box→box
- Pattern: "alternating wide-narrow cylinders + sphere cap = chess piece"

### 3.4 Table with Objects

**V2.5**:
```
P1
0 130 70  130 140 6   140 7
0 135 0   135 10  70  10  7   11 0
0 255 0   135 10  70  10  7   11 0
0 135 0   255 10  70  10  7   11 0
0 255 0   255 10  70  10  7   11 0
2 175 76  175 12  30  0   4   10 0
1 230 86  180 10  10  0   1   10 0
0 185 76  235 55  8   35  3   10 0
2 220 76  220 20  3   0   8   10 0
1 160 91  250 6   6   0   6   10 0
```

What the model learns:
- Element 0: wide flat box = tabletop
- Elements 1-4: all code 11 (UNDER) ref 0 = four legs under table
- Elements 5-9: all code 10 (ON) ref 0 = objects on the table
- Pattern: `flat box + 4x UNDER = table`, `objects + ON table = scene`

### 3.5 CSG — Window in Wall

**V2** (requires separate CSG line):
```
P1
0 200 0 200 100 60 10 9
0 220 20 195 20 20 5 3
S 0 1
```

**V2.5** (CSG is inline):
```
P1
0 200 0  200 100 60 10 9
0 220 20 195 20  20 5  3  21 0
```

Element 1 has relation code 21 (SUBTRACT) referencing element 0.
The model learns: "blue box SUBTRACT gray wall = window".

### 3.6 Rocket Ship

**V2.5**:
```
P1
2 200 30  200 45 130 0 9
3 200 160 200 45 55  0 1  10 0
0 158 0   200 10 65  10 1  34 0
0 242 0   200 10 65  10 1  31 2
0 200 0   158 10 65  10 1  34 0
0 200 0   242 10 65  10 1  31 4
3 200 0   200 30 40  0  7  11 0
1 200 5   200 12 12  0  6  16 6
```

What the model learns:
- Element 1: cone ON (10) cylinder = nose cone
- Elements 2-5: ATTACH (34) + MIRROR (31) = symmetric fins
- Element 6: cone UNDER (11) body = exhaust nozzle
- Element 7: sphere IN (16) nozzle = flame

### 3.7 Lighthouse with Light Beams

**V2.5**:
```
P1
2 200 0   200 45 120 0 8
2 200 120 200 38 40  0 9  10 0
2 200 160 200 30 20  0 1  10 1
3 200 180 200 30 25  0 1  10 2
1 200 170 200 12 12  0 6  16 3
0 160 0   160 80 10  80 9  11 0
6 230 170 200 350 170 200 6  13 4
6 170 170 200 50  170 200 6  12 4
6 200 170 230 200 170 350 6  15 4
6 200 170 170 200 170 50  6  14 4
```

What the model learns:
- Elements 0→1→2→3: chain of ON = tower sections getting smaller
- Element 4: sphere IN (16) cone = light inside lamp housing
- Element 5: box UNDER (11) base = foundation
- Elements 6-9: lines LEFT/RIGHT/FRONT/BACK from light = beams radiating

---

## 4. What the Model Learns

### 4.1 Spatial Idioms (emergent from training)

Like how language models learn "kicked the bucket" = died, the spatial model
learns compositional patterns:

```
IDIOM                          PATTERN                         EMERGES FROM
─────                          ───────                         ────────────
Tower/stack                    chain of 10 (ON)                snowman, chess, lighthouse
Table/platform                 flat box + 4× 11 (UNDER)       table, castle battlements
Symmetric pair                 12 (LEFT) + 13 (RIGHT) same ref  eyes, arms, fins
Containment                    16 (IN) + smaller size          light in lamp, flame in rocket
Window/hole                    21 (SUBTRACT)                   windows, doorways, cutouts
Roof                           pyramid/cone 10 (ON) box        house, castle tower
Canopy/shade                   cone/box 10 (ON) thin cylinder  lamp, umbrella, mushroom
Base/foundation                flat box 11 (UNDER)             lighthouse, statue
```

### 4.2 Why This Works with Transformer Attention

```
Element line:     1  200  80  200  25  25  0  8  10  0
                  ↓                              ↓   ↓
                  shape                          rel  ref
                  │                              │    │
                  └─── self-attention ───────────┘    │
                       "what am I?"                    │
                                                       │
                  └─── cross-attention ────────────────┘
                       "what am I related to?"

The attention mechanism naturally learns:
- Tokens 0-7: "what this element IS" (shape, position, size, color)
- Token 8:    "how this element RELATES" (spatial relationship)
- Token 9:    "what this element relates TO" (reference)
```

This mirrors how attention works in language:
- Subject tokens: what the entity IS
- Verb tokens: what ACTION connects entities
- Object reference: what it connects TO

### 4.3 Information Theory Comparison

```
V2:   8 values per element = shape + position + size + color
      Implicit relationships (must be inferred from coordinates)
      Information: WHAT + WHERE

V2.5: 10 values per element = shape + position + size + color + relation + reference
      Explicit relationships (directly encoded)
      Information: WHAT + WHERE + WHY + TO WHAT

V3:   4-6 tokens per element = shape + size + color + relation
      No coordinates (renderer decides)
      Information: WHAT + HOW RELATED (but loses WHERE)
```

V2.5 is strictly more informative than both V2 and V3:
- It keeps V2's exact coordinates (O(n²) implicit relations preserved)
- It adds V3's explicit relations (compositional semantics)
- It adds only 2 numbers per element (minimal token cost)

### 4.4 Token Cost

```
V2 snowman:   9 lines × ~8 tokens = ~72 tokens
V2.5 snowman: 9 lines × ~10 tokens = ~90 tokens (+25%)
V3 snowman:   8 lines × ~4 tokens = ~32 tokens (but loses coordinate precision)
```

The +25% cost buys EXPLICIT compositional semantics. The model no longer
has to infer relationships from coordinate math — it sees them directly.

---

## 5. Backward Compatibility

V2.5 is a strict superset of V2:

- Every V2 file parses correctly (relations default to "none")
- The parser checks: if position 8 is in range 10-39, treat as relation code
- If position 8 is >= 100, treat as rotation angle (existing V2 behavior)
- Gradual adoption: add relations to some elements, not all

### 5.1 Parser Extension

```javascript
// After parsing positions 0-7 (type, x, y, z, w, h, d, color):
if (nums.length >= 10 && nums[8] >= 10 && nums[8] <= 39) {
  el._relation = nums[8];
  el._ref = nums[9];
  // Rotation starts at position 10 if present
  if (nums.length >= 13) {
    el._rotX = nums[10]; el._rotY = nums[11]; el._rotZ = nums[12];
  }
} else if (nums.length >= 11) {
  // Original V2: rotation at positions 8-10
  el._rotX = nums[8]; el._rotY = nums[9]; el._rotZ = nums[10];
}
```

---

## 6. Training Strategy

### 6.1 Phase 1: Teach relations on simple scenes
```
Training pair:
  prompt: "sphere on top of box"
  ssl: "0 200 0 200 50 50 50 3\n1 200 50 200 20 20 0 1 10 0"
  
The model sees: sphere has code 10 (ON) referencing the box.
After thousands of examples, code 10 = "Y increases, centered above ref"
```

### 6.2 Phase 2: Compositional patterns
```
Training pairs:
  prompt: "a snowman"     → 3 spheres chained with 10 (ON), decreasing size
  prompt: "a table"       → flat box + 4 boxes with 11 (UNDER)
  prompt: "a house"       → box + pyramid with 10 (ON) + small box with 14 (FRONT)
  
The model learns: "snowman" = ON-chain of spheres. "table" = UNDER-pattern. "house" = ON-pattern with pyramid.
```

### 6.3 Phase 3: Complex scenes with mixed relations
```
  prompt: "a castle"      → box + towers at corners (34 ATTACH) + cones ON towers
  prompt: "a robot"       → box body + sphere ON + cylinders LEFT/RIGHT + boxes UNDER
```

### 6.4 What Emerges

After training, the model doesn't just memorize scenes — it learns a
**spatial grammar** expressed in numbers:

- "10 chains" = vertical stacking (towers, snowmen, lamps)
- "11 patterns" = supports (legs, pillars, foundations)
- "12+13 pairs" = bilateral symmetry (arms, eyes, fins)
- "14+15 pairs" = front-back features (doors, tails)
- "16" = containment (lights, decorations, embedded features)
- "21" = subtraction (windows, doorways, cutouts)
- "31" = mirror symmetry (duplicated features)

This is a numeric spatial grammar — the same way GPT learns that
"determiner + adjective + noun" is a valid English pattern,
the model learns "box + pyramid ON = house" as a valid spatial pattern.
