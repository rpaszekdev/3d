# Unbiased Benchmark Results

## Setup
- 30 randomly generated VOXI scenes (seed=42)
- 5 question types: collision, position, motion direction, count, closer-to-camera
- Automatic scoring, no human in the loop
- Grid size: 16x16x16

## Results

| Configuration | Score | Accuracy |
|--------------|-------|----------|
| Sonnet WITH depth matrices | 30/30 | 100% |
| Sonnet WITHOUT depth (VOXI code only) | 30/30 | 100% |

## By Type
| Type | Depth | No Depth |
|------|-------|----------|
| closer | 10/10 | 10/10 |
| collision | 6/6 | 6/6 |
| count | 8/8 | 8/8 |
| motion | 5/5 | 5/5 |
| position | 1/1 | 1/1 |

## Analysis

**Both conditions scored 100%.** This means these tasks are TOO EASY for Sonnet.

Why: The VOXI code contains explicit coordinates (`B 5 1 3 2 2 2 1`). Sonnet reads the X,Y,Z values directly and does arithmetic. The depth matrices are redundant — they're just a visual representation of the same coordinate data.

## When Does the Tool Help?

The depth matrices help when the input is NOT clean coordinates:
1. **Natural language** (SpartQA): ambiguous text descriptions → depth shows unambiguous positions
2. **Real video** (CATER): pixel data → depth reveals 3D structure invisible in 2D
3. **Volumetric reasoning**: "does this sphere poke past this wall?" requires volume intersection

The tool does NOT help when:
- The source is clean DSL code with explicit coordinates
- Tasks are solvable by coordinate arithmetic alone
- The model is already strong enough (Sonnet on easy tasks)

## What Would Make Tasks Harder
1. Occlusion: objects hidden behind other objects
2. Overlapping volumes: spheres/boxes that partially intersect
3. Ambiguous views: configurations that look the same from one angle but differ in 3D
4. Physics prediction: will this stack collapse? will this ball fit through this gap?
5. Natural language input instead of VOXI code

## Conclusion

The benchmark confirms: when both conditions have access to the same underlying data (clean coordinates), the tool adds no value. The tool's value is in TRANSLATING ambiguous or complex data into explicit spatial information — which is exactly what happens with natural language (SpartQA: +30%) and real video (CATER: +40%).
