#!/bin/bash
# generate-overnight.sh — Generate 1000+ VOXI training models overnight
# Resilient: auto-resumes, retries on failure, logs everything
#
# Usage: nohup bash generate-overnight.sh &
# Check progress: tail -f training-data/overnight.log

cd "$(dirname "$0")"
LOG="training-data/overnight.log"
JSONL="training-data/train-clean.jsonl"
DIR="training-data"
TOTAL_TARGET=1000
RETRY_DELAY=5
MAX_RETRIES=3

mkdir -p "$DIR"

echo "$(date): Starting overnight generation. Target: $TOTAL_TARGET models" >> "$LOG"

# Count existing
EXISTING=$(wc -l < "$JSONL" 2>/dev/null || echo 0)
echo "$(date): Found $EXISTING existing models, need $((TOTAL_TARGET - EXISTING)) more" >> "$LOG"

# Object list — 200+ unique objects, each gets ~5 instruction variants = 1000+
OBJECTS=(
  # Furniture (30)
  "a wooden chair with four legs"
  "a red armchair"
  "a round dining table"
  "a desk with drawers"
  "a bookshelf with books"
  "a bed with pillows"
  "a wardrobe with open doors"
  "a coffee table"
  "a bar stool"
  "a rocking chair"
  "a couch with cushions"
  "a bunk bed"
  "a TV stand with a TV on it"
  "a nightstand with a lamp"
  "a kitchen counter with sink"
  "a tall floor lamp"
  "a chandelier hanging"
  "a grandfather clock"
  "a piano"
  "a bathtub"
  "a toilet"
  "a dresser with mirror"
  "a filing cabinet"
  "a office desk with monitor"
  "a garden bench"
  "a swing set"
  "a picnic table"
  "a hammock between two posts"
  "a baby crib"
  "a bean bag chair"
  # Animals (30)
  "a penguin standing"
  "a cat sitting"
  "a dog standing"
  "a goldfish"
  "a parrot on a perch"
  "a frog on a lily pad"
  "a sea turtle"
  "a rabbit with long ears"
  "a duck swimming"
  "a bear standing upright"
  "a coiled snake"
  "a pig"
  "a chicken"
  "a horse standing"
  "a cow with spots"
  "an elephant"
  "a giraffe"
  "a lion sitting"
  "a monkey hanging"
  "a whale"
  "a dolphin jumping"
  "a butterfly"
  "a ladybug"
  "a spider on a web"
  "an owl on a branch"
  "a flamingo standing"
  "a deer with antlers"
  "a crocodile"
  "a panda sitting"
  "a fox"
  # Vehicles (20)
  "a car from the side"
  "a pickup truck"
  "a sailboat"
  "a commercial airplane"
  "a bicycle"
  "a double decker bus"
  "a steam train engine"
  "a helicopter"
  "a yacht"
  "a rocket on launch pad"
  "a tractor"
  "a motorcycle"
  "a submarine"
  "a hot air balloon"
  "a spaceship"
  "a canoe"
  "a fire truck"
  "an ambulance"
  "a tank"
  "a UFO flying saucer"
  # Buildings (25)
  "a small house with chimney"
  "a castle with towers"
  "a church with steeple"
  "a lighthouse on rocks"
  "a windmill"
  "a skyscraper"
  "a red barn"
  "a stone bridge"
  "a pyramid"
  "an igloo"
  "a log cabin"
  "a japanese pagoda"
  "a water tower"
  "a gazebo"
  "a camping tent"
  "a medieval tower"
  "a mosque with dome"
  "a factory with smokestacks"
  "a treehouse"
  "a dog house"
  "a bird house on a pole"
  "an arch gateway"
  "a well with roof"
  "a guard tower"
  "a greenhouse"
  # Objects (30)
  "a sword with handle"
  "a golden crown"
  "a trophy cup"
  "a Christmas tree with star"
  "a red mushroom"
  "a cactus in desert"
  "a flower in a pot"
  "a snowman with hat"
  "a robot with antenna"
  "a treasure chest open"
  "an hourglass"
  "a paper lantern"
  "an acoustic guitar"
  "a large key"
  "a candle on holder"
  "a telescope on tripod"
  "a microscope"
  "a camera on tripod"
  "a pair of dice"
  "a chess piece king"
  "a chess piece knight"
  "an anchor"
  "a compass"
  "a megaphone"
  "a drum"
  "a magic wand with star"
  "a shield with emblem"
  "a bow and arrow"
  "a torch lit"
  "a spinning wheel"
  # People & Characters (20)
  "a person standing arms out"
  "a person sitting on chair"
  "a knight in armor"
  "a wizard with pointed hat"
  "a ballet dancer"
  "a person waving"
  "a skeleton"
  "a scarecrow"
  "an astronaut in suit"
  "a ninja"
  "a pirate with hat"
  "a king on throne"
  "a snowboarder"
  "a diver"
  "a chef with hat"
  "a firefighter"
  "a samurai"
  "a viking with helmet"
  "a zombie"
  "an angel with wings"
  # Food (15)
  "a red apple"
  "a birthday cake with candles"
  "a popsicle"
  "a hamburger"
  "a slice of pizza"
  "an ice cream cone"
  "a donut with frosting"
  "a cupcake"
  "a banana"
  "a watermelon slice"
  "a bunch of grapes"
  "a candy cane"
  "a pretzel"
  "a taco"
  "a sushi roll"
  # Nature & Scenes (20)
  "an oak tree"
  "a palm tree"
  "a pine tree"
  "a mountain peak"
  "a volcano erupting"
  "a waterfall"
  "an island with palm tree"
  "a rock arch"
  "a campfire with logs"
  "a sun with rays"
  "a crescent moon"
  "a rainbow arch"
  "a crystal formation"
  "a stalagmite cave"
  "a coral reef piece"
  "a sand castle"
  "a bonfire"
  "a cloud"
  "a tornado"
  "an iceberg"
  # Misc (10)
  "a DNA double helix"
  "a atom model"
  "a gear mechanism"
  "a light bulb"
  "a battery"
  "a magnet horseshoe"
  "an eye"
  "a heart shape"
  "a star shape 3D"
  "a yin yang symbol 3D"
)

SYSTEM_PROMPT='You are a VOXI voxel model generator. Output ONLY valid VOXI code, nothing else.

VOXI primitives:
  V W H D          — Grid size (16-32 for simple, up to 48 for detailed)
  B X Y Z W H D C  — Box at (X,Y,Z) with size (W,H,D), color C
  S X Y Z R C      — Sphere at center (X,Y,Z), radius R, color C
  C X Y Z R H C    — Cylinder at center (X,Y,Z), radius R, height H, color C
  E X Y Z RX RY RZ C — Ellipsoid at center, radii (RX,RY,RZ), color C
  -- comment

Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray a=brown b=pink c=dark-green d=tan e=maroon f=navy

Y is UP. Origin (0,0,0) is bottom-left-front. Objects face -Z (toward viewer).

RULES:
1. Use 10-60 lines max. Short and semantic.
2. Use -- comments to label each body part or section.
3. Use MULTIPLE COLORS for different parts.
4. Build from semantic parts (legs, body, head), not random voxels.
5. Center the object in the grid. Ground at Y=0.
6. Use spheres for round parts, boxes for flat/rectangular, cylinders for tubes.

Output raw VOXI code. No markdown. No backticks. No explanation.'

PREFIXES=(
  "Generate a VOXI voxel model of:"
  "Create a 3D voxel model:"
  "VOXI code for:"
  "Build a voxel model of:"
  "3D voxel representation of:"
)

generate_one() {
  local desc="$1"
  local prefix="$2"
  local safename=$(echo "$desc" | tr ' ' '-' | tr -cd 'a-zA-Z0-9-' | tr '[:upper:]' '[:lower:]')
  local outfile="$DIR/${safename}_$(echo "$prefix" | md5sum | cut -c1-4).voxi"

  # Skip if already exists (resume support)
  if [ -f "$outfile" ]; then
    return 0
  fi

  local instruction="${prefix} ${desc}"

  # Check if this instruction already in JSONL
  if grep -qF "\"$instruction\"" "$JSONL" 2>/dev/null; then
    return 0
  fi

  local prompt="INSTRUCTIONS:
${SYSTEM_PROMPT}

TASK:
${prefix} ${desc}"

  local retry=0
  while [ $retry -lt $MAX_RETRIES ]; do
    local raw=$(echo "$prompt" | claude -p --model sonnet 2>/dev/null)

    if [ -z "$raw" ]; then
      retry=$((retry + 1))
      echo "$(date): RETRY $retry for '$desc'" >> "$LOG"
      sleep $RETRY_DELAY
      continue
    fi

    # Clean: remove markdown fencing
    local code=$(echo "$raw" | sed 's/```voxi//g' | sed 's/```//g' | sed '/^Here/d' | sed '/^$/N;/^\n$/d')

    # Validate
    local has_grid=$(echo "$code" | grep -c '^V [0-9]')
    local prim_count=$(echo "$code" | grep -cE '^[BSCEKP] ')
    local comment_count=$(echo "$code" | grep -c '^--')
    local color_count=$(echo "$code" | grep -oE ' [0-9a-f]$' | sort -u | wc -l)
    local line_count=$(echo "$code" | wc -l)

    if [ "$has_grid" -lt 1 ] || [ "$prim_count" -lt 3 ] || [ "$color_count" -lt 2 ] || [ "$comment_count" -lt 2 ]; then
      retry=$((retry + 1))
      echo "$(date): INVALID '$desc' (grid=$has_grid prims=$prim_count colors=$color_count comments=$comment_count) retry $retry" >> "$LOG"
      sleep $RETRY_DELAY
      continue
    fi

    # Save .voxi file
    echo "$code" > "$outfile"

    # Append to JSONL
    local json_code=$(echo "$code" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")
    echo "{\"instruction\":\"$instruction\",\"output\":$json_code,\"stats\":{\"primitives\":$prim_count,\"comments\":$comment_count,\"colors\":$color_count,\"lines\":$line_count}}" >> "$JSONL"

    echo "$(date): OK '$desc' ($prim_count prims, $color_count colors, $line_count lines)" >> "$LOG"
    return 0
  done

  echo "$(date): FAILED '$desc' after $MAX_RETRIES retries" >> "$LOG"
  return 1
}

# Main loop
COUNT=0
for obj in "${OBJECTS[@]}"; do
  for prefix in "${PREFIXES[@]}"; do
    CURRENT=$(wc -l < "$JSONL" 2>/dev/null || echo 0)
    if [ "$CURRENT" -ge "$TOTAL_TARGET" ]; then
      echo "$(date): Reached target $TOTAL_TARGET. Done!" >> "$LOG"
      break 2
    fi

    generate_one "$obj" "$prefix"
    COUNT=$((COUNT + 1))

    # Progress every 10
    if [ $((COUNT % 10)) -eq 0 ]; then
      CURRENT=$(wc -l < "$JSONL" 2>/dev/null || echo 0)
      echo "$(date): Progress: $CURRENT/$TOTAL_TARGET generated ($COUNT attempts)" >> "$LOG"
    fi

    # Small delay to avoid rate limiting
    sleep 1
  done
done

FINAL=$(wc -l < "$JSONL" 2>/dev/null || echo 0)
echo "$(date): COMPLETE. Total: $FINAL models generated." >> "$LOG"
echo "Done! $FINAL models in $JSONL"
