import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  TYPO_MIN_LENGTH,
  normaliseAnswer,
  withinOneEdit,
  judgeAnswer,
  hintFor,
  type HintLevel,
} from './answer';

// ── Generators ────────────────────────────────────────────────────────────────

const letters = 'abcdefghijklmnopqrstuvwxyz';
const letterArb = fc.constantFrom(...letters.split(''));

/** A normalised answer of a given length range (lowercase letters only). */
const wordArb = (min: number, max: number) =>
  fc.array(letterArb, { minLength: min, maxLength: max }).map((a) => a.join(''));

const longWordArb = wordArb(TYPO_MIN_LENGTH, 14);
const shortWordArb = wordArb(3, TYPO_MIN_LENGTH - 1);

/** One edit applied to a word: substitute, insert or delete one letter. */
function oneEdit(word: string, kind: number, pos: number, ch: string): string {
  const p = pos % word.length;
  if (kind === 0) {
    // Substitute with a different letter
    const other = ch === word[p] ? (ch === 'a' ? 'b' : 'a') : ch;
    return word.slice(0, p) + other + word.slice(p + 1);
  }
  if (kind === 1) return word.slice(0, p) + ch + word.slice(p); // insert
  return word.slice(0, p) + word.slice(p + 1);                  // delete
}

const editArb = fc.record({
  kind: fc.integer({ min: 0, max: 2 }),
  pos: fc.nat(100),
  ch: letterArb,
});

// ── normaliseAnswer ───────────────────────────────────────────────────────────

describe('normaliseAnswer', () => {
  it('ignores case, surrounding spaces and surrounding punctuation', () => {
    expect(normaliseAnswer('  JVM. ')).toBe('jvm');
    expect(normaliseAnswer('"Photosynthesis!"')).toBe('photosynthesis');
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normaliseAnswer(normaliseAnswer(s))).toBe(normaliseAnswer(s));
      }),
    );
  });
});

// ── withinOneEdit ─────────────────────────────────────────────────────────────

describe('withinOneEdit', () => {
  it('is symmetric', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 }), (a, b) => {
        expect(withinOneEdit(a, b)).toBe(withinOneEdit(b, a));
      }),
    );
  });

  it('accepts any single substitution, insertion or deletion', () => {
    fc.assert(
      fc.property(longWordArb, editArb, (word, e) => {
        expect(withinOneEdit(word, oneEdit(word, e.kind, e.pos, e.ch))).toBe(true);
      }),
    );
  });

  it('rejects two edits that cannot collapse into one', () => {
    expect(withinOneEdit('abcdef', 'abXdYf')).toBe(false);
    expect(withinOneEdit('abcdef', 'abcdefgh')).toBe(false);
    expect(withinOneEdit('abcdef', 'bcde')).toBe(false);
  });
});

// ── judgeAnswer ───────────────────────────────────────────────────────────────

describe('judgeAnswer', () => {
  it('an exact match (any case, with punctuation) is exact', () => {
    fc.assert(
      fc.property(wordArb(1, 14), (w) => {
        expect(judgeAnswer(w, w)).toBe('exact');
        expect(judgeAnswer(` ${w.toUpperCase()}. `, w)).toBe('exact');
      }),
    );
  });

  it('answers of 6+ letters accept one typo as close', () => {
    fc.assert(
      fc.property(longWordArb, editArb, (word, e) => {
        const typo = oneEdit(word, e.kind, e.pos, e.ch);
        fc.pre(normaliseAnswer(typo) !== word);
        expect(judgeAnswer(typo, word)).toBe('close');
      }),
    );
  });

  it('answers under 6 letters must match exactly: one typo is wrong', () => {
    fc.assert(
      fc.property(shortWordArb, editArb, (word, e) => {
        const typo = oneEdit(word, e.kind, e.pos, e.ch);
        fc.pre(normaliseAnswer(typo) !== word);
        expect(judgeAnswer(typo, word)).toBe('wrong');
      }),
    );
  });

  it('never accepts an answer two or more edits away', () => {
    fc.assert(
      fc.property(longWordArb, editArb, editArb, (word, e1, e2) => {
        const twice = oneEdit(oneEdit(word, e1.kind, e1.pos, e1.ch), e2.kind, e2.pos, e2.ch);
        // Only check pairs that are really more than one edit apart
        fc.pre(!withinOneEdit(twice, word));
        expect(judgeAnswer(twice, word)).toBe('wrong');
      }),
    );
  });

  it('the boundary is exactly 6 letters', () => {
    expect(judgeAnswer('mitosi', 'mitosis')).toBe('close'); // 7 letters, one deletion
    expect(judgeAnswer('dnaa', 'dna')).toBe('wrong');       // 3 letters
    expect(judgeAnswer('statically', 'statically')).toBe('exact');
    expect(judgeAnswer('bluprint', 'blueprint')).toBe('close');
  });
});

// ── hintFor ───────────────────────────────────────────────────────────────────

describe('hintFor', () => {
  const answerArb = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), {
      minLength: 3,
      maxLength: 16,
    })
    .map((a) => a.join(''));

  it('level 0 shows nothing', () => {
    fc.assert(
      fc.property(answerArb, (a) => {
        expect(hintFor(a, 0)).toBe('');
      }),
    );
  });

  it('never contains the whole answer, at any level', () => {
    fc.assert(
      fc.property(answerArb, fc.constantFrom<HintLevel>(1, 2), (a, level) => {
        const hint = hintFor(a, level).toLowerCase();
        const re = new RegExp(`(^|[^\\w])${a.toLowerCase().replace(/[-]/g, '\\-')}($|[^\\w])`);
        expect(re.test(hint)).toBe(false);
      }),
    );
  });

  it('the wording itself is never the answer (words that appear in the hint text)', () => {
    for (const word of ['letters', 'starts', 'with']) {
      for (const level of [1, 2] as const) {
        const hint = hintFor(word, level).toLowerCase();
        expect(new RegExp(`(^|[^\\w])${word}($|[^\\w])`).test(hint)).toBe(false);
      }
    }
  });

  it('level 1 shows the first letter; level 2 adds the length', () => {
    expect(hintFor('Photosynthesis', 1)).toContain('“P”');
    expect(hintFor('Photosynthesis', 2)).toContain('14');
    expect(hintFor('JVM', 2)).toContain('3');
  });
});
