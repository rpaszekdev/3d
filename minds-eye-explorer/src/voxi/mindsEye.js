// Mind's Eye — 6-angle depth raycaster. Pure text output, identical logic
// to voxi-reasoning/minds-eye.js but ported to browser.

export const VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom']

function buildGrid({ W, H, D, voxels }) {
  const grid = new Int8Array(W * H * D).fill(-1)
  const idx = (x, y, z) => x + y * W + z * W * H
  for (const [k, c] of voxels) {
    const [x, y, z] = k.split(',').map(Number)
    grid[idx(x, y, z)] = c
  }
  return { grid, idx, W, H, D }
}

function projectView(g, view) {
  const { grid, idx, W, H, D } = g
  let viewW, viewH, maxDepth, getVoxel

  switch (view) {
    case 'front':
      viewW = W; viewH = H; maxDepth = D
      getVoxel = (col, row, d) => grid[idx(col, H - 1 - row, d)]
      break
    case 'back':
      viewW = W; viewH = H; maxDepth = D
      getVoxel = (col, row, d) => grid[idx(W - 1 - col, H - 1 - row, D - 1 - d)]
      break
    case 'right':
      viewW = D; viewH = H; maxDepth = W
      getVoxel = (col, row, d) => grid[idx(W - 1 - d, H - 1 - row, col)]
      break
    case 'left':
      viewW = D; viewH = H; maxDepth = W
      getVoxel = (col, row, d) => grid[idx(d, H - 1 - row, D - 1 - col)]
      break
    case 'top':
      viewW = W; viewH = D; maxDepth = H
      getVoxel = (col, row, d) => grid[idx(col, H - 1 - d, D - 1 - row)]
      break
    case 'bottom':
      viewW = W; viewH = D; maxDepth = H
      getVoxel = (col, row, d) => grid[idx(col, d, row)]
      break
    default:
      return { rows: [], viewW: 0, viewH: 0 }
  }

  const rows = []
  for (let row = 0; row < viewH; row++) {
    const line = []
    for (let col = 0; col < viewW; col++) {
      let hitDepth = -1
      for (let d = 0; d < maxDepth; d++) {
        if (getVoxel(col, row, d) >= 0) { hitDepth = d; break }
      }
      if (hitDepth < 0) line.push('.')
      else {
        const q = maxDepth <= 1 ? 0 : Math.round((hitDepth * 9) / (maxDepth - 1))
        line.push(String(q))
      }
    }
    rows.push(line.join(' '))
  }
  return { rows, viewW, viewH }
}

export function renderAllViews(scene) {
  const g = buildGrid(scene)
  const out = {}
  for (const v of VIEWS) out[v] = projectView(g, v)
  return out
}

export function renderView(scene, view) {
  return projectView(buildGrid(scene), view)
}

// Compare depth-ascii size (chars) vs a naive dense grid dump (chars) vs
// a naive RGB image baseline (pixels * 3 bytes). Used for "why it matters".
export function sizeStats(code, scene) {
  const { W, H, D, voxels } = scene
  const denseCells = W * H * D
  const denseChars = denseCells * 2 // "hex + space" per cell
  const asciiChars = VIEWS
    .map((v) => renderView(scene, v))
    .reduce((acc, { rows }) => acc + rows.reduce((a, r) => a + r.length + 1, 0), 0)
  const imagePixels = 6 * 256 * 256 // 6 views @ 256×256
  const imageBytes = imagePixels * 3
  const voxiBytes = new Blob([code]).size
  // Rough token estimate: ~4 chars/token
  const voxiTokens = Math.ceil(voxiBytes / 4)
  const asciiTokens = Math.ceil(asciiChars / 4)
  const denseTokens = Math.ceil(denseChars / 4)
  return {
    voxelCount: voxels.size,
    gridCells: denseCells,
    voxiBytes,
    voxiTokens,
    asciiChars,
    asciiTokens,
    denseChars,
    denseTokens,
    imageBytes,
  }
}
