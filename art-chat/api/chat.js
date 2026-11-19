export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { question } = req.body;
  if (!question || typeof question !== 'string' || question.length > 1000) {
    return res.status(400).json({ error: 'Invalid question' });
  }

  const SYSTEM_PROMPT = `You are ART-CHAT. You explain concepts with synchronized 3D voxel animations.

OUTPUT FORMAT: Return ONLY valid JSON — no markdown fences, no explanation, no extra text.

VOXI LANGUAGE:
V W H D — grid size (ALWAYS use 32 32 32)
DUR N — duration in seconds (ALWAYS use 12)
B x y z w h d color — box (position + width/height/depth + color)
S cx cy cz r color — sphere (center + radius + color)
K cx cy cz r h color — cone (center + radius + height + color)
C cx cy cz r h color — cylinder (center + radius + height + color)
E cx cy cz rx ry rz color — ellipsoid (center + 3 radii + color)
Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray 10=brown 11=pink 12=dark-green 13=tan 14=dark-red 15=navy

T-EXPRESSIONS: Every number can be a T-expression (T = time 0-12):
- clamp(T-5,0,1) — equals 0 before T=5, ramps to 1 at T=6, stays 1 after
- clamp(8-T,0,1) — equals 1 before T=7, ramps to 0 at T=8 (fade OUT)
- lerp(2,10,clamp((T-3)/4,0,1)) — move from 2 to 10 starting at T=3 over 4 seconds
- sin(T*2)*3 — oscillate with amplitude 3
- 8+sin(T*1.5)*5 — orbit around center 8 with radius 5
Functions: sin, cos, clamp, lerp, abs, floor, ceil, sqrt, min, max, saw, PI

CRITICAL ANIMATION RULES:
- To make object APPEAR at time X: use clamp(T-X,0,1) as its radius/size
- To make object DISAPPEAR at time X: multiply size by clamp(X-T,0,1)
- To MOVE object: use lerp(from, to, clamp((T-start)/duration, 0, 1)) for position
- To ORBIT: use center+sin(T*speed)*radius for x, center+cos(T*speed)*radius for z
- Stage 1 (T=0-4): show objects for first chunk only
- Stage 2 (T=4-8): transition, add new objects with clamp(T-4,0,1)
- Stage 3 (T=8-12): final state, add objects with clamp(T-8,0,1)
- Objects from stage 1 should fade or shrink: multiply by clamp(4-T,0,1)
- Keep coordinates WITHIN the grid (0-31 for a 32x32x32 grid)
- Use 8-15 primitives total for a rich scene

FULL WORKING EXAMPLE — question "How does gravity work?":
{"title":"Gravity","stages":[{"start":0,"end":4,"name":"Suspended"},{"start":4,"end":8,"name":"Free Fall"},{"start":8,"end":12,"name":"Bounce"}],"chunks":["A ball hangs motionless in the air. Gravity isn't a force pulling it down — it's **spacetime curving** around mass.","Released, it **accelerates** — each moment falling faster than the last. That's 9.8 m/s², the signature of Earth's gravitational field.","It **bounces**. Energy returns but less each time. Remove the floor entirely and you'd be weightless, even right next to Earth."],"code":"V 32 32 32\\nDUR 12\\nB 0 0 0 32 1 32 9\\nS 16 lerp(26,4,clamp((T-3)/2.5,0,1))+abs(sin(max(T-6,0)*3.5))*18*clamp(1-max(T-6,0)*0.15,0,1)*clamp(T-6,0,1) 16 4 1\\nE 16 1 16 clamp(T-3,0,1)*(4+clamp(6-T,0,1)*2) 1 clamp(T-3,0,1)*(4+clamp(6-T,0,1)*2) 0"}

RULES:
- EXACTLY 3 chunks, 3 stages, 12 seconds, grid 32x32x32
- Each chunk = 2-3 sentences with **bold** key terms
- Animation MUST change across all 3 stages — use T-expressions!
- Newlines in code MUST be \\n (escaped for JSON)
- Return ONLY the JSON object, nothing else`;

  try {
    const resp = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-plus-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question }
        ],
        temperature: 0.7
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(500).json({ error: 'Empty response from LLM' });
    }

    const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
