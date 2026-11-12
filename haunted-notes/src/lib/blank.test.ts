import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { BLANK, normalizeBlanks } from './blank';

// Text without underscores, so runs in the input are exactly the ones we insert.
const textArb = fc.string({ maxLength: 20 }).map((s) => s.replace(/_/g, ' '));

describe('normalizeBlanks', () => {
  it('the result is independent of the run length (2 or more underscores)', () => {
    fc.assert(
      fc.property(
        textArb,
        textArb,
        fc.integer({ min: 2, max: 60 }),
        fc.integer({ min: 2, max: 60 }),
        (before, after, n, m) => {
          expect(normalizeBlanks(`${before}${'_'.repeat(n)}${after}`)).toBe(
            normalizeBlanks(`${before}${'_'.repeat(m)}${after}`),
          );
        },
      ),
    );
  });

  it('every run of underscores in the output is the fixed blank', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(textArb, fc.integer({ min: 2, max: 40 }).map((n) => '_'.repeat(n)))),
        (parts) => {
          const runs = normalizeBlanks(parts.join(' ')).match(/_+/g) ?? [];
          for (const run of runs) expect(run).toBe(BLANK);
        },
      ),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeBlanks(normalizeBlanks(s))).toBe(normalizeBlanks(s));
      }),
    );
  });

  it('leaves a single underscore and text without underscores alone', () => {
    expect(normalizeBlanks('snake_case word')).toBe('snake_case word');
    fc.assert(
      fc.property(textArb, (s) => {
        expect(normalizeBlanks(s)).toBe(s);
      }),
    );
  });

  it('turns old length-matched blanks into the fixed blank', () => {
    expect(normalizeBlanks('___ stands for deoxyribonucleic acid.')).toBe(
      `${BLANK} stands for deoxyribonucleic acid.`,
    );
    expect(normalizeBlanks('______________ is the process.')).toBe(`${BLANK} is the process.`);
  });
});
