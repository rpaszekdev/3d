# mdVOXI Format Specification v0.1

**Markdown + VOXI = Interactive visual notes**

A document format that combines Markdown prose with embedded VOXI visualizations.
Like `.md` but with inline 2D graphics, 3D voxel scenes, charts, and interactions.

## File Extension

`.mdvoxi`

## Structure

A `.mdvoxi` file is valid Markdown with special fenced blocks:

```
# Regular Markdown heading

Regular paragraph text with **bold** and *italic*.

~~~voxi
CANVAS 400 200 #1a1a2e
RECT 20 20 360 160 1 #2d2d44 8
TEXT 40 80 "This is an embedded graphic" 16 2 #fff
~~~

More markdown text continues here...
```

## Block Types

### 1. `~~~voxi` — 2D Canvas Block

Embeds a 2D VOXI drawing using the existing UI Sketch syntax.

```
~~~voxi [width] [height]
CANVAS w h [bg]
RECT x y w h z color [radius]
TEXT x y "string" size z color [bold]
LINE x1 y1 x2 y2 z color [width]
ELLIPSE cx cy rx ry z color
IMG x y w h z [label]
~~~
```

### 2. `~~~voxi3d` — 3D Voxel Block

Embeds a 3D VOXI voxel scene with orbit controls.

```
~~~voxi3d [yaw] [pitch]
V 32 32 32
B 0 0 0 32 1 32 9
S 16 8 16 6 3
~~~
```

### 3. `~~~chart` — Data Visualization Block

Inline charts rendered from simple data declarations.

```
~~~chart bar
"Languages" = Python:85 JavaScript:72 Go:45 Rust:30
colors = #e53935 #fdd835 #00bcd4 #ff9800
~~~

~~~chart line
"Growth" = Q1:10 Q2:25 Q3:45 Q4:80
color = #6c8cff
~~~

~~~chart pie
"Distribution" = Frontend:40 Backend:35 DevOps:25
~~~
```

### 4. `~~~graph` — Node Graph Block

Directed/undirected graphs for architecture diagrams, flowcharts.

```
~~~graph directed
[Client] --> [API Gateway]
[API Gateway] --> [Auth Service]
[API Gateway] --> [Data Service]
[Data Service] --> [PostgreSQL]
[Auth Service] --> [Redis]
colors = #6c8cff #43a047 #e53935
~~~
```

## Interactive Extensions

### Hover Tooltips

In any VOXI block, append `@hover "tooltip text"` to any element:

```
~~~voxi
RECT 20 20 100 40 1 #2d44aa 4 @hover "Click to expand"
~~~
```

### Click Links

Append `@click "url"` or `@click "#section-id"` for navigation:

```
~~~voxi
RECT 20 20 100 40 1 #2d44aa 4 @click "#architecture"
TEXT 30 32 "Go to Architecture" 12 2 #fff
~~~
```

### Animation

Append `@anim pulse|fade|slide [duration_ms]`:

```
~~~voxi
ELLIPSE 50 50 20 20 1 #e53935 @anim pulse 1000
~~~
```

## Markdown Extensions

### Callout Blocks

```
> [!note] This is a note
> [!warning] Watch out for this
> [!tip] Pro tip here
> [!info] Additional context
```

### Inline References

Reference VOXI blocks by id: `{voxi:block-id}` creates a thumbnail link.

```
~~~voxi #architecture-diagram
CANVAS 400 200 #1a1a2e
...
~~~

See the {voxi:architecture-diagram} for details.
```

## Design Philosophy

1. **Plain text first** — readable without rendering, like Markdown
2. **Progressive enhancement** — basic rendering works, interactions are optional
3. **Token efficient** — VOXI blocks stay compact for LLM generation
4. **Self-contained** — no external dependencies in the format itself
