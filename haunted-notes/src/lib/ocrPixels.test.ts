import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { boostContrast, applyGreyContrast, toGrey, CONTRAST_FACTOR } from './ocrPixels';

describe('ocrPixels', () => {
  it('keeps mid-grey and does not threshold mid-tones to pure black or white', () => {
    expect(boostContrast(128)).toBe(128);
    const v = boostContrast(150);
    expect(v).toBeGreaterThan(150);
    expect(v).toBeLessThan(255);
  });

  it('clamps and handles non-finite input', () => {
    expect(boostContrast(0)).toBe(0);
    expect(boostContrast(255)).toBe(255);
    expect(boostContrast(Number.NaN)).toBe(0);
  });

  it('leaves alpha untouched and writes equal R, G, B', () => {
    const data = new Uint8ClampedArray([10, 200, 30, 77, 255, 255, 255, 5]);
    applyGreyContrast(data);
    expect(data[3]).toBe(77);
    expect(data[7]).toBe(5);
    expect(data[0]).toBe(data[1]);
    expect(data[1]).toBe(data[2]);
  });

  it('Feature: ocr-quality, output is always in 0-255 and keeps the order of greys', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (a, b) => {
        const x = boostContrast(a);
        const y = boostContrast(b);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(255);
        if (a <= b) expect(x).toBeLessThanOrEqual(y);
      }),
      { numRuns: 200 },
    );
    expect(toGrey(255, 255, 255)).toBeCloseTo(255, 5);
    expect(CONTRAST_FACTOR).toBeGreaterThan(1);
  });
});
