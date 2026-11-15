/**
 * Pure pixel helpers for OCR preprocessing (no DOM). Kept separate from ocr.ts so they can be tested.
 */

/** Mild contrast factor: 1 = unchanged. Tesseract does its own binarisation, so no hard threshold. */
export const CONTRAST_FACTOR = 1.3;

/** Luminance-weighted greyscale (ITU-R BT.601). */
export function toGrey(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Stretch a 0-255 grey value around mid-grey, clamped to 0-255. Non-finite input gives 0. */
export function boostContrast(grey: number, factor: number = CONTRAST_FACTOR): number {
  if (!Number.isFinite(grey) || !Number.isFinite(factor)) return 0;
  const v = (grey - 128) * factor + 128;
  return Math.min(255, Math.max(0, Math.round(v)));
}

/** Greyscale plus mild contrast boost, in place, on RGBA data. Alpha is untouched. */
export function applyGreyContrast(data: Uint8ClampedArray, factor: number = CONTRAST_FACTOR): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const v = boostContrast(toGrey(data[i], data[i + 1], data[i + 2]), factor);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}
