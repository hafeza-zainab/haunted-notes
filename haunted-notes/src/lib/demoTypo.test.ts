import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { typoOf } from './demoTypo';
import { TYPO_MIN_LENGTH, judgeAnswer, normaliseAnswer, withinOneEdit } from './answer';
import { buildDemoData } from './demoData';

describe('typoOf', () => {
  it('long demo answers become a typo the quiz still accepts as close', () => {
    for (const c of buildDemoData().flashcards) {
      const w = c.clozeWord;
      if (normaliseAnswer(w).length >= TYPO_MIN_LENGTH) {
        const typo = typoOf(w);
        expect(typo, w).not.toBe(w);
        expect(judgeAnswer(typo, w), w).toBe('close');
      }
    }
  });

  it('short demo answers are returned unchanged, so they stay an exact match', () => {
    for (const c of buildDemoData().flashcards) {
      const w = c.clozeWord;
      if (normaliseAnswer(w).length < TYPO_MIN_LENGTH) {
        expect(typoOf(w), w).toBe(w);
        expect(judgeAnswer(typoOf(w), w), w).toBe('exact');
      }
    }
  });

  it('covers every card in the built-in demo: at least one long and one short answer exist', () => {
    const lens = buildDemoData().flashcards.map((c) => normaliseAnswer(c.clozeWord).length);
    expect(lens.some((n) => n >= TYPO_MIN_LENGTH)).toBe(true);
    expect(lens.some((n) => n < TYPO_MIN_LENGTH)).toBe(true);
  });

  it('avoids picking the same letter, including x and X', () => {
    expect(typoOf('xxxxxxx')).not.toBe('xxxxxxx');
    expect(typoOf('XXXXXXX')).not.toBe('XXXXXXX');
    expect(judgeAnswer(typoOf('xxxxxxx'), 'xxxxxxx')).toBe('close');
  });
});

describe('typoOf properties', () => {
  const longWord = fc.stringMatching(/^[A-Za-z][A-Za-z-]{4,18}[A-Za-z]$/);

  it('a long answer is always exactly one edit away and judged close', () => {
    fc.assert(
      fc.property(longWord, (w) => {
        fc.pre(normaliseAnswer(w).length >= TYPO_MIN_LENGTH);
        const t = typoOf(w);
        expect(t).not.toBe(w);
        expect(t.length).toBe(w.length);
        expect(withinOneEdit(normaliseAnswer(t), normaliseAnswer(w))).toBe(true);
        expect(judgeAnswer(t, w)).toBe('close');
      }),
    );
  });

  it('a short answer is never changed', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: TYPO_MIN_LENGTH - 1 }), (w) => {
        expect(typoOf(w)).toBe(w);
      }),
    );
  });

  it('never throws, for any string', () => {
    fc.assert(
      fc.property(fc.string(), (w) => {
        expect(() => typoOf(w)).not.toThrow();
      }),
    );
  });
});
