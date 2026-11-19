// Semantic size keywords → fractions of parent container
// Combined with aspect modifiers for final dimensions

import type { SizeKeyword } from './types';

// Base size = fraction of parent dimension (both w and h)
const BASE_SIZES: Readonly<Record<string, number>> = {
  tiny:   0.05,
  small:  0.12,
  medium: 0.20,
  large:  0.35,
  huge:   0.60,
  full:   0.95,
};

// Aspect modifiers multiply one axis
const ASPECT_MODIFIERS: Readonly<Record<string, { wMul: number; hMul: number }>> = {
  thin: { wMul: 0.3, hMul: 1.0 },
  flat: { wMul: 1.0, hMul: 0.3 },
  tall: { wMul: 1.0, hMul: 1.8 },
  wide: { wMul: 1.8, hMul: 1.0 },
};

export function resolveSize(
  keywords: readonly SizeKeyword[],
  parentW: number,
  parentH: number,
): { w: number; h: number } {
  // Find base size keyword (default: medium)
  let baseFraction = BASE_SIZES['medium'];
  for (const kw of keywords) {
    if (kw in BASE_SIZES) {
      baseFraction = BASE_SIZES[kw];
    }
  }

  let w = parentW * baseFraction;
  let h = parentH * baseFraction;

  // Apply all aspect modifiers
  for (const kw of keywords) {
    const mod = ASPECT_MODIFIERS[kw];
    if (mod) {
      w *= mod.wMul;
      h *= mod.hMul;
    }
  }

  // Clamp to valid range
  const MIN = 10;
  w = Math.max(MIN, Math.min(w, parentW - 8));
  h = Math.max(MIN, Math.min(h, parentH - 8));

  return { w: Math.round(w), h: Math.round(h) };
}
