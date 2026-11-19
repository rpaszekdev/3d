// Convert ARC grid to VOXI code (flat, y=0 slice)
export function arcToVoxi(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const lines = [`V ${w} 2 ${h}`];
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const c = grid[row][col];
      if (c > 0) {
        const z = h - 1 - row; // flip so row 0 = top = high Z
        lines.push(`P ${col} 0 ${z} ${c}`);
      }
    }
  }
  return lines.join('\n');
}

// Convert VOXI grid back to ARC grid
export function voxiToArc(vm, w, h) {
  const grid = Array.from({length: h}, () => Array(w).fill(0));
  for (const [key, color] of vm) {
    const [x, y, z] = key.split(',').map(Number);
    if (y === 0) {
      const row = h - 1 - z;
      if (row >= 0 && row < h && x >= 0 && x < w) {
        grid[row][x] = typeof color === 'number' ? color : parseInt(color, 16);
      }
    }
  }
  return grid;
}

// Pretty print ARC grid
export function printGrid(grid, label = '') {
  if (label) console.log(label);
  for (const row of grid) {
    console.log(row.map(c => c === 0 ? '.' : c.toString()).join(' '));
  }
}
