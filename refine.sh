#!/bin/bash
# refine.sh — Iterative SSL refinement pipeline
# Usage: ./refine.sh "a medieval castle with towers" [rounds] [reference_image]
# Example: ./refine.sh "a robot holding a sword" 4
# Example: ./refine.sh "recreate this building" 4 ./photo.png
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Claude binary
if [ -x "$HOME/.claude/local/claude" ]; then
  CLAUDE="$HOME/.claude/local/claude"
else
  CLAUDE="claude"
fi

PROMPT="${1:?Usage: ./refine.sh \"description\" [rounds] [reference_image]}"
MAX_ROUNDS="${2:-4}"
REF_IMAGE="${3:-}"

# Validate reference image if provided
if [ -n "$REF_IMAGE" ] && [ ! -f "$REF_IMAGE" ]; then
  echo "ERROR: Reference image not found: $REF_IMAGE"
  exit 1
fi

DIR="$SCRIPT_DIR/runs/refine_$(date +%s)"
mkdir -p "$DIR"
LOG="$DIR/refine.log"

echo "=== SSL Refinement Pipeline ==="
echo "Prompt: $PROMPT"
echo "Rounds: $MAX_ROUNDS"
if [ -n "$REF_IMAGE" ]; then
  echo "Reference: $REF_IMAGE"
  # Copy reference image into run directory
  cp "$REF_IMAGE" "$DIR/reference.png"
fi
echo "Output: $DIR"
echo ""

# --- System prompt for initial generation ---
GEN_SYSTEM='You are an SSL spatial sketch generator. Output ONLY valid SSL code. No markdown, no explanation, no fences.

SSL format: P1 header, then one shape per line: T X Y Z W H D C [R REF]
- T: 0=box 1=sphere 2=cylinder 3=cone 4=pyramid 5=torus 6=line 7=dot
- X Y Z=position (Y is UP, 0=ground). Box: bottom-left corner. Sphere/cyl/cone: center of base.
- W H D=size. Box: width,height,depth. Sphere: radius(W=H, D=0). Cylinder/cone: radius(W), height(H), D=0.
- C: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray
- R=relation (optional): 10=on 11=under 12=left 13=right 14=front 15=back 16=inside
- REF=index of referenced element (0-based)
Center scene at X=200 Z=200. Y=0 is ground. Use sizes 20-120.

Example — snowman:
P1
1 200 0 200 35 35 0 8
1 200 70 200 25 25 0 8 10 0
1 200 120 200 18 18 0 8 10 1
3 200 138 200 5 15 0 7 14 2

Example — house:
P1
0 130 0 130 140 60 140 9
4 200 60 200 170 50 0 1 10 0
0 180 0 115 40 45 15 3 14 0

Example — chess king:
P1
2 200 0 200 45 15 0 8
2 200 15 200 35 10 0 8 10 0
2 200 25 200 18 65 0 8 10 1
2 200 90 200 32 12 0 8 10 2
1 200 102 200 25 25 0 8 10 3
0 196 127 196 8 30 8 8 10 4
0 190 157 190 20 8 20 8 10 5'

# --- Round 1: Initial generation ---
echo "[Round 1/$MAX_ROUNDS] Generating initial SSL..."
echo "--- ROUND 1: GENERATE ---" >> "$LOG"

ROUND_DIR="$DIR/round_1"
mkdir -p "$ROUND_DIR"

REF_INSTRUCTION=""
REF_ABS_PATH=""
if [ -n "$REF_IMAGE" ]; then
  REF_ABS_PATH="$(cd "$DIR" && pwd)/reference.png"
  REF_INSTRUCTION="
IMPORTANT: Read the image file at ${REF_ABS_PATH} — this is the TARGET reference image.

Study it carefully and identify:
- What shapes/objects are visible (boxes, cylinders, cones, etc.)
- Their approximate positions relative to each other
- Their sizes and proportions
- Colors and materials
- Small details (windows, doors, decorations, crenellations, etc.)

Recreate what you see as accurately as possible using SSL primitives. Use many elements for detail. Match the proportions and layout from the reference image."
fi

$CLAUDE -p "${GEN_SYSTEM}
${REF_INSTRUCTION}
Create: ${PROMPT}" \
  --output-format text \
  --allowedTools "Read" \
  --tools "Read" \
  > "$ROUND_DIR/scene.ssl" 2>>"$LOG"

if [ ! -s "$ROUND_DIR/scene.ssl" ]; then
  echo "FAILED: Empty generation. See $LOG"
  exit 1
fi
echo "  Generated $(wc -l < "$ROUND_DIR/scene.ssl" | tr -d ' ') lines of SSL"

# Render 4 angles
echo "  Rendering 4 angles..."
echo "--- ROUND 1: RENDER ---" >> "$LOG"
node "$SCRIPT_DIR/render3d.js" "$ROUND_DIR/scene.ssl" "$ROUND_DIR/" --angles 2>>"$LOG"

# Also render a single hero shot
node "$SCRIPT_DIR/render3d.js" "$ROUND_DIR/scene.ssl" "$ROUND_DIR/render.png" 2>>"$LOG"
echo "  Done"

# --- Refinement rounds ---
PREV_SSL="$ROUND_DIR/scene.ssl"
PREV_DIR="$ROUND_DIR"

for ROUND in $(seq 2 "$MAX_ROUNDS"); do
  ROUND_DIR="$DIR/round_${ROUND}"
  mkdir -p "$ROUND_DIR"

  echo ""
  echo "[Round $ROUND/$MAX_ROUNDS] Refining..."
  echo "--- ROUND $ROUND: REFINE ---" >> "$LOG"

  CURRENT_SSL=$(cat "$PREV_SSL")

  # Build refinement prompt with image references
  REFINE_PROMPT="You are an SSL spatial sketch generator. Output ONLY the improved SSL code. No markdown, no explanation, no fences. Start with P1.

SSL format: T X Y Z W H D C [R REF]
Types: 0=box 1=sphere 2=cylinder 3=cone 4=pyramid 5=torus 6=line 7=dot
Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray
Relations: 10=on 11=under 12=left 13=right 14=front 15=back 16=inside
Center at X=200 Z=200. Y=0 is ground. Sizes 20-120.

CURRENT SSL CODE:
${CURRENT_SSL}

First 4 images represent the current state (isometric, front, side, top views).
Last image is the designated goal image. Make it look like the goal image.
Focus on little details and try to implement them, only if they follow the designated picture.
Output only SSL code."

  # Build image list: 4 angle renders FIRST, then reference LAST
  IMAGE_INSTRUCTIONS="Read these image files — first 4 are the current state, last is the goal:
${PREV_DIR}/iso.png
${PREV_DIR}/front.png
${PREV_DIR}/side.png
${PREV_DIR}/top.png"

  if [ -n "$REF_IMAGE" ]; then
    IMAGE_INSTRUCTIONS="${IMAGE_INSTRUCTIONS}
${REF_ABS_PATH}"
  fi

  # Call Claude with images
  $CLAUDE -p "$REFINE_PROMPT

$IMAGE_INSTRUCTIONS" \
    --output-format text \
    --allowedTools "Read" \
    --tools "Read" \
    > "$ROUND_DIR/scene.ssl" 2>>"$LOG"

  if [ ! -s "$ROUND_DIR/scene.ssl" ]; then
    echo "  FAILED: Empty output. Keeping previous round."
    cp "$PREV_SSL" "$ROUND_DIR/scene.ssl"
  fi

  # Clean any markdown fences from output
  sed -i '' '/^```/d' "$ROUND_DIR/scene.ssl" 2>/dev/null || true
  sed -i '' '/^Plaintext$/Id' "$ROUND_DIR/scene.ssl" 2>/dev/null || true

  LINES=$(wc -l < "$ROUND_DIR/scene.ssl" | tr -d ' ')
  echo "  Generated $LINES lines of SSL"

  # Check if code changed
  if diff -q "$PREV_SSL" "$ROUND_DIR/scene.ssl" > /dev/null 2>&1; then
    echo "  No changes — converged! Stopping early."
    break
  fi

  # Render 4 angles
  echo "  Rendering 4 angles..."
  echo "--- ROUND $ROUND: RENDER ---" >> "$LOG"
  node "$SCRIPT_DIR/render3d.js" "$ROUND_DIR/scene.ssl" "$ROUND_DIR/" --angles 2>>"$LOG"
  node "$SCRIPT_DIR/render3d.js" "$ROUND_DIR/scene.ssl" "$ROUND_DIR/render.png" 2>>"$LOG"
  echo "  Done"

  PREV_SSL="$ROUND_DIR/scene.ssl"
  PREV_DIR="$ROUND_DIR"
done

# --- Final evaluation ---
echo ""
echo "[Evaluation] Scoring final render..."
FINAL_DIR="$PREV_DIR"
FINAL_SSL="$PREV_SSL"

EVAL_PROMPT="Read the image file at $(cd "$FINAL_DIR" && pwd)/iso.png and evaluate it.
This is a 3D scene rendered from an isometric view. It was supposed to depict: ${PROMPT}
Score it 1-10 on recognizability, aesthetic, creativity.
Respond with ONLY a JSON object: {\"prompt\":\"${PROMPT}\",\"recognizability\":N,\"aesthetic\":N,\"creativity\":N,\"total\":N,\"what_i_see\":\"description\"}"

$CLAUDE -p "$EVAL_PROMPT" \
  --output-format text \
  --allowedTools "Read" \
  --tools "Read" \
  > "$DIR/eval.json" 2>>"$LOG"

echo ""
echo "=== Results ==="
echo "Rounds completed: $(ls -d "$DIR"/round_* | wc -l | tr -d ' ')"
echo "Final SSL: $FINAL_SSL"
echo "Final render: $FINAL_DIR/render.png"
if [ -f "$DIR/eval.json" ]; then
  echo "Evaluation:"
  cat "$DIR/eval.json"
fi
echo ""
echo "Compare rounds:"
for d in "$DIR"/round_*; do
  r=$(basename "$d")
  lines=$(wc -l < "$d/scene.ssl" 2>/dev/null | tr -d ' ')
  echo "  $r: $lines lines"
done
echo ""
echo "Open final render: open $FINAL_DIR/render.png"
