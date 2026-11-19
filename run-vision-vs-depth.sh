#!/bin/bash
# Vision vs Depth experiment runner
# Sends same scene as IMAGE to Claude Vision and DEPTH TEXT to Claude Text
# Usage: bash run-vision-vs-depth.sh [max_tasks]

MAX=${1:-50}
BENCHMARK="test-videos/vision-vs-depth/benchmark.json"
RESULTS_DIR="test-videos/vision-vs-depth/results"
mkdir -p "$RESULTS_DIR"

echo "=== VISION vs DEPTH EXPERIMENT ==="
echo "Tasks: $MAX"
echo ""

# Generate all prompts
python3 -c "
import json
with open('$BENCHMARK') as f:
    data = json.load(f)

for t in data['tasks'][:$MAX]:
    tid = t['id']

    # VISION prompt (will be paired with image via CLI)
    vision_prompt = f'''Look at this top-down view of colored objects on a table.

QUESTION: {t['question']}
CHOICES: {t['choices']}

Reply with ONLY the answer matching one choice exactly. Nothing else.'''

    # DEPTH prompt (text only)
    depth_prompt = f'''You are analyzing a top-down view of objects on a table, represented as a depth matrix.
Objects appear as clusters of LOW depth values (0-3) against the table surface (depth 5).

{t['depth_text']}

QUESTION: {t['question']}
CHOICES: {t['choices']}

Reply with ONLY the answer matching one choice exactly. Nothing else.'''

    with open(f'$RESULTS_DIR/t{tid:03d}_vision.prompt', 'w') as f:
        f.write(vision_prompt)
    with open(f'$RESULTS_DIR/t{tid:03d}_depth.prompt', 'w') as f:
        f.write(depth_prompt)

print(f'Generated prompts for {min($MAX, len(data[\"tasks\"]))} tasks')
"

# Run in parallel batches of 10
for batch_start in $(seq 1 10 $MAX); do
    batch_end=$((batch_start + 9))
    if [ $batch_end -gt $MAX ]; then batch_end=$MAX; fi
    echo "Batch $batch_start-$batch_end..."

    for tid in $(seq $batch_start $batch_end); do
        tid_fmt=$(printf "%03d" $tid)
        img_path="test-videos/vision-vs-depth/scene_${tid_fmt}.png"

        # VISION: send image + prompt to Claude
        (claude -m sonnet -p "$(cat $RESULTS_DIR/t${tid_fmt}_vision.prompt)" --files "$img_path" --no-input 2>/dev/null > $RESULTS_DIR/t${tid_fmt}_vision.answer) &

        # DEPTH: send text-only prompt
        (claude -m sonnet -p "$(cat $RESULTS_DIR/t${tid_fmt}_depth.prompt)" --no-input 2>/dev/null > $RESULTS_DIR/t${tid_fmt}_depth.answer) &
    done
    wait
    echo "  Done"
done

echo ""
echo "=== SCORING ==="

python3 -c "
import json

with open('$BENCHMARK') as f:
    data = json.load(f)

tasks = data['tasks'][:$MAX]
v_correct = 0
d_correct = 0
results = []

for t in tasks:
    tid = t['id']
    tid_fmt = f'{tid:03d}'
    correct = t['answer'].lower().strip()

    try:
        with open(f'$RESULTS_DIR/t{tid_fmt}_vision.answer') as f:
            v_ans = f.read().strip().lower()
    except: v_ans = 'ERROR'

    try:
        with open(f'$RESULTS_DIR/t{tid_fmt}_depth.answer') as f:
            d_ans = f.read().strip().lower()
    except: d_ans = 'ERROR'

    v_ok = correct in v_ans or v_ans in correct
    d_ok = correct in d_ans or d_ans in correct

    # Handle multi-word answers
    if not v_ok and len(correct.split()) > 1:
        v_ok = all(w in v_ans for w in correct.split())
    if not d_ok and len(correct.split()) > 1:
        d_ok = all(w in d_ans for w in correct.split())

    if v_ok: v_correct += 1
    if d_ok: d_correct += 1

    sv = '✓' if v_ok else '✗'
    sd = '✓' if d_ok else '✗'
    print(f'  T{tid:2d} [{t[\"type\"]:10s}] ans={correct:25s} | vision:{sv} {v_ans[:25]:25s} | depth:{sd} {d_ans[:25]:25s}')
    results.append({'id':tid,'type':t['type'],'correct':correct,'vision':v_ans,'depth':d_ans,'v_ok':v_ok,'d_ok':d_ok})

n = len(results)
print()
print('=' * 70)
print(f'  VISION MODEL (sees image): {v_correct}/{n} ({100*v_correct/n:.0f}%)')
print(f'  DEPTH TEXT   (reads nums): {d_correct}/{n} ({100*d_correct/n:.0f}%)')
print('=' * 70)

# By type
by_type = {}
for r in results:
    t = r['type']
    if t not in by_type: by_type[t] = {'v':0,'d':0,'total':0}
    by_type[t]['total'] += 1
    if r['v_ok']: by_type[t]['v'] += 1
    if r['d_ok']: by_type[t]['d'] += 1

print()
print('By type:')
for t,v in sorted(by_type.items()):
    print(f'  {t:12s}: vision {v[\"v\"]:2d}/{v[\"total\"]} ({100*v[\"v\"]/v[\"total\"]:3.0f}%)  |  depth {v[\"d\"]:2d}/{v[\"total\"]} ({100*v[\"d\"]/v[\"total\"]:3.0f}%)')

with open(f'$RESULTS_DIR/summary.json', 'w') as f:
    json.dump({
        'vision_correct': v_correct, 'vision_pct': round(100*v_correct/n,1),
        'depth_correct': d_correct, 'depth_pct': round(100*d_correct/n,1),
        'total': n, 'by_type': by_type, 'results': results
    }, f, indent=2)
print(f'\nSaved to $RESULTS_DIR/summary.json')
"
