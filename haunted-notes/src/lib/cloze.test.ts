import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateFlashcards, STOP_WORDS } from './cloze';
import type { Note } from '../types';

// ── Generators ────────────────────────────────────────────────────────────────
// A small word pool on purpose: it makes repeated words, stop-words, acronyms,
// capitalised terms and number-like tokens all common in generated notes.

const stopWordArb = fc.constantFrom(...Array.from(STOP_WORDS).slice(0, 40));
const plainWordArb = fc.constantFrom(
  'java', 'class', 'object', 'memory', 'process', 'energy', 'market', 'search',
  'engine', 'cell', 'division', 'compiler', 'bytecode', 'object-oriented',
);
const capitalWordArb = fc.constantFrom('Java', 'Photosynthesis', 'Mitosis', 'Google', 'Content');
const acronymArb = fc.constantFrom('JVM', 'DNA', 'SEO', 'HTML', 'API');
const numberArb = fc.constantFrom(
  '42', '2024', '3.5', '123.456', '2020-2024', '1000000', '10.5.2', '0.001',
);
const versionArb = fc.constantFrom('v3.2', 'H2O', 'Node20', '4.0.6x');

const wordArb = fc.oneof(
  { weight: 4, arbitrary: stopWordArb },
  { weight: 4, arbitrary: plainWordArb },
  { weight: 2, arbitrary: capitalWordArb },
  { weight: 1, arbitrary: acronymArb },
  { weight: 2, arbitrary: numberArb },
  { weight: 1, arbitrary: versionArb },
);

const sentenceArb = fc
  .tuple(
    fc.array(wordArb, { minLength: 1, maxLength: 40 }),
    fc.constantFrom('.', '!', '?', ''),
    fc.constantFrom('', '- ', '* ', '1. '),
  )
  .map(([words, end, bullet]) => bullet + words.join(' ') + end);

const noteTextArb = fc
  .array(sentenceArb, { minLength: 1, maxLength: 8 })
  .chain((sentences) =>
    fc.constantFrom('\n', ' ').map((sep) => sentences.join(sep)),
  );

function noteFor(rawText: string): Note {
  return { id: 'note-test', rawText, inputMethod: 'type', createdAt: 0 };
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `word` appears in `text` as a whole word (case-insensitive). */
function containsWholeWord(text: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegex(word)}\\b`, 'i').test(text);
}

// ── Properties ────────────────────────────────────────────────────────────────

describe('generateFlashcards', () => {
  it('the blank is never a stop-word', () => {
    fc.assert(
      fc.property(noteTextArb, (text) => {
        for (const card of generateFlashcards(noteFor(text))) {
          expect(STOP_WORDS.has(card.clozeWord.toLowerCase())).toBe(false);
        }
      }),
    );
  });

  it('the blank is never a number', () => {
    fc.assert(
      fc.property(noteTextArb, (text) => {
        for (const card of generateFlashcards(noteFor(text))) {
          // A number has digits and no letters (covers 42, 3.5, 2020-2024, 123.456).
          const isNumber = /\d/.test(card.clozeWord) && !/[A-Za-z]/.test(card.clozeWord);
          expect(isNumber).toBe(false);
        }
      }),
    );
  });

  it('the prompt never contains the answer', () => {
    fc.assert(
      fc.property(noteTextArb, (text) => {
        for (const card of generateFlashcards(noteFor(text))) {
          expect(containsWholeWord(card.prompt, card.clozeWord)).toBe(false);
        }
      }),
    );
  });

  it('no card is created from fewer than 8 words', () => {
    fc.assert(
      fc.property(noteTextArb, (text) => {
        for (const card of generateFlashcards(noteFor(text))) {
          expect(wordCount(card.sentence)).toBeGreaterThanOrEqual(8);
        }
      }),
    );
  });

  it('every card starts new and belongs to the note', () => {
    fc.assert(
      fc.property(noteTextArb, (text) => {
        for (const card of generateFlashcards(noteFor(text))) {
          expect(card.noteId).toBe('note-test');
          expect(card.reps).toBe(0);
          expect(card.weaknessScore).toBe(1);
          expect(card.lastReviewed).toBeNull();
        }
      }),
    );
  });
});

describe('generateFlashcards: concrete cases', () => {
  it('blanks every occurrence of a repeated answer', () => {
    const cards = generateFlashcards(
      noteFor('The Java language is popular because Java programs run on many different devices.'),
    );
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(containsWholeWord(card.prompt, card.clozeWord)).toBe(false);
    }
  });
});
