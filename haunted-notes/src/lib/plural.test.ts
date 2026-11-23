import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { countLabel } from './plural';

describe('countLabel', () => {
  it('uses the singular only for exactly 1', () => {
    expect(countLabel(1, 'note')).toBe('1 note');
    expect(countLabel(0, 'note')).toBe('0 notes');
    expect(countLabel(2, 'note')).toBe('2 notes');
    expect(countLabel(1, 'review event')).toBe('1 review event');
    expect(countLabel(3, 'review event')).toBe('3 review events');
  });

  it('accepts an irregular plural', () => {
    expect(countLabel(1, 'mouse', 'mice')).toBe('1 mouse');
    expect(countLabel(4, 'mouse', 'mice')).toBe('4 mice');
  });

  it('Feature: pluralization, singular for 1 and plural for every other count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (n) => {
        const out = countLabel(n, 'card');
        expect(out.startsWith(`${n} `)).toBe(true);
        expect(out.endsWith(n === 1 ? ' card' : ' cards')).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
