const STAGES = [
  {
    n: 1,
    label: 'PROBLEM',
    body: '"Will these boxes fit into this container? Where is the empty slot?"',
    tag: 'text-only',
  },
  {
    n: 2,
    label: 'SKETCH',
    body: 'LLM writes VOXI — a few lines of B x y z w h d color. Each line is a shape, not a pixel.',
    tag: 'generate',
  },
  {
    n: 3,
    label: 'RENDER',
    body: 'Mind\'s Eye raycasts six axis-aligned views. Each pixel becomes a depth digit 0–9 or "·".',
    tag: 'raycast',
  },
  {
    n: 4,
    label: 'READ',
    body: 'LLM reads the six ASCII grids like six paragraphs. Monotonic depth ⇒ no overlap. "·" column ⇒ gap.',
    tag: 'perceive',
  },
  {
    n: 5,
    label: 'DECIDE',
    body: 'Anomaly (gap, overflow, overlap)? Revise the sketch and loop. Otherwise commit the answer.',
    tag: 'verify',
  },
]

export default function ReasoningFlow({ activeView, onHoverStage }) {
  return (
    <ol className="flow">
      {STAGES.map((s, i) => (
        <li
          key={s.n}
          className="flow-step"
          onMouseEnter={() => onHoverStage?.(s.n)}
        >
          <div className="flow-num">{s.n}</div>
          <div className="flow-body">
            <div className="flow-head">
              <h3>{s.label}</h3>
              <span className="flow-tag">{s.tag}</span>
            </div>
            <p>{s.body}</p>
          </div>
          {i < STAGES.length - 1 && <div className="flow-arrow">↓</div>}
        </li>
      ))}
    </ol>
  )
}
