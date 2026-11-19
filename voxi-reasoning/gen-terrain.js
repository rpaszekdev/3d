import FastNoiseLite from 'fastnoise-lite';
import fs from 'fs';

const W = 32, H = 16, D = 32, seed = 42;
const noise = new FastNoiseLite(seed);
noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
noise.SetFrequency(0.05);

const lines = [`V ${W} ${H} ${D}`, '-- Terrain seed=42'];

for (let x = 0; x < W; x++)
  for (let z = 0; z < D; z++) {
    const n = noise.GetNoise(x, z) * 0.5 + 0.5;
    const height = Math.floor(n * H * 0.8) + 1;
    for (let y = 0; y < height && y < H; y++) {
      let c;
      if (y === height - 1) c = 2;
      else if (y > height - 3) c = 'a';
      else c = 9;
      lines.push(`P ${x} ${y} ${z} ${c}`);
    }
  }

fs.writeFileSync('voxi-reasoning/terrain.voxi', lines.join('\n'));
console.log(lines.length + ' lines');
