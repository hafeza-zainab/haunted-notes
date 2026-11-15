import { describe, it, expect } from 'vitest';
import { buildExport, serializeExport, parseBackupText, mergeBackup, BACKUP_LIMITS } from './backup';
import { defaultSrsFields } from './srs';
import { weakestRooms } from './insights';
import type { Flashcard, Note, ReviewEvent } from '../types';

describe('import at the documented limits (autopilot fault-finding)', () => {
  it('validates and merges a maximum-size backup quickly, and a second import adds nothing', () => {
    const notes: Note[] = Array.from({ length: BACKUP_LIMITS.notes }, (_, i) => ({ id: `n${i}`, rawText: `Note ${i} text.`, inputMethod: 'type', createdAt: i }));
    const flashcards: Flashcard[] = Array.from({ length: BACKUP_LIMITS.flashcards }, (_, i) => ({
      id: `c${i}`, noteId: `n${i % BACKUP_LIMITS.notes}`, sentence: `Sentence number ${i} here.`, clozeWord: `word${i}`, prompt: `Sentence number ${i} _____.`,
      weaknessScore: (i % 10) / 10, streakCorrect: 0, streakWrong: 0, lastReviewed: null, ...defaultSrsFields(0),
    }));
    const events: ReviewEvent[] = Array.from({ length: 500 }, (_, i) => ({ t: i, r: `n${i % 5}`, c: (i % 2) as 0 | 1 }));
    const text = serializeExport(buildExport({ notes, flashcards, reviewLog: { v: 1, events } }, 0));
    const t0 = Date.now();
    const res = parseBackupText(text, { existingNoteIds: new Set(), now: 0 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const first = mergeBackup({ notes: [], flashcards: [], reviewLog: { v: 1, events: [] } }, res.data, res.dropped);
    const again = parseBackupText(text, { existingNoteIds: new Set(first.data.notes.map((n) => n.id)), now: 0 });
    expect(again.ok).toBe(true);
    if (again.ok) {
      const second = mergeBackup(first.data, again.data, again.dropped);
      expect(second.data.notes.length).toBe(first.data.notes.length);
      expect(second.data.flashcards.length).toBe(first.data.flashcards.length);
    }
    weakestRooms(first.data.notes, first.data.flashcards, 0);
    expect(Date.now() - t0).toBeLessThan(4000);
  });
});
