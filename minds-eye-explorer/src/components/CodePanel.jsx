export default function CodePanel({ code, stats }) {
  const lines = code.split('\n')
  const nonEmpty = lines.filter((l) => l.trim() && !l.trim().startsWith('--')).length

  return (
    <div className="code-panel">
      <div className="code-stats">
        <Stat label="VOXI lines" value={nonEmpty} unit={`/ ${lines.length} total`} />
        <Stat label="VOXI bytes" value={stats.voxiBytes} unit="chars" />
        <Stat label="≈ tokens" value={stats.voxiTokens} unit="(4 chars/token)" />
        <Stat label="Materialized voxels" value={stats.voxelCount.toLocaleString()} unit={`in ${stats.gridCells.toLocaleString()} cells`} />
      </div>
      <pre className="code-block">
        {lines.map((line, i) => (
          <div key={i} className={`code-line ${line.trim().startsWith('--') ? 'is-comment' : ''}`}>
            <span className="code-lineno">{String(i + 1).padStart(2, ' ')}</span>
            <span className="code-content">{line || ' '}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}

function Stat({ label, value, unit }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {unit && <div className="stat-unit">{unit}</div>}
    </div>
  )
}
