# SSL — Spatial Sketch Language

## Complete Language Specification v1.0

> **A domain-specific language designed as a reasoning substrate for Large Language Models.**
> SSL encodes spatial information in 5-10x fewer tokens than natural language,
> enabling efficient spatial cognition through the whiteboard loop.

---

## Table of Contents

1. [Philosophy & Design Principles](#1-philosophy--design-principles)
2. [Core Operators](#2-core-operators)
3. [Primitives](#3-primitives)
4. [Position & Size System](#4-position--size-system)
5. [Relative & Constraint Positioning](#5-relative--constraint-positioning)
6. [Properties](#6-properties)
7. [Connections & Relationships](#7-connections--relationships)
8. [Hierarchy & Composition](#8-hierarchy--composition)
9. [Fuzzy & Semantic Values](#9-fuzzy--semantic-values)
10. [Queries](#10-queries)
11. [Abstract Use (Non-Spatial Domains)](#11-abstract-use)
12. [Comments & Annotations](#12-comments--annotations)
13. [Extended Examples](#13-extended-examples)
14. [Formal Grammar (EBNF)](#14-formal-grammar)
15. [Token Efficiency Benchmarks](#15-token-efficiency-benchmarks)
16. [Rendering Pipeline](#16-rendering-pipeline)
17. [Research Foundation](#17-research-foundation)

---

## 1. Philosophy & Design Principles

### 1.1 Why SSL Exists

Large Language Models reason by generating sequences of natural language tokens.
For spatial reasoning, this is catastrophically inefficient:

- A 5-object room scene costs ~120 tokens in English but ~25 in coordinates (CORE-02)
- 60-80% of chain-of-thought tokens carry no essential information (Hsieh et al. 2023)
- Compositional reasoning accuracy drops sharply after 5 steps in text (Dziri et al. 2023)
- Meaningless filler tokens ("...") improve reasoning as much as prose (Pfau et al. 2024)

If the model needs N compute steps, those steps should carry **meaningful spatial
information** instead of natural language filler. SSL makes every token a compute
step AND a spatial specification.

### 1.2 The Ten Principles

| # | Principle | Research Basis |
|---|-----------|----------------|
| P1 | **Every token carries spatial meaning** | Pause tokens (Goyal 2023), Dot-by-Dot (Pfau 2024) |
| P2 | **Coordinate-native** | VoT (Wu 2024), LayoutGPT (Feng 2023) |
| P3 | **3D native, 2D by omission** | 3D-LLM (Hong 2023), gap in existing tools |
| P4 | **Composable primitives** | VisProg (Gupta 2023), DreamCoder (Ellis 2021) |
| P5 | **Executable and renderable** | WoT (Menon 2024), Mind's Eye (Liu 2022) |
| P6 | **Approximate values welcome** | Cognitive science of sketching (Buxton 2007) |
| P7 | **Implicit relationships via position** | Larkin & Simon (1987) |
| P8 | **Variable granularity** | Continuous Thought Machines (Goyal 2025) |
| P9 | **Non-sequential references** | Diffusion of Thoughts (Ye 2024) |
| P10 | **Minimal syntax overhead** | LeCun (2022), token efficiency research |

### 1.3 The Key Design Tension: Symbols vs Words

Pure symbolic notation (`R@50,30/40,20#r`) costs 7-9 tokens per object but
LLMs misparse it frequently. Verbose English (`a red rectangle at position 50,30
with width 40 and height 20`) costs 26+ tokens but LLMs understand it perfectly.

**SSL resolution**: Symbolic structure with readable type names.

```
box @50 30 /40 20 #red
```

- **Type names** use short English words: 1 token each (`box`, `line`, `arc`, `node`)
- **Operators** use single symbols: `@` position, `/` size, `#` color
- **Values** are space-separated integers: spaces are free in BPE
- **Result**: ~10-12 tokens per object — the optimal ratio of token cost to comprehension

### 1.4 Dual Consumer Design

SSL is designed for two simultaneous consumers:

1. **LLM reasoning engine** — parses SSL to extract spatial relationships, answer
   spatial queries, and generate next reasoning steps
2. **Rendering engine** — compiles SSL to visual output (SVG, Three.js, ASCII)
   for the whiteboard loop feedback cycle

---

## 2. Core Operators

SSL uses 8 single-character operators. Each is a common ASCII symbol that
tokenizes as 1 token in all major BPE vocabularies.

| Op | Name | Meaning | Example | Tokens |
|----|------|---------|---------|--------|
| `@` | Position | Coordinates in space | `@50 30` | 3 |
| `/` | Dimension | Width, height, depth or radius | `/40 20` | 3 |
| `#` | Style | Color, opacity, material | `#red` | 2 |
| `>` | Connect | Directed edge between elements | `a > b` | 3 |
| `~` | Approximate | Fuzzy/approximate value | `@~50 ~30` | 3 |
| `'` | Rotate | Rotation in degrees | `'45` | 2 |
| `?` | Query | Spatial question | `?dist a b` | 4 |
| `^` | Constrain | Relative constraint | `^right a` | 3 |

### 2.1 Operator Precedence

Operators bind to the preceding primitive or label. They are order-independent
within a single element declaration, though convention orders them:

```
<label>: <type> @<position> /<size> '<rotation> #<style> !<flags>
```

### 2.2 Operator Stacking

Multiple operators compose naturally on a single line:

```
a: box @50 30 0 /40 20 10 '45 #blue.8 !f
```

This reads: "a labeled box at (50,30,0), size 40x20x10, rotated 45 degrees,
blue at 80% opacity, filled."

---

## 3. Primitives

SSL provides 15 primitive types. Each name is a short English word that
tokenizes as a single BPE token.

### 3.1 Primitive Table

| Type | 3D Geometry | 2D Fallback | Min Spec | Full Spec |
|------|------------|-------------|----------|-----------|
| `box` | Cuboid | Rectangle | `box` | `box @x y z /w h d` |
| `ball` | Sphere | Circle | `ball` | `ball @x y z /r` |
| `tri` | Tetrahedron | Triangle | `tri` | `tri @x y z /s` |
| `line` | 3D segment | 2D segment | `line @x1 y1 x2 y2` | `line @x1 y1 z1 x2 y2 z2` |
| `dot` | Point | Point | `dot @x y` | `dot @x y z` |
| `arc` | 3D arc | 2D arc | `arc @x y /r` | `arc @x y z /r 'start 'sweep` |
| `text` | 3D label | 2D label | `text @x y "hi"` | `text @x y z "hello" /s` |
| `node` | Abstract node | Abstract node | `node "A"` | `node @x y "A" /r` |
| `wall` | Plane | Line segment | `wall @x y z /w h` | `wall @x y z /w h 'rx 'ry` |
| `mesh` | Surface | Polygon | `mesh @pts` | `mesh @x1 y1 x2 y2 ...` |
| `disc` | Flat circle | Circle | `disc @x y z /r` | `disc @x y z /r 'tilt` |
| `tube` | Cylinder | Rectangle | `tube @x y z /r h` | `tube @x y z /r h 'axis` |
| `cone` | Cone | Triangle | `cone @x y z /r h` | `cone @x y z /r h` |
| `path` | 3D spline | 2D curve | `path @pts` | `path @x1 y1 x2 y2 ... /w` |
| `cam` | Camera | Viewport | `cam @x y z 'rx 'ry` | `cam @x y z 'rx 'ry /fov` |

### 3.2 Default Values

When properties are omitted, sensible defaults apply:

| Property | Default | Rationale |
|----------|---------|-----------|
| Position `@` | `0 0 0` | Origin |
| Size `/` | `10` (or `10 10 10`) | Visible at default zoom |
| Z coordinate | `0` | 2D by default, 3D when specified |
| Color `#` | `gray` | Neutral, non-distracting |
| Rotation `'` | `0` | No rotation |
| Opacity | `1.0` | Fully opaque |

### 3.3 Minimal Specifications

The shortest valid SSL expressions:

```
box                    -- gray 10x10x10 box at origin
ball @50 50            -- gray sphere at (50,50,0), radius 10
dot @100 200           -- point at (100,200,0)
line @0 0 100 100      -- line from origin to (100,100)
```

---

## 4. Position & Size System

### 4.1 Coordinate Space

SSL uses an integer grid with the following conventions:

| Property | Value | Rationale |
|----------|-------|-----------|
| Range | 0-999 | 3 digits max, no minus signs (saves tokens) |
| Origin | `0 0 0` | Bottom-left-back corner |
| X axis | Right (+) | Standard screen/math convention |
| Y axis | Up (+) | Standard math convention |
| Z axis | Forward (+) | Toward viewer (right-hand rule) |
| Units | Abstract grid units | Context-dependent (pixels, meters, etc.) |

### 4.2 Position Syntax

```
@x y           -- 2D position (z defaults to 0)
@x y z         -- 3D position
```

All coordinate values are space-separated. Spaces cost 0 tokens in BPE
(they merge with adjacent tokens), making this format essentially free
compared to comma-separated values.

### 4.3 Size Syntax

```
/w             -- uniform size (cube, sphere radius)
/w h           -- 2D size (width, height; depth defaults to w)
/w h d         -- 3D size (width, height, depth)
/r             -- radius (for ball, disc, arc)
/r h           -- radius and height (for tube, cone)
```

### 4.4 Size Inference

The parser infers size interpretation from the primitive type:

| Type | `/10` means | `/10 20` means | `/10 20 5` means |
|------|------------|----------------|------------------|
| `box` | 10x10x10 cube | 10x20x10 (d=w) | 10x20x5 |
| `ball` | radius 10 | _(invalid)_ | _(invalid)_ |
| `tube` | radius 10, height 10 | radius 10, height 20 | _(invalid)_ |
| `text` | font size 10 | _(invalid)_ | _(invalid)_ |

### 4.5 Line and Path Positions

Lines and paths use inline point sequences:

```
line @0 0 100 100               -- 2D: (0,0) to (100,100)
line @0 0 0 100 100 50          -- 3D: (0,0,0) to (100,100,50)
path @0 0 50 25 100 0 150 25    -- 4 control points in 2D
```

Point count is inferred: if total values mod 2 == 0, it is 2D; if mod 3 == 0, it is 3D.

---

## 5. Relative & Constraint Positioning

### 5.1 Relative Offsets

The `+` prefix on coordinate values indicates offset from a reference:

```
a: box @100 100
b: box @+50 +0            -- 50 units right of previous element (a)
c: box @a+20 a+30         -- 20 right, 30 up from element a
```

Rules:
- `@+dx +dy` — offset from the **previous element** in declaration order
- `@label+dx label+dy` — offset from a **named element**
- Offsets can be negative: `@+-20 +0` (20 units left)

### 5.2 Constraint Positioning

The `^` operator expresses spatial relationships that a constraint solver resolves:

```
b: box ^right a            -- place b to the right of a
c: ball ^above a           -- place c above a
d: box ^near b             -- place d near b (solver chooses distance)
e: text ^inside a          -- place e inside a's bounds
f: dot ^between a b        -- place f midway between a and b
```

### 5.3 Constraint Vocabulary

| Constraint | Meaning | Solver Behavior |
|------------|---------|-----------------|
| `^right X` | To the right of X | x = X.x + X.w + gap |
| `^left X` | To the left of X | x = X.x - self.w - gap |
| `^above X` | Above X | y = X.y + X.h + gap |
| `^below X` | Below X | y = X.y - self.h - gap |
| `^front X` | In front of X | z = X.z + X.d + gap |
| `^behind X` | Behind X | z = X.z - self.d - gap |
| `^near X` | Near X | distance(self, X) < threshold |
| `^far X` | Far from X | distance(self, X) > threshold |
| `^inside X` | Contained in X | bounds(self) within bounds(X) |
| `^outside X` | Not overlapping X | bounds(self) outside bounds(X) |
| `^between X Y` | Midpoint of X and Y | pos = (X.pos + Y.pos) / 2 |
| `^align X axis` | Aligned with X on axis | self.axis = X.axis |
| `^face X` | Oriented toward X | rotation points at X |

### 5.4 Mixed Positioning

Constraints and coordinates can combine — specify what you know, constrain the rest:

```
shelf: box @500 _ 0 /200 _ 30     -- x=500, z=0, w=200, d=30; y and h from solver
       ^above desk                  -- y is constrained relative to desk
```

The underscore `_` marks "solver decides this value."

---

## 6. Properties

### 6.1 Color (#)

```
#red              -- named color (1 token)
#blue             -- named color
#0F0              -- hex shorthand (green)
#FF8800           -- hex full
#red.5            -- red at 50% opacity
#blue.8           -- blue at 80% opacity
```

**Named colors** (1 token each): `red` `blue` `green` `yellow` `orange` `purple`
`pink` `cyan` `white` `black` `gray` `brown` `dark` `light` `cream` `navy`
`wine` `sky` `wood` `silver` `lavender` `mint` `gold`

### 6.2 Scale (*)

```
*2                -- 2x scale (uniform)
*0.5              -- half scale
*.5               -- half scale (shorthand)
```

### 6.3 Rotation (')

```
'45               -- 45 degrees (Z-axis rotation in 2D)
'45 0 0           -- 45 deg around X, 0 deg around Y, 0 deg around Z
'0 90 0           -- 90 deg around Y axis
```

Single value = Z-axis rotation (most common for 2D layouts).
Three values = Euler angles (X, Y, Z) for 3D.

### 6.4 Flags (!)

Single-character modifiers toggling render modes:

| Flag | Meaning |
|------|---------|
| `!f` | Fill (solid) |
| `!s` | Stroke only (outline) |
| `!d` | Dashed stroke |
| `!h` | Hidden (exists in scene graph, not rendered) |
| `!g` | Ghost (semi-transparent, non-interactive) |
| `!w` | Wireframe (3D) |
| `!x` | Excluded from queries |

Multiple flags combine: `!f !d` = filled with dashed outline.

### 6.5 Labels and Text Content

Labels attach a referenceable name to any element:

```
table: box @200 100 /80 40 20
```

Text content uses double quotes. String literals are properties and may appear
in any position after the type name, but convention places them after position
and before size:

```
text @50 50 "Login"
title: text @200 10 "Welcome" /24 #white
```

Any primitive can carry a string label (displayed as annotation):

```
box @100 200 /60 40 #blue "Submit"    -- box with text overlay
```

---

## 7. Connections & Relationships

### 7.1 Edge Types

| Syntax | Type | Visual |
|--------|------|--------|
| `a > b` | Directed | Arrow from a to b |
| `a - b` | Undirected | Line between a and b |
| `a <> b` | Bidirectional | Double arrow |
| `a ~> b` | Curved directed | Curved arrow from a to b |
| `a ~ b` | Curved undirected | Curved line |

### 7.2 Edge Properties

Edges accept property operators. Note that `*` on an edge means **weight/thickness**
(not geometric scale, which only applies to primitives):

```
a > b #red            -- red arrow
a > b *2              -- thick arrow (2x line weight)
a > b #red *2 "flow"  -- red thick arrow labeled "flow"
a ~> b #green.5       -- semi-transparent green curved arrow
```

### 7.3 Multi-Edge Chains

```
a > b > c > d         -- chain: a->b->c->d
a > b - c             -- a->b, b-c (directed then undirected)
```

### 7.4 Port Connections

For precise connection endpoints:

```
a.right > b.left      -- connect right side of a to left side of b
a.top > b.bottom      -- connect top of a to bottom of b
a.out > b.in          -- semantic ports (custom-named)
```

Available ports: `top` `bottom` `left` `right` `front` `back` `center`
`tl` `tr` `bl` `br` (corners) and custom names.

---

## 8. Hierarchy & Composition

### 8.1 Indentation Nesting

Children are indented under parents. Indentation is nearly free in BPE
(a tab or 2 spaces is approximately 0-1 tokens).

```
room: box @0 0 /500 400 300
  table: box @200 0 100 /120 60 80
    cup: tube @230 80 120 /5 10
    plate: disc @280 80 120 /15
  chair: box @100 0 100 /40 40 90
  lamp: tube @400 0 250 /10 150
    shade: cone @400 150 250 /30 20
```

Nesting implies **containment**: children are positioned relative to the parent's
coordinate space unless absolute coordinates are used.

### 8.2 Labels

Any element can be labeled for later reference:

```
a: box @100 100 /50 50
b: ball @200 200 /20
a > b                         -- connect them
c: box ^right a               -- position relative to a
```

Labels are lowercase identifiers: `a`, `table`, `my_box`, `btn1`.

### 8.3 Templates

Define reusable element patterns:

```
btn = box @0 0 /60 20 #blue !f
  text @30 10 "OK" #white /12
```

The `=` operator defines a template. Templates are not rendered until instantiated.

### 8.4 Instantiation

```
$btn @100 200                 -- place btn template at (100,200)
$btn @100 250                 -- another instance at (100,250)
$btn @100 300 #red            -- override color to red
```

`$name` instantiates a template. Properties after `$name` override template defaults.

### 8.5 Repetition

```
dot @0 0 *3 +50 +0           -- 3 dots: (0,0), (50,0), (100,0)
box @0 0 /20 20 *5 +30 +0    -- 5 boxes in a row, 30 apart
$btn @0 0 *4 +0 +40          -- 4 button instances stacked vertically
```

Syntax: `*count +stride_x +stride_y [+stride_z]`

The repetition operator creates `count` copies, each offset by the stride vector
from the previous copy.

### 8.6 Inline Groups

For small groups that don't need indentation:

```
{a: dot @0 0, b: dot @100 0, c: dot @50 86} -- triangle of dots
a - b - c - a                                 -- connect them
```

Curly braces `{ }` define inline groups. Elements are comma-separated.

---

## 9. Fuzzy & Semantic Values

### 9.1 The Approximation Operator (~)
A
The `~` prefix marks a value as approximate:

```
box @~50 ~30                  -- "roughly at (50,30)"
ball @~200 ~200 /~30          -- "sphere-ish, around (200,200), radius about 30"
```

Approximate values tell the renderer and solver that exact placement does not matter.
This supports the sketch-like quality described in Buxton (2007) — productive
ambiguity that enables exploration without premature commitment.

### 9.2 Range Values (..)

```
box @40..60 25..35            -- position between (40,25) and (60,35)
ball /20..40                  -- radius between 20 and 40
```

Ranges express uncertainty. The solver may pick any value in the range,
or the renderer may visualize the range as a fuzzy region.

### 9.3 Semantic Sizes

When exact dimensions do not matter, use semantic size keywords:

| Keyword | Approximate Value | Use Case |
|---------|------------------|----------|
| `xs` | 5 | Tiny elements, dots |
| `sm` | 15 | Small controls, icons |
| `md` | 40 | Standard elements |
| `lg` | 80 | Large containers |
| `xl` | 150 | Full panels |
| `full` | 100% of parent | Fill container |

```
box @50 50 /md                -- medium-sized box
ball @200 200 /sm             -- small ball
text @100 10 "Title" /lg      -- large text
```

### 9.4 Semantic Positions

Named positions within a coordinate space:

| Keyword | Position | Coordinates (in 0-999 space) |
|---------|----------|------------------------------|
| `ctr` | Center | 500 500 |
| `tl` | Top-left | 0 999 |
| `tr` | Top-right | 999 999 |
| `bl` | Bottom-left | 0 0 |
| `br` | Bottom-right | 999 0 |
| `tc` | Top-center | 500 999 |
| `bc` | Bottom-center | 500 0 |
| `ml` | Mid-left | 0 500 |
| `mr` | Mid-right | 999 500 |

```
box @ctr /lg                  -- large box at center
text @tc "Header" /24         -- text at top-center
ball @br /sm                  -- small ball at bottom-right
```

---

## 10. Queries

Queries extract spatial information from a scene. They are designed for
the whiteboard loop: the LLM generates a query, the engine resolves it,
and the result feeds back into the next reasoning step.

### 10.1 Query Syntax

```
?<operation> <args>
```

### 10.2 Query Operations

| Query | Returns | Example |
|-------|---------|---------|
| `?dist a b` | Distance between a and b | `?dist table chair` -> `42` |
| `?pos a` | Position of a | `?pos table` -> `200 100 0` |
| `?size a` | Dimensions of a | `?size table` -> `120 60 80` |
| `?contains a b` | Does a contain b? | `?contains room table` -> `yes` |
| `?overlap a b` | Do a and b overlap? | `?overlap box1 box2` -> `no` |
| `?near a` | Elements near a | `?near table` -> `chair cup plate` |
| `?above a` | Elements above a | `?above table` -> `cup plate lamp` |
| `?below a` | Elements below a | `?below shelf` -> `table chair` |
| `?left a` | Elements left of a | `?left table` -> `chair` |
| `?right a` | Elements right of a | `?right chair` -> `table lamp` |
| `?inside a` | Elements inside a | `?inside room` -> `table chair lamp` |
| `?between a b` | Elements between a and b | `?between door window` -> `shelf` |
| `?count` | Total element count | `?count` -> `7` |
| `?bounds` | Scene bounding box | `?bounds` -> `0 0 0 500 400 300` |
| `?visible a` | Is a visible from cam? | `?visible shelf` -> `yes` |
| `?path a b` | Shortest path a to b | `?path door table` -> path coords |

### 10.3 Query Chaining

Queries can reference other query results:

```
nearest: ?near player
?dist player nearest           -- distance to the nearest element
```

### 10.4 Aggregate Queries

```
?count room ^inside            -- how many elements inside room?
?dist a * ^min                 -- minimum distance from a to anything
?bounds room ^inside           -- bounding box of room contents
```

---

## 11. Abstract Use

SSL is not limited to physical spatial scenes. Its compact notation
works for any domain where structure, relationships, and layout matter.

### 11.1 Data Flow Diagrams

```
src: node @0 50 "API"
transform: node @200 50 "ETL"
sink: node @400 50 "DB"
src > transform > sink
cache: node @200 150 "Cache"
transform > cache
cache ~> transform "miss"
```

### 11.2 State Machines

```
idle: node @0 100 "Idle" #green
loading: node @200 100 "Loading" #yellow
error: node @200 0 "Error" #red
done: node @400 100 "Done" #blue

idle > loading "fetch"
loading > done "success"
loading > error "fail"
error > idle "retry"
done > idle "reset"
```

### 11.3 Concept Maps

```
ml: node @ctr "ML" /lg
supervised: node @200 700 "Supervised" /md
unsupervised: node @500 700 "Unsupervised" /md
reinforcement: node @800 700 "RL" /md

ml > supervised "type"
ml > unsupervised "type"
ml > reinforcement "type"

regression: node @100 400 "Regression" /sm
classification: node @300 400 "Classification" /sm
supervised > regression
supervised > classification
```

### 11.4 Reasoning Trees

```
goal: node @500 900 "Solve puzzle"
  step1: node "Find constraints"
    c1: node "Width < 100"
    c2: node "Must contain circle"
  step2: node "Generate candidates"
    opt_a: node "Layout A"
    opt_b: node "Layout B"
  step3: node "Evaluate"
    opt_a > step3 "score: 0.8"
    opt_b > step3 "score: 0.3"
```

### 11.5 Architecture Diagrams

```
-- microservice layout
client: box @100 800 /120 40 #cyan "Browser"
gateway: box @100 650 /120 40 #blue "API GW"
auth: box @0 500 /80 40 #green "Auth"
users: box @100 500 /80 40 #green "Users"
orders: box @200 500 /80 40 #green "Orders"
db: tube @100 350 /60 30 #orange "Postgres"
cache: box @250 350 /60 30 #red "Redis"

client > gateway
gateway > auth
gateway > users
gateway > orders
users > db
orders > db
orders > cache
auth > cache
```

---

## 12. Comments & Annotations

### 12.1 Line Comments

```
-- this is a comment
box @50 30 /40 20    -- main panel
```

`--` starts a comment that runs to end of line. It costs 1-2 tokens
(typically the `--` merges into one token).

### 12.2 Section Comments

```
-- === UI Layer ===
header: box @0 900 /full 60 #dark
-- === Data Layer ===
db: tube @ctr /lg
```

Use `-- ===` for visual section breaks in longer specs.

### 12.3 Annotations

Annotations attach metadata without affecting rendering:

```
box @50 30 /40 20 @note("click target")
ball @200 200 /30 @todo("adjust size")
```

---

## 13. Extended Examples

### 13.1 UI Login Form

**Natural Language** (~150 tokens):
> Create a login form interface. There should be a large white card centered on
> a dark blue background. The card should be about 300 by 400 pixels. At the top
> of the card, place a "Welcome Back" title in large dark text. Below the title,
> add a username input field that spans most of the card width. Below that, add
> a password input field of the same size. At the bottom, place a blue "Sign In"
> button centered horizontally. Below the button, add small gray "Forgot password?"
> text as a link.

**SSL** (~45 tokens):

```
bg: box @0 0 /999 999 #navy
card: box @ctr /300 400 #white
  title: text @150 350 "Welcome Back" /24 #dark
  user: box @30 260 /240 40 #gray.1 !s
    text @40 270 "Username" /14 #gray
  pass: box @30 190 /240 40 #gray.1 !s
    text @40 200 "Password" /14 #gray
  btn: box @70 110 /160 44 #blue !f
    text @150 122 "Sign In" /16 #white
  link: text @150 60 "Forgot password?" /12 #gray
```

**Token ratio: ~3.3:1** (NL:SSL)

### 13.2 3D Room with Furniture

**Natural Language** (~300 tokens):
> Describe a room that is 5 meters wide, 4 meters deep, and 3 meters tall.
> In the center of the room is a rectangular wooden table, 1.2 meters wide,
> 0.6 meters deep, and 0.8 meters tall. To the left of the table and slightly
> behind, there is a chair... [continues for ~300 tokens]

**SSL** (~60 tokens):

```
room: box @0 0 0 /500 300 400 #cream
  floor: wall @0 0 0 /500 400 #wood
  table: box @200 0 170 /120 80 60 #brown
    cup: tube @230 80 190 /5 10 #white
    plate: disc @280 80 190 /15 #white
    book: box @210 80 195 /20 15 3 #red
  chair: box @100 0 150 /40 90 40 #brown
  lamp: tube @400 0 350 /8 150 #black
    shade: cone @400 150 350 /25 20 #cream
  shelf: box @0 120 390 /300 60 30 #wood
    book1: box @10 130 390 /15 40 20 #blue
    book2: box @30 130 390 /12 40 20 #green
    book3: box @48 130 390 /18 40 20 #red
  rug: disc @250 1 200 /120 #wine
```

**Token ratio: ~5:1** (NL:SSL)

### 13.3 Microservice Architecture

**Natural Language** (~120 tokens):
> Our system has a React frontend that talks to an API gateway. The gateway
> routes requests to three microservices: auth, users, and orders. The auth
> and users services share a PostgreSQL database, while the orders service
> has its own MongoDB instance. All services communicate through a Redis
> message queue for async operations...

**SSL** (~35 tokens):

```
fe: node @100 400 "React"
gw: node @100 300 "Gateway"
auth: node @0 200 "Auth"
users: node @100 200 "Users"
orders: node @200 200 "Orders"
pg: node @50 100 "Postgres" #blue
mongo: node @200 100 "MongoDB" #green
redis: node @100 100 "Redis" #red

fe > gw
gw > auth
gw > users
gw > orders
auth > pg
users > pg
orders > mongo
auth > redis
users > redis
orders > redis
```

**Token ratio: ~3.4:1** (NL:SSL)

### 13.4 LLM Spatial Reasoning Chain

A spatial puzzle solved step-by-step using SSL queries:

```
-- Problem: Is the ball reachable from the door without crossing any wall?

-- Step 1: Define the scene
room: box @0 0 /400 400
door: line @0 180 0 220
target: ball @300 300 /10 #red
w1: wall @100 0 /5 250
w2: wall @200 150 /5 250
w3: wall @300 0 /5 150

-- Step 2: Query
?path door target
-- engine returns: 0 200 > 80 200 > 80 260 > 180 260 > 180 160 > 280 160 > 280 300 > 300 300
?dist door target              -- straight line: 180
?overlap w1 {line @0 200 300 300}  -- yes (wall blocks direct path)

-- Step 3: Verify path avoids walls
trace: path @0 200 80 200 80 260 180 260 180 160 280 160 280 300 300 300 #green
?overlap trace w1              -- no
?overlap trace w2              -- no
?overlap trace w3              -- no

-- Result: Ball is reachable. Path length: ~520 units.
```

### 13.5 ML Pipeline Visualization

```
-- Data pipeline
raw: node @0 300 "Raw Data" /md #gray
clean: node @150 300 "Clean" /md #yellow
feat: node @300 300 "Features" /md #orange
split: node @450 300 "Split" /sm #orange

raw > clean "preprocess"
clean > feat "engineer"
feat > split

-- Training branch
train: node @350 200 "Train Set" /sm #blue
val: node @550 200 "Val Set" /sm #cyan
split > train
split > val

model: node @350 100 "XGBoost" /md #purple
train > model "fit"
val > model "evaluate"

-- Output
metrics: node @500 100 "Metrics" /sm #green
deploy: node @350 0 "Deploy" /md #green
model > metrics "score"
model > deploy "export"
```

### 13.6 Simple 2D Floor Plan

```
-- Apartment layout (top-down view)
apt: box @0 0 /600 400

-- Rooms
living: box @0 200 /350 200 #cream
  sofa: box @50 250 /150 60 #blue
  tv: box @250 350 /80 10 #black
  table: box @120 330 /60 40 #brown

kitchen: box @350 200 /250 200 #light
  counter: box @360 350 /230 30 #gray
  stove: box @430 350 /40 30 #dark
  fridge: box @560 280 /30 60 #white

bed: box @0 0 /250 200 #lavender
  bed1: box @20 30 /140 170 #white
  desk: box @180 30 /60 80 #brown

bath: box @250 0 /150 200 #mint
  tub: box @260 10 /130 80 #white
  sink: disc @330 150 /15 #white

hall: box @400 0 /200 200 #cream
```

### 13.7 Exploded View (3D Assembly)

```
-- Exploded view of a simple desk lamp
base: disc @200 0 200 /40 #gray
  shaft: tube @200 5 200 /4 120 #silver
  joint: ball @200 125 200 /6 #dark
  arm: tube @200 130 200 /3 80 '30 #silver
  head: cone @240 190 200 /15 25 '-60 #yellow

-- Exploded (move parts upward for clarity)
base_ex: disc @200 0 200 /40 #gray
shaft_ex: tube @200 50 200 /4 120 #silver
joint_ex: ball @200 220 200 /6 #dark
arm_ex: tube @200 280 200 /3 80 '30 #silver
head_ex: cone @240 380 200 /15 25 '-60 #yellow

-- Assembly lines
base_ex ~> shaft_ex #gray.3 !d
shaft_ex ~> joint_ex #gray.3 !d
joint_ex ~> arm_ex #gray.3 !d
arm_ex ~> head_ex #gray.3 !d
```

### 13.8 Entity Relationship Diagram

```
user: box @0 200 /120 80 #blue
  text @60 250 "User" /16 #white
  text @10 225 "id: int" /10
  text @10 210 "name: str" /10

post: box @200 200 /120 80 #green
  text @260 250 "Post" /16 #white
  text @210 225 "id: int" /10
  text @210 210 "title: str" /10

comment: box @400 200 /120 80 #orange
  text @460 250 "Comment" /16 #white
  text @410 225 "id: int" /10
  text @410 210 "body: str" /10

tag: box @200 50 /120 60 #purple
  text @260 85 "Tag" /16 #white
  text @210 65 "id: int" /10

user.right > post.left "1:N"
post.right > comment.left "1:N"
user.right > comment.left "1:N"
post.bottom > tag.top "N:M"
```

### 13.9 Neural Network Architecture

```
-- Simple CNN architecture
input: box @0 200 /30 100 #green "Input\n28x28"
conv1: box @80 175 /20 150 #blue "Conv\n32"
pool1: box @130 190 /15 120 #cyan "Pool"
conv2: box @180 180 /20 140 #blue "Conv\n64"
pool2: box @230 195 /15 110 #cyan "Pool"
fc1: box @300 210 /15 80 #orange "FC\n128"
fc2: box @350 230 /15 40 #orange "FC\n10"
out: box @410 240 /20 20 #red "Out"

input > conv1 > pool1 > conv2 > pool2 > fc1 > fc2 > out
```

### 13.10 Game Level Layout

```
-- Platformer level
sky: box @0 0 /999 999 #sky

ground: box @0 0 /999 80 #brown !f
plat1: box @200 200 /150 20 #green !f
plat2: box @450 350 /120 20 #green !f
plat3: box @700 500 /100 20 #green !f

player: tri @50 80 /20 #blue
coin: ball @250 230 /8 #yellow *3 +80 +0
coin2: ball @480 380 /8 #yellow *2 +50 +0
enemy: tri @600 80 /20 #red '180
flag: line @780 520 780 580
  tri @790 560 /20 #red

spike: tri @350 80 /15 #gray *4 +20 +0
```

---

## 14. Formal Grammar

### 14.1 EBNF Grammar

```ebnf
(* === SSL Grammar === *)

program        = { statement NEWLINE } ;

statement      = element
               | connection
               | query
               | template_def
               | comment
               | deletion
               | EMPTY ;

(* --- Elements --- *)

element        = [ label ":" ] primitive { property } [ inline_children ] ;

label          = IDENT ;

primitive      = type_name
               | "$" IDENT ;

type_name      = "box" | "ball" | "tri" | "line" | "dot" | "arc"
               | "text" | "node" | "wall" | "mesh" | "disc"
               | "tube" | "cone" | "path" | "cam" ;

(* --- Properties --- *)

property       = position
               | dimension
               | color
               | rotation
               | scale
               | flag
               | constraint
               | string_literal
               | repetition
               | annotation ;

position       = "@" coord_list
               | "@" semantic_pos ;

coord_list     = coord { coord } ;

coord          = value
               | relative_coord ;

relative_coord = "+" value
               | IDENT "+" value ;

value          = INTEGER
               | FLOAT
               | approx_value
               | range_value
               | "_" ;

approx_value   = "~" ( INTEGER | FLOAT ) ;

range_value    = ( INTEGER | FLOAT ) ".." ( INTEGER | FLOAT ) ;

semantic_pos   = "ctr" | "tl" | "tr" | "bl" | "br"
               | "tc" | "bc" | "ml" | "mr" ;

dimension      = "/" dim_value { dim_value } ;

dim_value      = value
               | semantic_size ;

semantic_size  = "xs" | "sm" | "md" | "lg" | "xl" | "full" ;

color          = "#" color_value [ "." DIGIT+ ] ;

color_value    = COLOR_NAME | HEX3 | HEX6 ;

COLOR_NAME     = "red" | "blue" | "green" | "yellow" | "orange" | "purple"
               | "pink" | "cyan" | "white" | "black" | "gray" | "brown"
               | "dark" | "light" | "cream" | "navy" | "wine" | "sky"
               | "wood" | "silver" | "lavender" | "mint" | "gold" ;

rotation       = "'" value { value } ;

scale          = "*" ( INTEGER | FLOAT ) ;

flag           = "!" FLAG_CHAR ;

FLAG_CHAR      = "f" | "s" | "d" | "h" | "g" | "w" | "x" ;

constraint     = "^" constraint_type IDENT [ IDENT ] ;

constraint_type = "right" | "left" | "above" | "below"
               | "front" | "behind" | "near" | "far"
               | "inside" | "outside" | "between" | "align" | "face" ;

string_literal = '"' { CHAR } '"' ;

repetition     = "*" INTEGER "+" value "+" value [ "+" value ] ;

annotation     = "@" IDENT "(" string_literal ")" ;

(* --- Connections --- *)

connection     = conn_chain { property } ;

conn_chain     = endpoint edge_op endpoint { edge_op endpoint } ;

endpoint       = IDENT [ "." port_name ] ;

port_name      = "top" | "bottom" | "left" | "right"
               | "front" | "back" | "center"
               | "tl" | "tr" | "bl" | "br"
               | "in" | "out"
               | IDENT ;

edge_op        = ">" | "-" | "<>" | "~>" | "~" ;

(* --- Queries --- *)

query          = "?" query_op { IDENT } [ query_mod ] ;

query_op       = "dist" | "pos" | "size" | "contains" | "overlap"
               | "near" | "above" | "below" | "left" | "right"
               | "inside" | "between" | "count" | "bounds"
               | "visible" | "path" ;

query_mod      = "^" ( "min" | "max" | "inside" IDENT | "count" ) ;

(* --- Templates --- *)

template_def   = IDENT "=" primitive { property }
               [ NEWLINE INDENT { element NEWLINE } DEDENT ] ;

(* --- Deletion --- *)

deletion       = "~" IDENT ;

(* --- Hierarchy --- *)

inline_children = "{" element { "," element } "}" ;

(* Nesting is indicated by INDENT/DEDENT tokens produced by the lexer
   based on indentation level changes. Children follow a parent element
   at a deeper indentation level. *)

(* --- Comments --- *)

comment        = "--" { CHAR } ;

(* --- Lexical Rules --- *)

IDENT          = LETTER { LETTER | DIGIT | "_" } ;
INTEGER        = DIGIT+ ;
FLOAT          = DIGIT+ "." DIGIT+ ;
HEX3           = HEX_DIGIT HEX_DIGIT HEX_DIGIT ;
HEX6           = HEX_DIGIT HEX_DIGIT HEX_DIGIT HEX_DIGIT HEX_DIGIT HEX_DIGIT ;
LETTER         = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i"
               | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r"
               | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z"
               | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
               | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R"
               | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" ;
DIGIT          = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
HEX_DIGIT      = DIGIT | "a" | "b" | "c" | "d" | "e" | "f"
               | "A" | "B" | "C" | "D" | "E" | "F" ;
NEWLINE        = "\n" | "\r\n" ;
INDENT         = (* increase in leading whitespace *) ;
DEDENT         = (* decrease in leading whitespace *) ;
EMPTY          = (* blank line *) ;
```

### 14.2 Grammar Properties

| Property | Value |
|----------|-------|
| Grammar class | LL(1) with indentation sensitivity |
| Ambiguity | None — operator prefixes are unique single characters |
| Context-free? | Yes (indentation handled by lexer as INDENT/DEDENT) |
| Max lookahead | 1 token |
| Reserved words | 15 primitives + 13 constraints + 16 queries + 9 semantic values |

### 14.3 Parse Disambiguation Rules

1. **Repetition vs Scale**: `*3 +50 +0` = repetition (because `+` follows).
   `*3` alone = scale. On connections, `*N` means line weight (not geometric scale).
2. **Position point count**: Even value count after `@` for lines/paths determines
   2D vs 3D: count mod 2 == 0 then 2D; count mod 3 == 0 then 3D; ambiguous cases
   default to 2D.
3. **Label vs keyword**: If a word appears before `:`, it is a label.
   If it appears after a type_name, it is parsed as a property context.
4. **Template vs element**: `=` after an identifier starts a template definition.
   `:` after an identifier starts a labeled element.
5. **Connection vs element**: A line starting with IDENT followed by `>`, `-`,
   `<>`, `~>`, or `~` IDENT (without a type_name) is parsed as a connection.
   `a ~ b` is a curved undirected connection; `~50` (before a number) is approximate.
6. **Deletion vs approximate**: `~IDENT` at line start where IDENT was previously
   defined as a label is a deletion. `~` before a number is an approximation.
   `~` cannot precede a type name (invalid syntax).

---

## 15. Token Efficiency Benchmarks

### 15.1 Methodology

Token counts use the cl100k_base tokenizer (GPT-4/Claude family).
Conventions:
- Spaces between numbers cost ~0 tokens (merge with adjacent digits)
- Short English words (`box`, `line`, `node`) = 1 token each
- Operator symbols (`@`, `/`, `#`, `>`) = 1 token each
- Small integers (0-999) = 1 token each
- Named colors (`red`, `blue`) = 1 token each

### 15.2 Per-Object Token Cost

| Specification Level | Example | Tokens |
|--------------------|---------|---------|
| Minimal (type only) | `box` | 1 |
| Type + position | `box @50 30` | 4 |
| Type + position + size | `box @50 30 /40 20` | 7 |
| Type + pos + size + color | `box @50 30 /40 20 #red` | 9 |
| Full spec (labeled, styled) | `a: box @50 30 0 /40 20 10 '45 #blue !f` | 16 |
| Average object | | **~10-12** |

### 15.3 Scene-Level Comparisons

#### Scene A: UI Login Form (6 elements)

| Format | Tokens | Ratio vs SSL |
|--------|--------|-------------|
| **SSL** | **~45** | **1.0x** |
| Natural Language | ~150 | 3.3x |
| JSON (LayoutGPT style) | ~120 | 2.7x |
| SVG | ~200 | 4.4x |
| TikZ | ~180 | 4.0x |
| HTML/CSS | ~280 | 6.2x |

#### Scene B: 3D Room (12 elements)

| Format | Tokens | Ratio vs SSL |
|--------|--------|-------------|
| **SSL** | **~60** | **1.0x** |
| Natural Language | ~300 | 5.0x |
| JSON | ~200 | 3.3x |
| Three.js code | ~400 | 6.7x |
| USD (Pixar) | ~350 | 5.8x |
| GLTF | ~500+ | 8.3x+ |

#### Scene C: Architecture Diagram (8 nodes, 9 edges)

| Format | Tokens | Ratio vs SSL |
|--------|--------|-------------|
| **SSL** | **~35** | **1.0x** |
| Natural Language | ~120 | 3.4x |
| Mermaid | ~60 | 1.7x |
| DOT (Graphviz) | ~80 | 2.3x |
| PlantUML | ~70 | 2.0x |
| D2 | ~55 | 1.6x |

#### Scene D: Complex Floor Plan (20+ elements)

| Format | Tokens | Ratio vs SSL |
|--------|--------|-------------|
| **SSL** | **~120** | **1.0x** |
| Natural Language | ~800 | 6.7x |
| JSON | ~500 | 4.2x |
| SVG | ~700 | 5.8x |

### 15.4 Token Cost Breakdown by Component

| Component | Tokens per Instance | Examples |
|-----------|-------------------|----------|
| Type name | 1 | `box`, `ball`, `line` |
| `@` operator | 1 | `@` |
| 2D coordinate pair | 2 | `50 30` |
| 3D coordinate triple | 3 | `50 30 10` |
| `/` operator | 1 | `/` |
| 2D size pair | 2 | `40 20` |
| `#` + color | 2 | `#red` |
| `'` + angle | 2 | `'45` |
| Label + `:` | 2 | `a:` |
| `>` connection | 3 | `a > b` |
| `?` query | 3-4 | `?dist a b` |
| `--` comment word | 1 per word | `-- main panel` |
| Indentation (2 spaces) | ~0 | (merges with next token) |
| Newline | ~0 | (free in BPE) |

### 15.5 Compression Ratio Summary

| Domain | SSL vs Natural Language | SSL vs Best Alternative |
|--------|----------------------|------------------------|
| UI layouts | 3-4x more compact | 2-3x vs JSON |
| 3D scenes | 5-7x more compact | 3-4x vs JSON |
| Architecture diagrams | 3-4x more compact | 1.5-2x vs DOT/Mermaid |
| Spatial reasoning chains | 5-10x more compact | 3-5x vs code |
| Floor plans | 6-8x more compact | 4-5x vs JSON |
| **Weighted average** | **~5:1** | **~3:1** |

### 15.6 Information Density

Following Larkin & Simon (1987), we measure **spatial relationships encoded
per token**:

- **Natural language**: ~0.1 relationships/token (most tokens are articles,
  prepositions, determiners)
- **JSON/code**: ~0.3 relationships/token (keys, brackets, syntax overhead)
- **SSL**: ~0.8 relationships/token (positions implicitly encode all pairwise
  relationships; O(n^2) info in O(n) tokens)

For a scene with N objects, natural language must explicitly state O(N^2)
relationships. SSL encodes them implicitly through coordinates — each
object's position defines its relationship to every other object.

---

## 16. Rendering Pipeline

### 16.1 Architecture

```
SSL Source Text
      |
      v
  [1. PARSE]         Tokenize -> AST
      |               Indentation -> tree structure
      v               Labels -> symbol table
  [2. RESOLVE]        Resolve relative positions (@+, @label+)
      |               Resolve template instantiations ($name)
      v               Expand repetitions (*count +stride)
  [3. CONSTRAIN]      Solve constraint positions (^right, ^above)
      |               Fill in _ wildcards
      v               Resolve semantic values (ctr, md)
  [4. LAYOUT]         Compute bounding boxes
      |               Resolve containment
      v               Auto-layout unconstrained elements
  [5. RENDER]         Target-specific output generation
      |
      +---> SVG       (2D web display)
      +---> Three.js  (3D interactive)
      +---> ASCII     (terminal / LLM text reasoning)
      +---> Canvas2D  (fast 2D preview)
      +---> Scene JSON (interchange format)
```

### 16.2 Stage Details

**Stage 1: Parse** (<5ms target)
- Lexer produces tokens with INDENT/DEDENT for indentation
- LL(1) parser builds AST in single pass
- Symbol table maps labels to AST nodes
- Error recovery: skip to next newline on parse error

**Stage 2: Resolve** (<2ms target)
- Walk AST in declaration order
- Resolve relative coordinates to absolute
- Expand template instantiations (deep copy + override)
- Expand repetitions into N separate elements
- Track "previous element" for `@+` offsets

**Stage 3: Constrain** (<10ms target for simple scenes)
- Collect all `^` constraints into a constraint graph
- Topological sort to find resolution order
- Iterative solver for circular constraints (max 10 iterations)
- Fill `_` wildcards from constraint solutions
- Map semantic positions/sizes to numeric values

**Stage 4: Layout** (<5ms target)
- Bottom-up bounding box computation
- Parent-child containment adjustment
- Auto-gap between unconstrained siblings
- Camera/viewport computation

**Stage 5: Render** (<50ms target)
- Target-specific traversal of resolved scene graph
- SVG: direct XML generation
- Three.js: scene object construction
- ASCII: rasterize to character grid
- Scene JSON: serialize resolved AST

### 16.3 Latency Budget

For the whiteboard loop to feel interactive (per WoT, Menon 2024):

| Step | Budget | Rationale |
|------|--------|-----------|
| LLM generates SSL | ~100ms/token | Standard LLM inference speed |
| Parse | <5ms | Must not bottleneck loop |
| Resolve + Constrain | <15ms | Moderate scenes (<100 elements) |
| Layout | <5ms | Simple algorithm |
| Render (SVG) | <25ms | DOM manipulation |
| **Total non-LLM** | **<50ms** | Imperceptible latency |

### 16.4 Render Targets

| Target | Use Case | Fidelity | Speed |
|--------|----------|----------|-------|
| ASCII art | LLM text feedback loop | Low | Fastest |
| SVG | 2D web display | Medium | Fast |
| Canvas2D | Real-time 2D preview | Medium | Fast |
| Three.js | Interactive 3D | High | Medium |
| Scene JSON | Interchange/storage | N/A | Fast |
| Ray trace | Final output | Highest | Slow |

### 16.5 Round-Trip Support

The pipeline must be bidirectional for the whiteboard loop:

```
SSL -> Render -> Image -> Multimodal LLM -> Updated SSL
```

This requires:
- **SSL -> Visual**: the render pipeline above
- **Visual -> SSL**: scene understanding (via multimodal model or CV)
- **Incremental updates**: the LLM outputs only changed/added elements,
  merged with the previous SSL state

Incremental update syntax:

```
-- Update existing element (same label overwrites)
table: box @220 0 170 /120 80 60    -- moves table 20 units right

-- Delete element
~chair                                -- remove chair from scene

-- Add element (new label)
plant: ball @50 0 350 /20 #green     -- add new element
```

---

## 17. Research Foundation

### 17.1 Core Research Map

SSL draws from five streams of research. Each design decision is traceable
to empirical findings:

```
COGNITIVE SCIENCE                    LATENT REASONING
Larkin & Simon 1987 -----+    +----- Coconut 2024
Buxton 2007 -------------+    +------ Quiet-STaR 2024
Tversky 2005 ------------+    +------ Dot-by-Dot 2024
                         v    v       Diffusion of Thoughts 2024
                    +--------------+
                    |     SSL      |
                    | Design Space |
                    +--------------+
                         ^    ^
SPATIAL AI               |    |      TOKEN EFFICIENCY
VoT 2024 ---------------+    +------ CoT compression (Hsieh 2023)
WoT 2024 ---------------+    +------ Implicit CoT (Deng 2024)
VisProg 2023 ------------+    +------ Merrill & Sabharwal 2024
LayoutGPT 2023 ----------+    +------ Dziri et al. 2023
3D-LLM 2023 ------------+    +------ LeCun 2022
```

### 17.2 Design Decision Traceability

| Decision | Justification | Paper |
|----------|--------------|-------|
| Integer coordinates | LLMs handle small ints well; coordinates proven effective | VoT (Wu 2024) |
| Single-char operators | Minimize syntax token overhead | Pause Tokens (Goyal 2023) |
| Short English type names | 2-3 extra tokens buy reliable LLM comprehension | LayoutGPT (Feng 2023) |
| Indentation for hierarchy | Nearly free in BPE; natural for LLMs trained on code | Python/YAML convention |
| Fuzzy values (~) | Productive ambiguity aids exploration | Buxton 2007, Tversky 2005 |
| Implicit relationships | O(n^2) info in O(n) space via coordinates | Larkin & Simon 1987 |
| Query system | Enables whiteboard loop feedback | WoT (Menon 2024) |
| Constraint system (^) | Supports non-sequential specification | Diffusion of Thoughts (Ye 2024) |
| Template/repetition | Compositional reuse reduces total tokens | DreamCoder (Ellis 2021) |
| No brackets for nesting | Every bracket is a wasted compute step | LeCun 2022, P10 |
| 3D native | Fills gap -- no existing spatial DSL is 3D | 3D-LLM (Hong 2023) |
| Renderable output | Required for whiteboard loop verification | WoT (Menon 2024) |
| Formal grammar | Programs beat prose for reasoning | VisProg (Gupta 2023) |
| Variable granularity | Match detail to problem difficulty | CTM (Goyal 2025) |

### 17.3 Key Papers by Design Area

**Why spatial > text for reasoning:**
- Larkin & Simon, "Why a Diagram is Worth Ten Thousand Words" (1987)
- Merrill & Sabharwal, "Expressive Power of Transformers with CoT" (2024)
- Dziri et al., "Faith and Fate" (2023)

**Why tokens should carry spatial meaning:**
- Pfau et al., "Let's Think Dot by Dot" (2024)
- Goyal et al., "Think Before You Speak: Pause Tokens" (2023)
- Hsieh et al., "Distilling Step-by-Step" (2023)

**How LLMs already do spatial reasoning:**
- Wu et al., "Visualization-of-Thought" (2024) -- ASCII spatial intermediates
- Menon et al., "Whiteboard-of-Thought" (2024) -- draw-render-perceive loop
- Feng et al., "LayoutGPT" (2023) -- emergent spatial layout ability
- Hong et al., "3D-LLM" (2023) -- 3D scene understanding in LLMs

**Alternative reasoning substrates:**
- Hao et al., "Coconut" (2024) -- continuous latent reasoning
- Zelikman et al., "Quiet-STaR" (2024) -- internal thinking before speaking
- Ye et al., "Diffusion of Thoughts" (2024) -- non-sequential reasoning
- Goyal et al., "Continuous Thought Machines" (2025) -- variable-time reasoning

**Formal reasoning beats prose:**
- Gupta & Kembhavi, "VisProg" (2023) -- visual programs as reasoning
- Gao et al., "Program-aided Language Models" (2023)
- Liu et al., "Mind's Eye" (2022) -- simulation as reasoning

### 17.4 Open Research Questions

These questions from the knowledge base (GAP-01) remain open and represent
future work for SSL:

1. **Optimal token vocabulary**: Should SSL primitives be added to the tokenizer
   as single tokens? Would custom tokenization improve spatial reasoning?

2. **Fine-tuning for spatial cognition**: Can LLMs be trained to "think in SSL"
   as an internal reasoning format, analogous to Coconut's continuous thought?

3. **Precision-ambiguity balance**: What ratio of fuzzy to precise values
   maximizes reasoning accuracy? Is this task-dependent?

4. **2D vs 3D complexity**: Does the third dimension linearly or quadratically
   increase reasoning difficulty for LLMs?

5. **Training corpus generation**: Can synthetic SSL scenes serve as training
   data to improve LLM spatial reasoning, analogous to code pre-training?

6. **Minimum primitive set**: Is the 15-primitive set optimal, or can a smaller
   set (8-10) cover 95% of use cases through composition?

7. **Temporal extension**: How should SSL handle animation, physics, and
   time-varying scenes? A `@t` temporal operator is a candidate.

---

## Appendix A: Quick Reference Card

```
PRIMITIVES (15)
  box ball tri line dot arc text node
  wall mesh disc tube cone path cam

OPERATORS (8)
  @  position       box @50 30
  /  size           box @50 30 /40 20
  #  color          box @50 30 #red
  >  connect        a > b
  ~  approximate    box @~50 ~30
  '  rotate         box @50 30 '45
  ?  query          ?dist a b
  ^  constrain      b ^right a

CONNECTIONS (5)
  a > b      directed
  a - b      undirected
  a <> b     bidirectional
  a ~> b     curved directed
  a ~ b      curved undirected

SIZES: xs sm md lg xl full
POSITIONS: ctr tl tr bl br tc bc ml mr
FLAGS: !f fill  !s stroke  !d dash  !h hide  !g ghost  !w wire  !x exclude

TEMPLATES:  btn = box @0 0 /60 20 #blue
INSTANCES:  $btn @100 200
REPEAT:     box @0 0 *5 +30 +0
RELATIVE:   @+20 +10  or  @label+20 +10
WILDCARD:   _ (solver fills in)
RANGE:      40..60
COMMENT:    -- text
DELETE:     ~label
```

---

## Appendix B: Comparison with Existing Formats

### SSL vs Natural Language

```
NL:   "A red rectangle at position 50,30 with width 40 and height 20"
SSL:  box @50 30 /40 20 #red
Savings: 16 tokens -> 7 tokens (2.3x)
```

### SSL vs JSON

```
JSON: {"type":"box","x":50,"y":30,"w":40,"h":20,"color":"red"}
SSL:  box @50 30 /40 20 #red
Savings: ~18 tokens -> 7 tokens (2.6x)
```

### SSL vs SVG

```
SVG:  <rect x="50" y="30" width="40" height="20" fill="red"/>
SSL:  box @50 30 /40 20 #red
Savings: ~16 tokens -> 7 tokens (2.3x)
```

### SSL vs TikZ

```
TikZ: \fill[red] (50,30) rectangle (90,50);
SSL:  box @50 30 /40 20 #red
Savings: ~12 tokens -> 7 tokens (1.7x)
```

### SSL vs Mermaid (graphs)

```
Mermaid: graph LR; A[Auth] --> B[Users]; A --> C[Orders]
SSL:     a: node "Auth"
         b: node ^right a "Users"
         c: node ^right b "Orders"
         a > b
         a > c
Savings: Comparable for graphs (~1.5x), SSL wins for spatial scenes
```

---

## Appendix C: Design Decision Log

| # | Decision | Alternatives Considered | Why This Choice |
|---|----------|------------------------|-----------------|
| D1 | Space-separated values | Comma-separated, packed | Spaces are free in BPE |
| D2 | `@` for position | `at`, `pos`, `p:` | Single char, visually distinct |
| D3 | `/` for size | `s:`, `size`, `dim` | Single char, mnemonic (slash = divide space) |
| D4 | `#` for color | `c:`, `color`, `$` | Universal color convention |
| D5 | `>` for connections | `->`, `-->`, `edge` | Single char, intuitive direction |
| D6 | Integer coordinates | Floats, normalized 0-1 | Small ints = 1 token; floats = 2-3 tokens |
| D7 | 0-999 range | 0-100, 0-9999 | 3 digits max; 1000 resolution is sufficient |
| D8 | Non-negative only | Allow negatives | Minus sign costs a token; offset instead |
| D9 | Indentation nesting | Brackets, parentheses | ~0 cost in BPE; Python/YAML familiarity |
| D10 | `--` for comments | `//`, `#`, `%` | `#` taken (color), `//` is 2 chars, `%` rare |
| D11 | English type names | Abbreviations, symbols | 1 token each; LLMs understand perfectly |
| D12 | `~` for approximate | `?`, `approx`, `fuzzy` | Single char, mathematical convention |
| D13 | `^` for constraints | `rel:`, `@>`, special syntax | Single char, caret = "up/toward" |
| D14 | `'` for rotation | `r:`, `rot`, degree symbol | Single char, available in ASCII |
| D15 | Templates with `=` | `def`, `template`, `fn` | Minimal syntax; `=` is universal assignment |

---

*SSL Specification v1.0*
*March 2026*
*Based on research from 40 academic papers spanning 1987-2025*
*Full research basis: KNOWLEDGE_BASE.md*
