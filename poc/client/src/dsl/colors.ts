// Named color palette with shade variants
// Resolves "forest.dark" → [20, 100, 20]

type RGB = readonly [number, number, number];

interface ColorShades {
  readonly base: RGB;
  readonly light: RGB;
  readonly dark: RGB;
}

const PALETTE: Readonly<Record<string, ColorShades>> = {
  red:      { base: [231, 76, 60],    light: [255, 130, 120], dark: [180, 40, 30] },
  orange:   { base: [243, 156, 18],   light: [255, 195, 80],  dark: [190, 110, 10] },
  yellow:   { base: [241, 196, 15],   light: [255, 230, 80],  dark: [200, 160, 0] },
  gold:     { base: [212, 175, 55],   light: [240, 210, 100], dark: [160, 130, 30] },
  green:    { base: [46, 204, 113],   light: [120, 235, 160], dark: [30, 150, 70] },
  forest:   { base: [39, 120, 60],    light: [70, 160, 90],   dark: [20, 80, 35] },
  teal:     { base: [26, 188, 156],   light: [80, 220, 190],  dark: [15, 140, 110] },
  cyan:     { base: [52, 152, 219],   light: [110, 195, 240], dark: [30, 110, 180] },
  blue:     { base: [74, 144, 226],   light: [130, 185, 245], dark: [40, 100, 180] },
  sky:      { base: [135, 206, 235],  light: [180, 230, 250], dark: [90, 160, 200] },
  ocean:    { base: [0, 105, 148],    light: [50, 150, 190],  dark: [0, 70, 100] },
  navy:     { base: [30, 40, 90],     light: [60, 75, 130],   dark: [15, 20, 55] },
  purple:   { base: [155, 89, 182],   light: [195, 140, 215], dark: [110, 50, 140] },
  violet:   { base: [127, 0, 255],    light: [170, 80, 255],  dark: [80, 0, 180] },
  pink:     { base: [255, 105, 180],  light: [255, 160, 210], dark: [200, 60, 130] },
  rose:     { base: [200, 80, 100],   light: [230, 130, 145], dark: [150, 45, 65] },
  brown:    { base: [139, 90, 43],    light: [180, 140, 90],  dark: [90, 55, 20] },
  wood:     { base: [160, 120, 70],   light: [200, 165, 115], dark: [110, 75, 35] },
  bark:     { base: [100, 70, 40],    light: [140, 110, 75],  dark: [60, 40, 20] },
  rust:     { base: [183, 65, 14],    light: [220, 110, 60],  dark: [130, 40, 5] },
  cream:    { base: [255, 253, 208],  light: [255, 255, 235], dark: [230, 225, 170] },
  sand:     { base: [210, 190, 150],  light: [235, 220, 185], dark: [170, 150, 110] },
  white:    { base: [255, 255, 255],  light: [255, 255, 255], dark: [220, 220, 220] },
  gray:     { base: [149, 165, 166],  light: [190, 200, 200], dark: [100, 110, 115] },
  charcoal: { base: [54, 69, 79],     light: [90, 105, 115],  dark: [30, 40, 48] },
  slate:    { base: [112, 128, 144],  light: [155, 170, 185], dark: [70, 85, 100] },
  black:    { base: [20, 20, 20],     light: [60, 60, 60],    dark: [5, 5, 5] },
  stone:    { base: [168, 163, 150],  light: [200, 195, 185], dark: [120, 115, 105] },
  steel:    { base: [130, 140, 150],  light: [170, 180, 190], dark: [85, 95, 105] },
  copper:   { base: [184, 115, 51],   light: [220, 160, 100], dark: [130, 75, 25] },
  silver:   { base: [192, 192, 192],  light: [220, 220, 220], dark: [150, 150, 150] },
  olive:    { base: [128, 128, 0],    light: [170, 170, 50],  dark: [85, 85, 0] },
  coral:    { base: [255, 127, 80],   light: [255, 170, 135], dark: [210, 85, 45] },
  salmon:   { base: [250, 128, 114],  light: [255, 170, 160], dark: [200, 85, 70] },
  peach:    { base: [255, 218, 185],  light: [255, 240, 220], dark: [220, 180, 145] },
  mint:     { base: [152, 255, 152],  light: [190, 255, 195], dark: [100, 200, 105] },
  lavender: { base: [180, 130, 230],  light: [210, 170, 250], dark: [130, 80, 190] },
  ivory:    { base: [255, 255, 240],  light: [255, 255, 250], dark: [230, 228, 210] },
  snow:     { base: [240, 245, 255],  light: [250, 252, 255], dark: [210, 215, 230] },
};

const DEFAULT_COLOR: RGB = [149, 165, 166]; // gray

export function resolveColor(name: string): RGB {
  if (!name) return DEFAULT_COLOR;

  // Handle hex colors: #RRGGBB or #RGB
  if (name.startsWith('#')) {
    return hexToRgb(name);
  }

  // Split "forest.dark" → ["forest", "dark"]
  const parts = name.split('.');
  const colorName = parts[0].toLowerCase();
  const shade = (parts[1]?.toLowerCase() ?? 'base') as keyof ColorShades;

  const entry = PALETTE[colorName];
  if (!entry) return DEFAULT_COLOR;

  return entry[shade] ?? entry.base;
}

function hexToRgb(hex: string): RGB {
  const h = hex.slice(1);
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
