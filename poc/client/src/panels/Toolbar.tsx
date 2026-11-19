import type { DrawingTool } from '../types';

interface Props {
  readonly tool: DrawingTool;
  readonly onToolChange: (tool: DrawingTool) => void;
  readonly color: [number, number, number];
  readonly onColorChange: (color: [number, number, number]) => void;
  readonly onClear: () => void;
  readonly shapeCount: number;
}

const TOOLS: { id: DrawingTool; label: string; icon: string }[] = [
  { id: 'rect', label: 'Rectangle', icon: '▭' },
  { id: 'circle', label: 'Circle', icon: '○' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'triangle', label: 'Triangle', icon: '△' },
];

const PALETTE: { color: [number, number, number]; name: string }[] = [
  { color: [74, 144, 226], name: 'blue' },
  { color: [231, 76, 60], name: 'red' },
  { color: [46, 204, 113], name: 'green' },
  { color: [155, 89, 182], name: 'purple' },
  { color: [241, 196, 15], name: 'yellow' },
  { color: [230, 126, 34], name: 'orange' },
  { color: [236, 240, 241], name: 'white' },
  { color: [52, 73, 94], name: 'dark' },
];

export function Toolbar({ tool, onToolChange, color, onColorChange, onClear, shapeCount }: Props) {
  return (
    <div className="toolbar">
      <div className="tool-group">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => onToolChange(t.id)}
            title={t.label}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-name">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="color-group">
        {PALETTE.map(p => (
          <button
            key={p.name}
            className={`color-swatch ${arrEq(color, p.color) ? 'active' : ''}`}
            style={{ backgroundColor: `rgb(${p.color.join(',')})` }}
            onClick={() => onColorChange(p.color)}
            title={p.name}
          />
        ))}
      </div>

      <div className="tool-actions">
        <span className="shape-count">{shapeCount}/32</span>
        <button className="clear-btn" onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}

function arrEq(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
