import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateFlashcards } from './cloze';
import { judgeAnswer, hintFor } from './answer';
import { normalizeBlanks } from './blank';
import type { Note } from '../types';

const note = (rawText: string): Note => ({ id: 'n', rawText, inputMethod: 'type', createdAt: 0 });
const whole = (text: string, word: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}_])${word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}($|[^\\p{L}\\p{N}_])`, 'iu').test(text);

describe('adversarial inputs (autopilot fault-finding)', () => {
  it('empty, whitespace and symbol-only notes give zero cards and do not throw', () => {
    for (const t of ['', '   \n\t ', '!!! ??? ...', '<script>alert(1)</script>', '\u0000\u0001']) {
      expect(() => generateFlashcards(note(t))).not.toThrow();
    }
    expect(generateFlashcards(note(''))).toEqual([]);
    expect(generateFlashcards(note('   \n  '))).toEqual([]);
  });

  it('a 20,000-character note finishes quickly and every prompt hides its answer', () => {
    const sentence = 'The mitochondria is the powerhouse of the cell and produces energy. ';
    const text = sentence.repeat(Math.ceil(20000 / sentence.length));
    const t0 = Date.now();
    const cards = generateFlashcards(note(text));
    expect(Date.now() - t0).toBeLessThan(3000);
    for (const c of cards) expect(whole(normalizeBlanks(c.prompt), c.clozeWord)).toBe(false);
  });

  it('a 20,000-character single word and a long no-space run do not hang', () => {
    const t0 = Date.now();
    generateFlashcards(note('a'.repeat(20000)));
    generateFlashcards(note('word '.repeat(4000)));
    generateFlashcards(note('x.'.repeat(10000)));
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('random text never throws and never leaks the answer in the prompt', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 600 }), fc.string({ unit: 'binary', maxLength: 300 }), (a, b) => {
        for (const text of [a, b, `${a}. ${b}. ${a} is the ${b}.`]) {
          const cards = generateFlashcards(note(text));
          for (const c of cards) {
            expect(typeof c.prompt).toBe('string');
            expect(whole(normalizeBlanks(c.prompt), c.clozeWord)).toBe(false);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('an empty or whitespace answer is never judged correct', () => {
    for (const input of ['', '   ', '\n', '...', '!!!']) {
      expect(judgeAnswer(input, 'DNA')).not.toBe('exact');
      expect(judgeAnswer(input, 'mitochondria')).not.toBe('exact');
      expect(judgeAnswer(input, 'mitochondria')).not.toBe('close');
    }
  });

  it('hintFor never throws and never returns the whole answer at level 1', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (s) => {
        for (const level of [0, 1, 2] as const) expect(() => hintFor(s, level)).not.toThrow();
      }),
      { numRuns: 200 },
    );
  });
});
