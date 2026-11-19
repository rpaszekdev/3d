import { useMemo } from 'react'
import { renderAllViews, VIEWS } from '../voxi/mindsEye.js'

const DEPTH_PALETTE = [
  '#f8fafc', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
  '#0ea5e9', '#0369a1', '#1e40af', '#1e3a8a', '#0c1d4a',
]

function colorize(ch) {
  if (ch === '.') return <span className="ascii-empty">·</span>
  const d = parseInt(ch, 10)
  if (Number.isNaN(d)) return ch
  return <span style={{ color: DEPTH_PALETTE[d] ?? '#fff' }}>{ch}</span>
}

function ViewPanel({ name, view, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`ascii-panel ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(name)}
    >
      <div className="ascii-panel-head">{name.toUpperCase()}</div>
      <pre className="ascii-grid">
        {view.rows.map((row, i) => (
          <div key={i} className="ascii-row">
            {row.split(' ').map((ch, j) => (
              <span key={j} className="ascii-cell">{colorize(ch)}</span>
            ))}
          </div>
        ))}
      </pre>
    </button>
  )
}

export default function AsciiReader({ scene, selected, onSelect }) {
  const views = useMemo(() => renderAllViews(scene), [scene])
  return (
    <div className="ascii-reader">
      <div className="ascii-legend">
        <span className="ascii-legend-item"><span style={{ color: DEPTH_PALETTE[0] }}>0</span> front surface</span>
        <span className="ascii-legend-item"><span style={{ color: DEPTH_PALETTE[4] }}>4</span> mid</span>
        <span className="ascii-legend-item"><span style={{ color: DEPTH_PALETTE[9] }}>9</span> back</span>
        <span className="ascii-legend-item"><span className="ascii-empty">·</span> empty ray</span>
      </div>
      <div className="ascii-grid-row">
        {VIEWS.map((v) => (
          <ViewPanel
            key={v}
            name={v}
            view={views[v]}
            selected={selected === v}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
