const fmt = (n) => n.toLocaleString()

export default function WhyItMatters({ stats }) {
  const asciiSave = Math.round((1 - stats.asciiTokens / stats.denseTokens) * 100)
  const imgVsVoxi = Math.round(stats.imageBytes / stats.voxiBytes)

  const rows = [
    {
      k: 'VOXI source',
      v: fmt(stats.voxiBytes) + ' B',
      t: fmt(stats.voxiTokens) + ' tok',
      note: 'what the LLM writes',
      strong: true,
    },
    {
      k: 'Mind\'s Eye ASCII (6 views)',
      v: fmt(stats.asciiChars) + ' B',
      t: fmt(stats.asciiTokens) + ' tok',
      note: 'what the LLM reads back',
      strong: true,
    },
    {
      k: 'Naive dense voxel dump',
      v: fmt(stats.denseChars) + ' B',
      t: fmt(stats.denseTokens) + ' tok',
      note: 'every cell, every frame',
    },
    {
      k: '6× 256² RGB images',
      v: fmt(stats.imageBytes) + ' B',
      t: '—',
      note: 'what a vision model would need',
    },
  ]

  return (
    <div className="why">
      <div className="why-grid">
        <Card title="Compact by design">
          <p>
            The whole scene is <b>{stats.voxiBytes} bytes</b> of VOXI —
            about <b>{stats.voxiTokens} tokens</b>. The LLM writes it,
            the LLM reads it. No image pipeline.
          </p>
        </Card>
        <Card title="Perception without vision">
          <p>
            Six depth maps totalling <b>{fmt(stats.asciiTokens)}&nbsp;tokens</b> —
            <b> {asciiSave}%</b> smaller than a raw voxel dump — let a text-only model
            detect overlap, gaps, and silhouettes the same way a person reads a floor plan.
          </p>
        </Card>
        <Card title="Image baseline">
          <p>
            Rendering the same scene as <b>6&nbsp;images</b> at 256² would be
            ~<b>{fmt(stats.imageBytes)}&nbsp;B</b> —
            roughly <b>{fmt(imgVsVoxi)}×</b> the VOXI source. And a text model can't
            read pixels at all.
          </p>
        </Card>
      </div>
      <table className="why-table">
        <thead>
          <tr><th>Representation</th><th>Bytes</th><th>Tokens</th><th>Role</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className={r.strong ? 'is-strong' : ''}>
              <td>{r.k}</td>
              <td className="num">{r.v}</td>
              <td className="num">{r.t}</td>
              <td className="note">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  )
}
