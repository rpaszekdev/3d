import { useEffect, useMemo, useRef, useState } from 'react'
import { parseVoxi } from '../voxi/parser.js'
import { renderView } from '../voxi/mindsEye.js'
import { FRAMES } from '../data/reasoningFrames.js'
import VoxelViewer from './VoxelViewer.jsx'

const DEPTH_PALETTE = [
  '#f8fafc','#e0f2fe','#bae6fd','#7dd3fc','#38bdf8',
  '#0ea5e9','#0369a1','#1e40af','#1e3a8a','#0c1d4a',
]

function AsciiBlock({ view }) {
  return (
    <pre className="ascii-grid ascii-grid-lg">
      {view.rows.map((row, i) => (
        <div key={i} className="ascii-row">
          {row.split(' ').map((ch, j) => {
            if (ch === '.') return <span key={j} className="ascii-cell ascii-empty">·</span>
            const d = parseInt(ch, 10)
            return (
              <span
                key={j}
                className="ascii-cell"
                style={{ color: DEPTH_PALETTE[d] ?? '#fff' }}
              >
                {ch}
              </span>
            )
          })}
        </div>
      ))}
    </pre>
  )
}

function CodeDiff({ cumulative, added }) {
  const lines = cumulative.split('\n')
  const addedLines = new Set(added ? added.split('\n').filter(Boolean) : [])
  return (
    <pre className="code-block code-block-compact">
      {lines.map((line, i) => {
        const isComment = line.trim().startsWith('--')
        const isNew = addedLines.has(line.trim())
        return (
          <div
            key={i}
            className={`code-line ${isComment ? 'is-comment' : ''} ${isNew ? 'is-new' : ''}`}
          >
            <span className="code-lineno">{String(i + 1).padStart(2, ' ')}</span>
            <span className="code-content">{line || ' '}</span>
          </div>
        )
      })}
    </pre>
  )
}

export default function ReasoningTab() {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef(null)

  const frame = FRAMES[idx]
  const scene = useMemo(() => parseVoxi(frame.cumulative), [frame.cumulative])
  const depthView = useMemo(
    () => renderView(scene, frame.view),
    [scene, frame.view]
  )

  useEffect(() => {
    if (!playing) return
    timerRef.current = setTimeout(() => {
      setIdx((i) => {
        if (i >= FRAMES.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 2400)
    return () => clearTimeout(timerRef.current)
  }, [idx, playing])

  return (
    <div className="reasoning-tab">
      <div className="reason-frame-head">
        <div>
          <div className="frame-idx">
            FRAME {idx + 1} / {FRAMES.length}
          </div>
          <h2 className="frame-title">{frame.title}</h2>
        </div>
        <div className="frame-controls">
          <button
            className="ctrl-btn"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
          >◀ Prev</button>
          <button
            className="ctrl-btn ctrl-play"
            onClick={() => {
              if (idx >= FRAMES.length - 1) setIdx(0)
              setPlaying((p) => !p)
            }}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button
            className="ctrl-btn"
            onClick={() => setIdx((i) => Math.min(FRAMES.length - 1, i + 1))}
            disabled={idx === FRAMES.length - 1}
          >Next ▶</button>
          <button
            className="ctrl-btn ctrl-ghost"
            onClick={() => { setPlaying(false); setIdx(0) }}
          >↺ Reset</button>
        </div>
      </div>

      <div className="frame-progress">
        {FRAMES.map((f, i) => (
          <button
            key={f.id}
            className={`tick ${i === idx ? 'is-active' : ''} ${i < idx ? 'is-done' : ''}`}
            onClick={() => { setPlaying(false); setIdx(i) }}
            title={f.title}
          >
            <span>{i}</span>
          </button>
        ))}
      </div>

      <div className="frame-thought">
        <div className="thought-label">Claude (inner monologue)</div>
        <p>{frame.thought}</p>
      </div>

      <div className="frame-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Scene so far</h2>
            <span className="panel-sub">{scene.W}×{scene.H}×{scene.D} · {scene.voxels.size} voxels</span>
          </div>
          <VoxelViewer scene={scene} highlightView={frame.view} autoRotate={false} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Mind's Eye · {frame.view.toUpperCase()}</h2>
            <span className="panel-sub">depth 0 → front, 9 → back, · empty</span>
          </div>
          <div className="frame-ascii">
            <AsciiBlock view={depthView} />
            <p className="frame-note">{frame.note}</p>
          </div>
        </div>

        <div className="panel panel-full">
          <div className="panel-head">
            <h2>VOXI code written this step</h2>
            <span className="panel-sub">
              {frame.added
                ? `+${frame.added.split('\n').filter(Boolean).length} line(s)`
                : 'no new code — re-reading from a different angle'}
            </span>
          </div>
          <CodeDiff cumulative={frame.cumulative} added={frame.added} />
        </div>
      </div>
    </div>
  )
}
