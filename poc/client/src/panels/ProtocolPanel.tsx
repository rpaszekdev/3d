import type { ProtocolEntry } from '../types';

interface Props {
  readonly entries: readonly ProtocolEntry[];
}

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  ssl_sent: { label: 'SSL SENT', className: 'proto-sent' },
  tool_call: { label: 'TOOL CALL', className: 'proto-tool' },
  tool_result: { label: 'TOOL RESULT', className: 'proto-result' },
  ai_response: { label: 'AI RESPONSE', className: 'proto-ai' },
  error: { label: 'ERROR', className: 'proto-error' },
};

export function ProtocolPanel({ entries }: Props) {
  return (
    <div className="panel protocol-panel">
      <div className="panel-header">
        PROTOCOL TRANSPARENCY
        <span className="badge transparency-badge">NO ENGLISH DESCRIPTIONS</span>
      </div>
      <div className="protocol-scroll">
        {entries.length === 0 ? (
          <div className="proto-empty">
            <p>Draw shapes on the canvas, then ask AI to interact.</p>
            <p>This panel proves that Claude receives ONLY numerical matrix data (via SSL notation) — never English scene descriptions.</p>
          </div>
        ) : (
          entries.map(entry => {
            const { label, className } = TYPE_LABELS[entry.type] ?? { label: entry.type, className: '' };
            return (
              <div key={entry.id} className={`proto-entry ${className}`}>
                <div className="proto-header">
                  <span className="proto-label">{label}</span>
                  <span className="proto-time">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="proto-content">{entry.content}</pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
