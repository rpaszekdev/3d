#!/usr/bin/env python3
"""
run-benchmark.py — Run the temporal-spatial benchmark via Claude CLI
Sends tasks to subagents (via claude CLI) and scores results automatically.

Usage: python3 run-benchmark.py test-videos/benchmark-30.json --max 30
"""
import json
import sys
import subprocess
import re

def ask_claude(prompt, model="sonnet"):
    """Call claude CLI and get response."""
    result = subprocess.run(
        ["claude", "-m", model, "-p", prompt, "--no-input"],
        capture_output=True, text=True, timeout=60
    )
    return result.stdout.strip()

def build_depth_prompt(task):
    """Build prompt WITH depth matrices."""
    frames_text = ""
    for frame_id, view in sorted(task['depthViews'].items(), key=lambda x: int(x[0])):
        frames_text += f"\n{view}\n"

    diff_text = ""
    if task.get('diffs'):
        for key, diff in task['diffs'].items():
            diff_text += f"\n{diff}\n"

    return f"""You are analyzing a 3D scene represented as depth text matrices (20x20 grid, 0=close 9=far .=empty). Objects appear as clusters of low depth values on a table surface.

Here are the depth views of the scene:
{frames_text}
{f"Frame diffs:{diff_text}" if diff_text else ""}

QUESTION: {task['question']}
CHOICES: {task['choices']}

Analyze the depth matrices carefully. Pick the best answer from the choices.
Reply with ONLY the answer text, exactly matching one of the choices. Nothing else."""

def build_nodepth_prompt(task):
    """Build prompt WITHOUT depth matrices — only the VOXI code."""
    return f"""You are analyzing a 3D voxel scene. Here is the VOXI code that defines the scene:

```
{task['code']}
```

VOXI reference: V=grid size, B X Y Z W H D C=box, S X Y Z R C=sphere. Y=UP. Colors: 1=red 2=green 3=blue 5=magenta 6=yellow 7=orange 9=gray. T N=animation frame.

QUESTION: {task['question']}
CHOICES: {task['choices']}

Analyze the VOXI code carefully. Pick the best answer from the choices.
Reply with ONLY the answer text, exactly matching one of the choices. Nothing else."""


def extract_answer(response, choices):
    """Extract the answer from LLM response."""
    response = response.strip()
    # Direct match
    for choice in choices:
        if response.lower() == choice.lower():
            return choice
    # Partial match
    for choice in choices:
        if choice.lower() in response.lower():
            return choice
    return response


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 run-benchmark.py <benchmark.json> [--max N]")
        sys.exit(1)

    benchmark_path = sys.argv[1]
    max_tasks = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[2] == '--max' else 999

    with open(benchmark_path) as f:
        data = json.load(f)

    tasks = data['tasks'][:max_tasks]
    print(f"Running {len(tasks)} tasks from {benchmark_path}")
    print(f"Seed: {data['seed']}, Grid: {data['gridSize']}")
    print()

    results = []
    correct_depth = 0
    correct_nodepth = 0

    for task in tasks:
        tid = task['id']
        ttype = task['type']
        correct = task['answer']
        choices = task['choices']

        print(f"Task {tid:2d} [{ttype:10s}] {task['question'][:60]}...")

        # WITH depth
        try:
            depth_prompt = build_depth_prompt(task)
            depth_response = ask_claude(depth_prompt)
            depth_answer = extract_answer(depth_response, choices)
            depth_correct = depth_answer.lower() == correct.lower()
        except Exception as e:
            depth_answer = f"ERROR: {e}"
            depth_correct = False

        # WITHOUT depth
        try:
            nodepth_prompt = build_nodepth_prompt(task)
            nodepth_response = ask_claude(nodepth_prompt)
            nodepth_answer = extract_answer(nodepth_response, choices)
            nodepth_correct = nodepth_answer.lower() == correct.lower()
        except Exception as e:
            nodepth_answer = f"ERROR: {e}"
            nodepth_correct = False

        if depth_correct: correct_depth += 1
        if nodepth_correct: correct_nodepth += 1

        status_d = "✓" if depth_correct else "✗"
        status_n = "✓" if nodepth_correct else "✗"
        print(f"  Correct: {correct:20s} | Depth: {status_d} {depth_answer:20s} | NoDepth: {status_n} {nodepth_answer:20s}")

        results.append({
            'id': tid, 'type': ttype, 'correct': correct,
            'depth_answer': depth_answer, 'depth_correct': depth_correct,
            'nodepth_answer': nodepth_answer, 'nodepth_correct': nodepth_correct,
        })

    # Summary
    n = len(results)
    print()
    print("=" * 60)
    print(f"RESULTS: {n} tasks")
    print(f"  WITH depth:    {correct_depth}/{n} ({100*correct_depth/n:.0f}%)")
    print(f"  WITHOUT depth: {correct_nodepth}/{n} ({100*correct_nodepth/n:.0f}%)")
    print()

    # By type
    by_type = {}
    for r in results:
        t = r['type']
        if t not in by_type:
            by_type[t] = {'depth': 0, 'nodepth': 0, 'total': 0}
        by_type[t]['total'] += 1
        if r['depth_correct']: by_type[t]['depth'] += 1
        if r['nodepth_correct']: by_type[t]['nodepth'] += 1

    print("By type:")
    for t, v in sorted(by_type.items()):
        print(f"  {t:12s}: depth {v['depth']}/{v['total']} ({100*v['depth']/v['total']:.0f}%)  |  nodepth {v['nodepth']}/{v['total']} ({100*v['nodepth']/v['total']:.0f}%)")

    # Save results
    out_path = benchmark_path.replace('.json', '-results.json')
    with open(out_path, 'w') as f:
        json.dump({
            'summary': {
                'total': n,
                'depth_correct': correct_depth, 'depth_pct': round(100*correct_depth/n, 1),
                'nodepth_correct': correct_nodepth, 'nodepth_pct': round(100*correct_nodepth/n, 1),
            },
            'by_type': by_type,
            'results': results,
        }, f, indent=2)
    print(f"\nResults saved to {out_path}")


if __name__ == "__main__":
    main()
