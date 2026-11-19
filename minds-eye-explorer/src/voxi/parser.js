// Browser-safe VOXI parser — subset that covers packing demos (V,B,S,C,K,E,P).

const CKEYS = '0123456789abcdef'

const parseColor = (s) => {
  if (s === undefined) return 9
  if (/^[a-f]$/i.test(s)) return CKEYS.indexOf(s.toLowerCase())
  const n = Number(s)
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 15) : 9
}

export function parseVoxi(code) {
  let W = 32, H = 32, D = 32
  const voxels = new Map()

  const set = (x, y, z, c) => {
    const ix = Math.round(x), iy = Math.round(y), iz = Math.round(z)
    if (ix < 0 || ix >= W || iy < 0 || iy >= H || iz < 0 || iz >= D) return
    voxels.set(`${ix},${iy},${iz}`, Math.min(Math.max(c ?? 9, 0), 15))
  }

  const box = (px, py, pz, w, h, d, c) => {
    for (let x = px; x < px + w; x++)
      for (let y = py; y < py + h; y++)
        for (let z = pz; z < pz + d; z++) set(x, y, z, c)
  }

  const sphere = (cx, cy, cz, r, c) => {
    const r2 = r * r
    for (let x = cx - r; x <= cx + r; x++)
      for (let y = cy - r; y <= cy + r; y++)
        for (let z = cz - r; z <= cz + r; z++)
          if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r2) set(x, y, z, c)
  }

  const cyl = (cx, cy, cz, r, h, c) => {
    const r2 = r * r
    for (let x = cx - r; x <= cx + r; x++)
      for (let z = cz - r; z <= cz + r; z++)
        if ((x - cx) ** 2 + (z - cz) ** 2 <= r2)
          for (let y = cy; y < cy + h; y++) set(x, y, z, c)
  }

  const cone = (cx, cy, cz, r, h, c) => {
    for (let y = 0; y < h; y++) {
      const rr = r * (1 - y / h), rr2 = rr * rr
      for (let x = cx - r; x <= cx + r; x++)
        for (let z = cz - r; z <= cz + r; z++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= rr2) set(x, cy + y, z, c)
    }
  }

  const ellipsoid = (cx, cy, cz, rx, ry, rz, c) => {
    for (let x = cx - rx; x <= cx + rx; x++)
      for (let y = cy - ry; y <= cy + ry; y++)
        for (let z = cz - rz; z <= cz + rz; z++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1)
            set(x, y, z, c)
  }

  const lines = code.split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('--') || line.startsWith('//')) continue
    const p = line.split(/\s+/)
    const cmd = p[0].toUpperCase()
    if (cmd === 'V') {
      W = Number(p[1]) || 32
      H = Number(p[2]) || 32
      D = Number(p[3]) || 32
      continue
    }
    const args = p.slice(1)
    const n = args.map((s, i) => (i === args.length - 1 ? parseColor(s) : Number(s)))
    switch (cmd) {
      case 'B': box(n[0], n[1], n[2], n[3], n[4], n[5], n[6]); break
      case 'S': sphere(n[0], n[1], n[2], n[3], n[4]); break
      case 'C': cyl(n[0], n[1], n[2], n[3], n[4], n[5]); break
      case 'K': cone(n[0], n[1], n[2], n[3], n[4], n[5]); break
      case 'E': ellipsoid(n[0], n[1], n[2], n[3], n[4], n[5], n[6]); break
      case 'P': set(n[0], n[1], n[2], n[3]); break
      default: break
    }
  }

  return { W, H, D, voxels }
}

export const COLORS = [
  '#0a0a0f', // 0 black
  '#ef4444', // 1 red
  '#22c55e', // 2 green
  '#3b82f6', // 3 blue
  '#06b6d4', // 4 cyan
  '#d946ef', // 5 magenta
  '#facc15', // 6 yellow
  '#fb923c', // 7 orange
  '#f8fafc', // 8 white
  '#6b7280', // 9 gray
  '#92400e', // 10 brown
  '#fb7185', // 11 pink
  '#166534', // 12 dark-green
  '#d6bfa0', // 13 tan
  '#7f1d1d', // 14 maroon
  '#1e3a8a', // 15 navy
]

export const COLOR_NAMES = [
  'black','red','green','blue','cyan','magenta','yellow','orange',
  'white','gray','brown','pink','dark-green','tan','maroon','navy',
]
