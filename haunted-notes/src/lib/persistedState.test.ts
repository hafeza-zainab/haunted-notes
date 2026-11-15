import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeNotes, sanitizeFlashcards, sanitizeUi } from './persistedState';

describe('persistedState', () => {
  it('non-arrays give empty lists', () => {
    for (const v of [null, undefined, 'x', 5, {}, { a: 1 }]) {
      expect(sanitizeNotes(v)).toEqual([]);
      expect(sanitizeFlashcards(v, 0)).toEqual([]);
    }
  });

  it('drops null, primitive and incomplete items and duplicate ids', () => {
    const note = { id: 'a', rawText: 't', inputMethod: 'type', createdAt: 1 };
    expect(sanitizeNotes([null, 5, 'x', {}, { id: 'a' }, note, { ...note }])).toEqual([note]);
  });

  it('returns valid notes and cards as the same object', () => {
    const note = { id: 'a', rawText: 't', inputMethod: 'type', createdAt: 1 };
    expect(sanitizeNotes([note])[0]).toBe(note);
    const card = { id: 'c', noteId: 'a', sentence: 's', clozeWord: 'w', prompt: 'p', weaknessScore: 0.5, streakCorrect: 0, streakWrong: 0, lastReviewed: null, ease: 2.5, intervalDays: 0, dueAt: 0, reps: 0 };
    expect(sanitizeFlashcards([card], 0)[0]).toBe(card);
  });

  it('fills missing SRS fields and bad numbers on legacy cards', () => {
    const legacy = { id: 'c', noteId: 'a', sentence: 's', clozeWord: 'w', prompt: 'p', weaknessScore: Number.NaN };
    const [fixed] = sanitizeFlashcards([legacy], 1000);
    expect(fixed.ease).toBe(2.5);
    expect(fixed.dueAt).toBe(1000);
    expect(fixed.weaknessScore).toBe(1);
    expect(fixed.lastReviewed).toBeNull();
  });

  it('sanitizeUi keeps only well-typed settings', () => {
    expect(sanitizeUi({ currentView: 'hack', soundEnabled: 'yes', quizNoteId: 5, quizDueOnly: true })).toEqual({ quizDueOnly: true });
    expect(sanitizeUi('x')).toEqual({});
  });

  it('Feature: persisted-state, any input yields valid lists and never throws', () => {
    fc.assert(
      fc.property(fc.anything(), fc.jsonValue(), (a, b) => {
        for (const v of [a, b]) {
          for (const n of sanitizeNotes(v)) {
            expect(typeof n.id).toBe('string');
            expect(typeof n.rawText).toBe('string');
          }
          for (const c of sanitizeFlashcards(v, 0)) {
            expect(Number.isFinite(c.ease)).toBe(true);
            expect(Number.isFinite(c.weaknessScore)).toBe(true);
          }
          expect(() => sanitizeUi(v)).not.toThrow();
        }
      }),
      { numRuns: 300 },
    );
  });
});
