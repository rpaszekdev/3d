#!/bin/bash
# Run benchmark with parallel claude CLI calls
# Usage: bash run-benchmark-parallel.sh

BENCHMARK="test-videos/benchmark-30.json"
RESULTS_DIR="test-videos/benchmark-results"
mkdir -p "$RESULTS_DIR"

# Generate prompts from JSON
python3 -c "
import json, os

with open('$BENCHMARK') as f:
    data = json.load(f)

results_dir = '$RESULTS_DIR'

for t in data['tasks']:
    tid = t['id']

    # Build depth views string
    views = ''
    for fid in sorted(t['depthViews'].keys(), key=int):
        views += t['depthViews'][fid] + '\n\n'

    diffs = ''
    if t.get('diffs'):
        for key, diff in t['diffs'].items():
            diffs += diff + '\n\n'

    # WITH DEPTH prompt
    depth_prompt = f'''Analyze this 3D scene from depth matrices (0=close 9=far .=empty). Objects are low-depth clusters on the table.

{views}{('Diffs:\n' + diffs) if diffs else ''}
QUESTION: {t['question']}
CHOICES: {t['choices']}

Reply with ONLY the answer matching one choice exactly. Nothing else.'''

    # WITHOUT DEPTH prompt (just VOXI code)
    nodepth_prompt = f'''Analyze this 3D voxel scene from VOXI code.

\`\`\`
{t['code']}
\`\`\`

VOXI: V=grid, B X Y Z W H D C=box, S X Y Z R C=sphere. Y=UP. 1=red 2=green 3=blue 5=magenta 6=yellow 7=orange 9=gray. T N=frame.

QUESTION: {t['question']}
CHOICES: {t['choices']}

Reply with ONLY the answer matching one choice exactly. Nothing else.'''

    # Save prompts
    with open(f'{results_dir}/task_{tid:02d}_depth.prompt', 'w') as f:
        f.write(depth_prompt)
    with open(f'{results_dir}/task_{tid:02d}_nodepth.prompt', 'w') as f:
        f.write(nodepth_prompt)

print(f'Generated prompts for {len(data[\"tasks\"])} tasks')
"

echo "Running benchmark..."
echo ""

# Run all tasks in parallel batches of 10
for batch_start in 1 11 21; do
    batch_end=$((batch_start + 9))
    if [ $batch_end -gt 30 ]; then batch_end=30; fi

    echo "=== Batch $batch_start-$batch_end ==="

    for tid in $(seq $batch_start $batch_end); do
        tid_fmt=$(printf "%02d" $tid)
        # Run depth version
        (claude -m sonnet -p "$(cat $RESULTS_DIR/task_${tid_fmt}_depth.prompt)" --no-input 2>/dev/null > $RESULTS_DIR/task_${tid_fmt}_depth.answer) &
        # Run no-depth version
        (claude -m sonnet -p "$(cat $RESULTS_DIR/task_${tid_fmt}_nodepth.prompt)" --no-input 2>/dev/null > $RESULTS_DIR/task_${tid_fmt}_nodepth.answer) &
    done
    wait
    echo "  Batch done"
done

echo ""
echo "=== SCORING ==="

# Score results
python3 -c "
import json

with open('$BENCHMARK') as f:
    data = json.load(f)

results_dir = '$RESULTS_DIR'
correct_d = 0
correct_n = 0
results = []

for t in data['tasks']:
    tid = t['id']
    tid_fmt = f'{tid:02d}'
    correct = t['answer'].lower().strip()

    try:
        with open(f'{results_dir}/task_{tid_fmt}_depth.answer') as f:
            d_ans = f.read().strip().lower()
    except: d_ans = 'ERROR'

    try:
        with open(f'{results_dir}/task_{tid_fmt}_nodepth.answer') as f:
            n_ans = f.read().strip().lower()
    except: n_ans = 'ERROR'

    d_ok = correct in d_ans or d_ans in correct
    n_ok = correct in n_ans or n_ans in correct

    if d_ok: correct_d += 1
    if n_ok: correct_n += 1

    sd = '✓' if d_ok else '✗'
    sn = '✓' if n_ok else '✗'
    print(f'  T{tid:2d} [{t[\"type\"]:10s}] correct={correct:20s} | depth:{sd} {d_ans[:20]:20s} | noD:{sn} {n_ans[:20]:20s}')
    results.append({'id':tid, 'type':t['type'], 'correct':correct, 'depth':d_ans, 'nodepth':n_ans, 'd_ok':d_ok, 'n_ok':n_ok})

n = len(results)
print()
print(f'DEPTH:    {correct_d}/{n} ({100*correct_d/n:.0f}%)')
print(f'NO DEPTH: {correct_n}/{n} ({100*correct_n/n:.0f}%)')
print()

# By type
by_type = {}
for r in results:
    t = r['type']
    if t not in by_type: by_type[t] = {'d':0,'n':0,'total':0}
    by_type[t]['total'] += 1
    if r['d_ok']: by_type[t]['d'] += 1
    if r['n_ok']: by_type[t]['n'] += 1

for t,v in sorted(by_type.items()):
    print(f'  {t:12s}: depth {v[\"d\"]}/{v[\"total\"]} | nodepth {v[\"n\"]}/{v[\"total\"]}')

# Save
with open(f'{results_dir}/summary.json', 'w') as f:
    json.dump({'depth': correct_d, 'nodepth': correct_n, 'total': n, 'by_type': by_type, 'results': results}, f, indent=2)
print(f'\nSaved to {results_dir}/summary.json')
"
