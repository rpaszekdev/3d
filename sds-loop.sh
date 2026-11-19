#!/bin/bash
# sds-loop.sh — Score Distillation Sampling style refinement for SSL
# Like DreamFusion but with LLM feedback instead of diffusion gradients
#
# Usage: ./sds-loop.sh "a medieval castle" [max_rounds] [reference_image]
# Example: ./sds-loop.sh "a pirate ship" 8
# Example: ./sds-loop.sh "recreate this" 6 ./reference.png
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -x "$HOME/.claude/local/claude" ]; then
  CLAUDE="$HOME/.claude/local/claude"
else
  CLAUDE="claude"
fi

PROMPT="${1:?Usage: ./sds-loop.sh \"description\" [max_rounds] [reference_image]}"
MAX_ROUNDS="${2:-8}"
REF_IMAGE="${3:-}"
CONVERGE_THRESHOLD=-5  # Effectively disabled — run all rounds

DIR="$SCRIPT_DIR/runs/sds_$(date +%s)"
mkdir -p "$DIR"
LOG="$DIR/sds.log"
SCORES_FILE="$DIR/scores.csv"

echo "round,total,front,side,back,top,weakest_view,lines" > "$SCORES_FILE"

if [ -n "$REF_IMAGE" ] && [ -f "$REF_IMAGE" ]; then
  cp "$REF_IMAGE" "$DIR/reference.png"
fi
REF_ABS_PATH=""
[ -f "$DIR/reference.png" ] && REF_ABS_PATH="$(cd "$DIR" && pwd)/reference.png"

echo "=== SSL SDS Loop ==="
echo "Prompt: $PROMPT"
echo "Max rounds: $MAX_ROUNDS"
echo "Converge threshold: $CONVERGE_THRESHOLD"
[ -n "$REF_IMAGE" ] && echo "Reference: $REF_IMAGE"
echo "Output: $DIR"
echo ""

# --- SSL Format Instructions (shared across all prompts) ---
SSL_FORMAT='SSL format: P1 header, then one shape per line.
SHAPES: 0=box 1=sphere 2=cylinder 3=cone 4=pyramid 10=wedge 11=sweep 12=hull
Standard: T X Y Z W H D C [R REF] [40 COUNT DX DY DZ]
Wedge: 10 X Y Z W1 H D W2 C (tapered box)
Sweep: 11 X1 Y1 Z1 X2 Y2 Z2 R C (curved arch)
Hull: 12 X Y Z RX RY RZ C (ellipsoid)
Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray
Relations: 10=on 11=under 12=left 13=right 14=front 15=back 16=inside
Clone: append "40 COUNT DX DY DZ" to repeat element
Anchored: elements with relations use X Y Z as offsets (0 0 0 = centered)
Center at X=200 Z=200. Y=0 ground. Range 0-400.'

PREV_SCORE=0

# ========================= ROUND 1: INITIAL GENERATION =========================
echo "[Round 1/$MAX_ROUNDS] Generating initial SSL..."
ROUND_DIR="$DIR/round_1"
mkdir -p "$ROUND_DIR"

GEN_REF=""
if [ -n "$REF_ABS_PATH" ]; then
  GEN_REF="
Read the reference image at ${REF_ABS_PATH}. Study its shape, structure, proportions, and colors. Recreate it."
fi

$CLAUDE -p "You are a spatial sketch generator. Output ONLY valid SSL code — no markdown, no explanation.

${SSL_FORMAT}
${GEN_REF}
Create: ${PROMPT}. Use 40-80 lines. Use clones for repeated elements." \
  --output-format text \
  --allowedTools "Read" \
  --tools "Read" \
  > "$ROUND_DIR/scene.ssl" 2>>"$LOG"

# Clean output
sed -i '' '/^```/d' "$ROUND_DIR/scene.ssl" 2>/dev/null || true
sed -i '' '/^Plaintext$/Id' "$ROUND_DIR/scene.ssl" 2>/dev/null || true
sed -i '' '/^ssl$/Id' "$ROUND_DIR/scene.ssl" 2>/dev/null || true

LINES=$(wc -l < "$ROUND_DIR/scene.ssl" | tr -d ' ')
echo "  Generated $LINES lines"

# Render 4 angles
echo "  Rendering..."
node "$SCRIPT_DIR/render3d.js" "$ROUND_DIR/scene.ssl" "$ROUND_DIR/" --angles 2>>"$LOG"
echo "  Done"

PREV_SSL="$ROUND_DIR/scene.ssl"
PREV_DIR="$ROUND_DIR"

# ========================= EVALUATION + REFINEMENT LOOP =========================
for ROUND in $(seq 1 "$MAX_ROUNDS"); do
  ROUND_DIR_EVAL="$PREV_DIR"

  # --- STEP 1: Score each angle independently ---
  echo ""
  echo "[Round $ROUND/$MAX_ROUNDS] Evaluating 4 views..."

  EVAL_REF=""
  if [ -n "$REF_ABS_PATH" ]; then
    EVAL_REF="Also read the reference image at ${REF_ABS_PATH} and compare."
  fi

  EVAL_RESULT=$($CLAUDE -p "You are evaluating a 3D scene rendered from 4 angles.
Target: \"${PROMPT}\"

Read these 4 image files — they show the SAME scene from different viewpoints:
${ROUND_DIR_EVAL}/front.png (front view)
${ROUND_DIR_EVAL}/side.png (side view)
${ROUND_DIR_EVAL}/iso.png (isometric 3/4 view)
${ROUND_DIR_EVAL}/top.png (top-down view)
${EVAL_REF}

For EACH view, score 1-10 on how well it matches \"${PROMPT}\" and describe what's wrong.

Respond with ONLY this JSON format:
{\"front\":{\"score\":N,\"issue\":\"...\"},\"side\":{\"score\":N,\"issue\":\"...\"},\"back\":{\"score\":N,\"issue\":\"...\"},\"top\":{\"score\":N,\"issue\":\"...\"},\"total\":N,\"weakest\":\"view_name\",\"summary\":\"overall assessment\"}" \
    --output-format text \
    --allowedTools "Read" \
    --tools "Read" 2>>"$LOG")

  echo "  $EVAL_RESULT" >> "$LOG"

  # Parse scores — extract from JSON using multiple patterns for robustness
  # Save raw eval for debugging
  echo "$EVAL_RESULT" > "$ROUND_DIR_EVAL/eval_raw.txt" 2>/dev/null || true

  TOTAL=$(echo "$EVAL_RESULT" | grep -oE '"total"\s*:\s*[0-9]+' | head -1 | grep -oE '[0-9]+$')
  WEAKEST=$(echo "$EVAL_RESULT" | grep -oE '"weakest"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"weakest"[^"]*"//;s/"//')
  FRONT_S=$(echo "$EVAL_RESULT" | grep -oE '"front"\s*:\s*\{[^}]*"score"\s*:\s*[0-9]+' | grep -oE '[0-9]+$')
  SIDE_S=$(echo "$EVAL_RESULT" | grep -oE '"side"\s*:\s*\{[^}]*"score"\s*:\s*[0-9]+' | grep -oE '[0-9]+$')
  BACK_S=$(echo "$EVAL_RESULT" | grep -oE '"back"\s*:\s*\{[^}]*"score"\s*:\s*[0-9]+' | grep -oE '[0-9]+$')
  TOP_S=$(echo "$EVAL_RESULT" | grep -oE '"top"\s*:\s*\{[^}]*"score"\s*:\s*[0-9]+' | grep -oE '[0-9]+$')

  # Fallback: try simpler patterns if above failed
  [ -z "$FRONT_S" ] && FRONT_S=$(echo "$EVAL_RESULT" | grep -oE '"front"[^0-9]*[0-9]+' | grep -oE '[0-9]+$')
  [ -z "$SIDE_S" ] && SIDE_S=$(echo "$EVAL_RESULT" | grep -oE '"side"[^0-9]*[0-9]+' | grep -oE '[0-9]+$')
  [ -z "$BACK_S" ] && BACK_S=$(echo "$EVAL_RESULT" | grep -oE '"back"[^0-9]*[0-9]+' | grep -oE '[0-9]+$')
  [ -z "$TOP_S" ] && TOP_S=$(echo "$EVAL_RESULT" | grep -oE '"top"[^0-9]*[0-9]+' | grep -oE '[0-9]+$')

  TOTAL=${TOTAL:-0}
  WEAKEST=${WEAKEST:-"unknown"}
  FRONT_S=${FRONT_S:-0}
  SIDE_S=${SIDE_S:-0}
  BACK_S=${BACK_S:-0}
  TOP_S=${TOP_S:-0}

  LINES=$(wc -l < "$PREV_SSL" | tr -d ' ')
  echo "$ROUND,$TOTAL,$FRONT_S,$SIDE_S,$BACK_S,$TOP_S,$WEAKEST,$LINES" >> "$SCORES_FILE"

  echo "  Scores: total=$TOTAL front=$FRONT_S side=$SIDE_S back=$BACK_S top=$TOP_S"
  echo "  Weakest view: $WEAKEST"

  # --- STEP 2: Check convergence ---
  IMPROVEMENT=$((TOTAL - PREV_SCORE))
  if [ "$ROUND" -gt 1 ] && [ "$IMPROVEMENT" -lt "$CONVERGE_THRESHOLD" ]; then
    echo ""
    echo "  Converged! Improvement ($IMPROVEMENT) < threshold ($CONVERGE_THRESHOLD)"
    echo "  Stopping at round $ROUND with score $TOTAL"
    break
  fi

  if [ "$ROUND" -ge "$MAX_ROUNDS" ]; then
    echo ""
    echo "  Max rounds reached."
    break
  fi

  PREV_SCORE=$TOTAL

  # --- STEP 3: Refine based on per-view feedback ---
  NEXT_ROUND=$((ROUND + 1))
  NEXT_DIR="$DIR/round_${NEXT_ROUND}"
  mkdir -p "$NEXT_DIR"

  echo "[Round $NEXT_ROUND/$MAX_ROUNDS] Refining (focusing on $WEAKEST view)..."

  CURRENT_SSL=$(cat "$PREV_SSL")

  REFINE_REF=""
  if [ -n "$REF_ABS_PATH" ]; then
    REFINE_REF="
Also read the reference image at ${REF_ABS_PATH} — this is the goal."
  fi

  $CLAUDE -p "You are making INCREMENTAL improvements to an SSL 3D scene. Output ONLY the improved SSL code — no markdown, no explanation. Start with P1.

${SSL_FORMAT}

CURRENT SSL CODE (this is your starting point — DO NOT rewrite from scratch):
${CURRENT_SSL}

EVALUATION RESULTS:
${EVAL_RESULT}

Read the 4 render images:
${PREV_DIR}/front.png
${PREV_DIR}/side.png
${PREV_DIR}/iso.png
${PREV_DIR}/top.png
${REFINE_REF}

The WEAKEST view is: ${WEAKEST}

CRITICAL RULES:
1. Start with the EXACT current SSL code above as your base
2. KEEP every line that is working correctly — do NOT remove elements that look good
3. Only MODIFY lines that are causing problems (wrong position, wrong size, wrong color)
4. ADD new lines to fill in missing details
5. The output must have AT LEAST as many lines as the input (${LINES} lines). Do not simplify.
6. Focus fixes on the ${WEAKEST} view while preserving what works in other views

Think of this as EDITING a document, not rewriting it. Small targeted changes, not a complete rewrite." \
    --output-format text \
    --allowedTools "Read" \
    --tools "Read" \
    > "$NEXT_DIR/scene.ssl" 2>>"$LOG"

  # Clean output — remove markdown fences, comments, blank lines
  sed -i '' '/^```/d' "$NEXT_DIR/scene.ssl" 2>/dev/null || true
  sed -i '' '/^Plaintext$/Id' "$NEXT_DIR/scene.ssl" 2>/dev/null || true
  sed -i '' '/^ssl$/Id' "$NEXT_DIR/scene.ssl" 2>/dev/null || true
  sed -i '' '/^#/d' "$NEXT_DIR/scene.ssl" 2>/dev/null || true
  sed -i '' '/^say /d' "$NEXT_DIR/scene.ssl" 2>/dev/null || true
  sed -i '' '/^$/d' "$NEXT_DIR/scene.ssl" 2>/dev/null || true

  LINES=$(wc -l < "$NEXT_DIR/scene.ssl" | tr -d ' ')
  echo "  Generated $LINES lines"

  # Check if code actually changed
  if diff -q "$PREV_SSL" "$NEXT_DIR/scene.ssl" > /dev/null 2>&1; then
    echo "  No code changes — converged!"
    break
  fi

  # Render new version
  echo "  Rendering..."
  node "$SCRIPT_DIR/render3d.js" "$NEXT_DIR/scene.ssl" "$NEXT_DIR/" --angles 2>>"$LOG"
  echo "  Done"

  PREV_SSL="$NEXT_DIR/scene.ssl"
  PREV_DIR="$NEXT_DIR"
done

# ========================= FINAL SUMMARY =========================
echo ""
echo "════════════════════════════════════════════"
echo "  SDS LOOP COMPLETE"
echo "════════════════════════════════════════════"
echo ""
echo "Scores progression:"
cat "$SCORES_FILE" | column -t -s','
echo ""
echo "Final SSL: $PREV_SSL"
echo "Final renders: $PREV_DIR/"
echo ""
echo "View scores over time: cat $SCORES_FILE"
echo "Open final: open $PREV_DIR/iso.png"
echo "Paste into renderer: open $SCRIPT_DIR/v25-3d.html"
