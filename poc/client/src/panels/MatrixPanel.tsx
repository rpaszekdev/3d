import { SpatialMatrix } from '../matrix/SpatialMatrix';
import { COL, MAX_SLOTS } from '../matrix/constants';

interface Props {
  readonly matrix: SpatialMatrix;
}

const COL_NAMES = ['x', 'y', 'w', 'h', 'type', 'r', 'g', 'b', 'rot', '⚡', 'z'];

export function MatrixPanel({ matrix }: Props) {
  const alive = matrix.aliveSlots();

  return (
    <div className="panel matrix-panel">
      <div className="panel-header">
        MATRIX S ∈ R<sup>32×11</sup>
        <span className="badge">{alive.length} alive</span>
      </div>
      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>slot</th>
              {COL_NAMES.map(name => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: MAX_SLOTS }, (_, i) => {
              const isAlive = matrix.isAlive(i);
              const row = matrix.getRow(i);
              return (
                <tr key={i} className={isAlive ? 'alive-row' : 'dead-row'}>
                  <td className="slot-col">
                    <span className="slot-label">S[{i}]</span>
                    {isAlive && (
                      <span className="shape-badge">{matrix.shapeName(i)}</span>
                    )}
                  </td>
                  {row.map((val, j) => (
                    <td key={j} className={j === COL.ALIVE ? (val === 1 ? 'alive-cell' : 'dead-cell') : ''}>
                      {isAlive ? Math.round(val) : '·'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
