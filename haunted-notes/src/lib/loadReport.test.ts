import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assessSavedValue, needsBackup, planBackup, noticeText, BACKUP_KEY } from './loadReport';

const note = { id: 'n1', rawText: 'text', inputMethod: 'type', createdAt: 1 };
const card = {
  id: 'c1', noteId: 'n1', sentence: 's', clozeWord: 'w', prompt: 'p', weaknessScore: 0.5,
  streakCorrect: 0, streakWrong: 0, lastReviewed: null, ease: 2.5, intervalDays: 0, dueAt: 0, reps: 0,
};
const wrap = (state: unknown) => JSON.stringify({ state, version: 0 });

describe('assessSavedValue', () => {
  it('nothing saved, or valid data, gives no loss', () => {
    for (const raw of [null, undefined, '', wrap({ notes: [], flashcards: [] }), wrap({ notes: [note], flashcards: [card] }), 'null', wrap(undefined)]) {
      const r = assessSavedValue(raw);
      expect(r.dropped).toBe(0);
      expect(r.unreadable).toBe(false);
      expect(needsBackup(r)).toBe(false);
    }
  });

  it('a legacy card missing SRS fields is repaired, not dropped', () => {
    const legacy = { id: 'c', noteId: 'n1', sentence: 's', clozeWord: 'w', prompt: 'p', weaknessScore: 1 };
    expect(assessSavedValue(wrap({ notes: [note], flashcards: [legacy] })).dropped).toBe(0);
  });

  it('counts malformed notes and cards', () => {
    const r = assessSavedValue(wrap({ notes: [note, null, 5], flashcards: [card, { id: 'x' }, 'y'] }));
    expect(r.dropped).toBe(4);
    expect(needsBackup(r)).toBe(true);
  });

  it('counts duplicate ids as dropped', () => {
    expect(assessSavedValue(wrap({ notes: [note, { ...note }], flashcards: [] })).dropped).toBe(1);
  });

  it('a list that is not an array counts as one dropped item; null counts as none', () => {
    expect(assessSavedValue(wrap({ notes: 'x', flashcards: { a: 1 } })).dropped).toBe(2);
    expect(assessSavedValue(wrap({ notes: null, flashcards: null })).dropped).toBe(0);
  });

  it('invalid JSON or a wrong overall shape is unreadable', () => {
    for (const raw of ['{not json', '"hello"', '5', '[1,2]', wrap('oops')]) {
      const r = assessSavedValue(raw);
      expect(r.unreadable).toBe(true);
      expect(needsBackup(r)).toBe(true);
    }
  });
});

describe('planBackup', () => {
  const bad = '{not json';
  it('returns the raw value exactly when a backup is needed and none exists', () => {
    expect(planBackup(bad, assessSavedValue(bad), null)).toBe(bad);
  });
  it('never overwrites an existing backup', () => {
    expect(planBackup(bad, assessSavedValue(bad), 'older backup')).toBeNull();
    expect(planBackup(bad, assessSavedValue(bad), '')).toBeNull();
  });
  it('writes nothing for valid data', () => {
    const ok = wrap({ notes: [note], flashcards: [card] });
    expect(planBackup(ok, assessSavedValue(ok), null)).toBeNull();
  });
  it('uses a separate key', () => {
    expect(BACKUP_KEY).toBe('haunted-notes-storage-backup');
  });
});

describe('noticeText', () => {
  it('uses counts only and singular or plural', () => {
    expect(noticeText({ dropped: 1, unreadable: false, backedUp: true })).toBe('1 saved item could not be loaded; a backup copy was kept.');
    expect(noticeText({ dropped: 2, unreadable: false, backedUp: true })).toBe('2 saved items could not be loaded; a backup copy was kept.');
  });
  it('does not claim a backup when none could be saved', () => {
    expect(noticeText({ dropped: 2, unreadable: false, backedUp: false })).not.toMatch(/was kept/);
    expect(noticeText({ dropped: 0, unreadable: true, backedUp: false })).not.toMatch(/was kept/);
  });
});

describe('properties', () => {
  it('Feature: safer-loading, any string never throws and the report is consistent', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 300 }), fc.jsonValue(), fc.option(fc.string(), { nil: null }), (s, j, existing) => {
        for (const raw of [s, JSON.stringify(j), wrap(j), wrap({ notes: j, flashcards: j })]) {
          const r = assessSavedValue(raw);
          expect(Number.isInteger(r.dropped)).toBe(true);
          expect(r.dropped).toBeGreaterThanOrEqual(0);
          const plan = planBackup(raw, r, existing);
          if (plan !== null) {
            expect(plan).toBe(raw);
            expect(needsBackup(r)).toBe(true);
            expect(existing).toBeNull();
          }
          if (!needsBackup(r)) expect(plan).toBeNull();
          expect(typeof noticeText({ ...r, backedUp: true })).toBe('string');
        }
      }),
      { numRuns: 300 },
    );
  });

  it('Feature: safer-loading, well-formed data produces no notice and no backup', () => {
    const noteArb = fc.record({ id: fc.string({ minLength: 1 }), rawText: fc.string(), inputMethod: fc.constantFrom('type', 'mic', 'photo', 'audio'), createdAt: fc.integer({ min: 0, max: 2 ** 40 }) });
    fc.assert(
      fc.property(fc.uniqueArray(noteArb, { selector: (n) => n.id, maxLength: 20 }), (notes) => {
        const raw = wrap({ notes, flashcards: [] });
        const r = assessSavedValue(raw);
        expect(r.dropped).toBe(0);
        expect(r.unreadable).toBe(false);
        expect(planBackup(raw, r, null)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it('Feature: safer-loading, dropped equals the number of injected bad items', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 15 }), fc.integer({ min: 0, max: 15 }), (good, bad) => {
        const notes = [
          ...Array.from({ length: good }, (_, i) => ({ ...note, id: `n${i}` })),
          ...Array.from({ length: bad }, (_, i) => (i % 2 === 0 ? null : { id: i })),
        ];
        expect(assessSavedValue(wrap({ notes, flashcards: [] })).dropped).toBe(bad);
      }),
      { numRuns: 150 },
    );
  });
});
