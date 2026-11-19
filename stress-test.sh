#!/bin/bash
# stress-test.sh — Run stress test prompts through Gemini CLI and render
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIR="$SCRIPT_DIR/runs/stress_$(date +%s)"
mkdir -p "$DIR"

SSL_SYSTEM='You are a spatial sketch generator. Output ONLY valid SSL code — no markdown fences, no explanation.

SSL format: P1 header, then one shape per line.
SHAPES: 0=box 1=sphere 2=cylinder 3=cone 4=pyramid 10=wedge 11=sweep 12=hull
Standard: T X Y Z W H D C [R REF] [40 COUNT DX DY DZ]
Wedge: 10 X Y Z W1 H D W2 C (tapered box, W1=bottom W2=top width)
Sweep: 11 X1 Y1 Z1 X2 Y2 Z2 R C (curved arch between two points)
Hull: 12 X Y Z RX RY RZ C (ellipsoid with 3 radii)
Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray
Relations: 10=on 11=under 12=left 13=right 14=front 15=back 16=inside
Clone: append "40 COUNT DX DY DZ" to repeat element COUNT times with offset
Anchored: elements with relations use X Y Z as OFFSETS (use 0 0 0 for centered)
Center at X=200 Z=200. Y=0 ground. Range 0-400. Output 40-80 lines. Use clones heavily.

Example — table with anchored composition:
P1
0 150 0 150 100 5 100 7
0 0 0 0 8 60 8 7 11 0
0 90 0 0 8 60 8 7 11 0
0 0 0 90 8 60 8 7 11 0
0 90 0 90 8 60 8 7 11 0
2 0 0 0 10 25 0 4 10 0
1 20 0 -10 8 8 0 1 10 0'

PROMPTS=(
  "a steam locomotive with boiler, cabin, chimney, 6 wheels, and coupling rods"
  "a gothic cathedral with flying buttresses, rose window, spires, and nave"
  "a robot with articulated arms, legs, head with antenna, and chest panel"
  "a pirate ship with hull, 3 masts, sails, cannons on both sides, and a flag"
  "a japanese pagoda with 5 tiers, each with a wider roof and columns"
  "a helicopter with main rotor, tail rotor, cockpit, skids, and tail boom"
  "a playground with slide, 2 swings, seesaw, climbing frame, and sandbox"
  "a grandfather clock with pendulum, clock face, cabinet, and decorative top"
  "a suspension bridge with 2 towers, cables, road deck, and support pillars"
  "a chess board with all 32 pieces in starting position — use clones for pawns"
  "a dragon sitting on a rock with spread wings, long tail, horns, and open mouth"
  "a kitchen with counter, stove, fridge, hanging cabinets, table and 4 chairs"
  "a tank with treads, rotating turret, long barrel, hatches, and armor plates"
  "a medieval windmill with rotating blades, stone tower, and wooden door"
  "a fully furnished living room with sofa, coffee table, TV, bookshelf, lamp, and rug"
)

N=${#PROMPTS[@]}
echo "=== SSL Stress Test ==="
echo "Prompts: $N"
echo "Output: $DIR"
echo ""

for i in $(seq 0 $((N-1))); do
  IDX=$((i+1))
  PROMPT="${PROMPTS[$i]}"
  echo -n "[$IDX/$N] \"$PROMPT\" ... "

  # Generate SSL via Gemini
  SSL_FILE="$DIR/${IDX}.ssl"
  command gemini -p "${SSL_SYSTEM}

Create: ${PROMPT}" 2>/dev/null | grep -v "^Loaded\|^Registering\|^Server\|^Scheduling\|^Executing\|^MCP\|^$" > "$SSL_FILE"

  # Clean markdown fences if present
  sed -i '' '/^```/d' "$SSL_FILE" 2>/dev/null || true
  sed -i '' '/^Plaintext$/Id' "$SSL_FILE" 2>/dev/null || true

  if [ ! -s "$SSL_FILE" ]; then
    echo "SKIP (empty)"
    continue
  fi

  LINES=$(wc -l < "$SSL_FILE" | tr -d ' ')
  echo -n "${LINES}L "

  # Render
  PNG_FILE="$DIR/${IDX}.png"
  node "$SCRIPT_DIR/render3d.js" "$SSL_FILE" "$PNG_FILE" 2>/dev/null

  if [ -f "$PNG_FILE" ]; then
    echo "done"
  else
    echo "render failed"
  fi

  # Save metadata
  echo "{\"idx\":$IDX,\"prompt\":\"$PROMPT\",\"lines\":$LINES}" > "$DIR/${IDX}.json"
done

# Generate summary
echo ""
echo "=== Results ==="
echo "Output directory: $DIR"
echo ""
printf "%-4s %-6s %s\n" "#" "Lines" "Prompt"
printf "%-4s %-6s %s\n" "---" "-----" "------"
for i in $(seq 1 $N); do
  if [ -f "$DIR/${i}.ssl" ]; then
    L=$(wc -l < "$DIR/${i}.ssl" | tr -d ' ')
    P="${PROMPTS[$((i-1))]}"
    printf "%-4s %-6s %s\n" "$i" "$L" "$P"
  fi
done

echo ""
echo "Open renders: open $DIR/*.png"
echo "Paste any .ssl file into v25-3d.html to explore in 3D"
