#!/bin/bash
# generate.sh — SSL Generate → Render → Evaluate Pipeline
# Usage: ./generate.sh [N]  (default: 20 scenes)
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Use the local claude installation if available (avoids stale homebrew/npm versions)
if [ -x "$HOME/.claude/local/claude" ]; then
  CLAUDE="$HOME/.claude/local/claude"
else
  CLAUDE="claude"
fi
echo "Using: $CLAUDE ($($CLAUDE --version 2>&1 | head -1))"

N=${1:-20}
DIR="$SCRIPT_DIR/runs/$(date +%s)"
mkdir -p "$DIR"
LOG="$DIR/pipeline.log"

PROMPTS=(
  "a snowman"
  "a rocket ship"
  "a house with chimney"
  "a chess piece"
  "a robot"
  "a tree"
  "a table with objects on it"
  "a lamp"
  "a castle"
  "an abstract sculpture"
  "a car"
  "a boat"
  "a guitar"
  "a mushroom"
  "a lighthouse"
  "a telescope"
  "a birthday cake"
  "a windmill"
  "a bridge"
  "a throne"
)

SSL_SYSTEM='You are an SSL spatial sketch generator. Output ONLY valid SSL code. No markdown, no comments, no explanation.

SSL format: P1 header, then one shape per line: TYPE X Y Z W H D COLOR
- TYPE: box sph cyl cone pyr tor line dot
- X Y Z=position (Y is UP, 0=ground). Box: bottom-left corner. Sphere/cyl/cone: center of base.
- W H D=size. Box: width,height,depth. Sphere: radius(W only). Cylinder/cone: radius,height.
- COLOR: blk red grn blu cyn mag yel org wht gry
- Boxes MUST have D>0 for 3D. Cylinders/cones: D is ignored.
- Rotation: TYPE X Y Z W H D COLOR RX RY RZ (degrees)

Coordinate rules: Center scene at X=200 Z=200. Keep X/Z in 50-350. Y from 0 (ground) up to 400. Use LARGE sizes (W=40-120) so shapes are visible.

EXAMPLE - Snowman:
P1
sph 200 25 200 30 30 0 wht
sph 200 70 200 22 22 0 wht
sph 200 105 200 15 15 0 wht
cone 200 120 200 4 15 0 org
dot 192 108 185 3 3 0 blk
dot 208 108 185 3 3 0 blk

EXAMPLE - Rocket:
P1
cyl 200 30 200 50 140 0 wht
cone 200 170 200 50 60 0 red
box 155 0 200 12 70 12 red
box 245 0 200 12 70 12 red
box 200 0 155 12 70 12 red
box 200 0 245 12 70 12 red
sph 200 5 200 15 15 0 yel

EXAMPLE - House:
P1
box 130 0 130 140 60 140 gry
pyr 200 60 200 170 50 0 red
box 180 0 115 40 45 15 blu
box 155 5 131 20 25 25 cyn
box 210 5 131 20 25 25 cyn'

echo "=== SSL Pipeline: generating $N scenes ==="
echo "Output: $DIR"
echo "Log: $LOG"
echo ""

for i in $(seq 1 "$N"); do
  IDX=$((i - 1))
  PROMPT="${PROMPTS[$IDX]:-scene $i}"
  echo -n "[$i/$N] \"$PROMPT\" ... "

  # 1. Generate SSL
  SSL_FILE="$DIR/${i}.ssl"
  GEN_PROMPT="${SSL_SYSTEM} Create a 3D sketch of: ${PROMPT}"

  echo "--- [$i] GENERATE: $PROMPT ---" >> "$LOG"
  if ! $CLAUDE -p "$GEN_PROMPT" --output-format text > "$SSL_FILE" 2>>"$LOG"; then
    echo "SKIP (generation failed, see $LOG)"
    continue
  fi

  # Verify non-empty SSL output
  if [ ! -s "$SSL_FILE" ]; then
    echo "SKIP (empty SSL)"
    continue
  fi
  echo -n "ssl "

  # 2. Render to PNG
  PNG_FILE="$DIR/${i}.png"
  echo "--- [$i] RENDER ---" >> "$LOG"
  if ! node "$SCRIPT_DIR/render.js" "$SSL_FILE" "$PNG_FILE" 2>>"$LOG"; then
    echo "SKIP (render failed, see $LOG)"
    continue
  fi
  echo -n "png "

  # 3. Evaluate (image only — blind to SSL code)
  JSON_FILE="$DIR/${i}.json"
  ABS_PNG="$(cd "$DIR" && pwd)/${i}.png"

  EVAL_PROMPT="Read the image file at ${ABS_PNG} and evaluate it. This is a 3D sketch rendered in isometric view. Score it 1-10 on recognizability, aesthetic, creativity. The sketch was supposed to depict: ${PROMPT}. Respond with ONLY a JSON object, no markdown: {\"prompt\":\"${PROMPT}\",\"recognizability\":N,\"aesthetic\":N,\"creativity\":N,\"total\":N,\"what_i_see\":\"description\"}"

  echo "--- [$i] EVALUATE ---" >> "$LOG"
  if ! $CLAUDE -p "$EVAL_PROMPT" --output-format text --allowedTools "Read" --tools "Read" > "$JSON_FILE" 2>>"$LOG"; then
    echo "SKIP (eval failed, see $LOG)"
    continue
  fi
  echo "eval done"
done

echo ""
echo "=== Generating gallery ==="
node "$SCRIPT_DIR/gallery.js" "$DIR"
echo ""
echo "Done! Open: $DIR/gallery.html"
