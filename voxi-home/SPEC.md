# VOXI-Home — Spatial Interior Design Language

> A semantic DSL for room layout reasoning, built on VOXI.
> Furniture carries real-world dimensions, clearance rules, and spatial constraints
> that an LLM can reason about.

## Language Syntax

### Room Definition

```
ROOM width depth height
```

Dimensions in meters. Origin `(0,0)` is the south-west corner.
- `x` axis: west → east (left → right)
- `z` axis: south → north (front → back)
- `y` axis: floor → ceiling (handled by furniture height)

### Structural Elements

```
DOOR wall @position w:width
WINDOW wall @position w:width h:height
```

- `wall`: `north`, `south`, `east`, `west`
- `@position`: distance along the wall in meters (from the wall's left edge)
- `w:` width in meters (default: door 0.9m, window 1.2m)
- `h:` height in meters (window only, default: 1.4m)

### Furniture

```
TYPE variant @x z [facing:direction] [wall:direction]
```

- `TYPE`: furniture category from catalog (`SOFA`, `TABLE`, `CHAIR`, `BED`, `TV`, `STORAGE`, `DESK`, `RUG`, `LAMP`, `NIGHTSTAND`)
- `variant`: specific model from catalog (e.g., `3seat`, `coffee`, `dining-4`)
- `@x z`: position in meters from the south-west corner
- `facing:`: direction the front faces (`north`, `south`, `east`, `west`)
- `wall:`: for wall-mounted items, which wall it's on

### Comments

```
-- This is a comment
```

## Catalog

Furniture is defined in `catalog.json`. Each item has:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable name |
| `width` | number | Width in cm (along the item's left-right) |
| `depth` | number | Depth in cm (front-to-back) |
| `height` | number | Height in cm |
| `clearance` | object | Required free space: `front`, `back`, `sides`, or `all` (cm) |
| `color` | number | VOXI color index for rendering |
| `tags` | string[] | Room type hints |

### Adding Items

Add entries to `catalog.json` under the appropriate type. The parser auto-discovers them.

## Spatial Constraints

| Rule | Value | Description |
|------|-------|-------------|
| Minimum walkway | 80 cm | Clear path between furniture |
| Door swing | 90 cm | Radius of door opening arc |
| Window block | 90 cm | Max height of furniture in front of window |
| No overlap | — | Furniture must not intersect (rugs exempt) |
| Room bounds | — | All items must be inside the room |
| Clearance zones | per item | Required free space around furniture |

## Pipeline

```
.voxihome → parser.js → scene object → compiler.js → VOXI code → Mind's Eye
                              ↓
                      constraints.js → violations / free zones → Claude prompt
```

## CLI Usage

```bash
# Interactive reasoning
node reason.js examples/living-room.voxihome

# Show top-down view and VOXI code
node reason.js examples/living-room.voxihome --view

# Render with Mind's Eye
node reason.js examples/living-room.voxihome --minds-eye
```

### Built-in Commands

| Command | Description |
|---------|-------------|
| `view` | Show ASCII top-down floor plan |
| `voxi` | Show compiled VOXI code |
| `info` | Scene stats and furniture list |
| `constraints` | Run constraint check |
| `free` | Find free zones for new furniture |
| `reload` | Re-read the .voxihome file |
| `quit` | Exit |

Any other input is sent to Claude for spatial reasoning.
