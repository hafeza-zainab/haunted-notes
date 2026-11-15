import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  BACKUP_APP,
  BACKUP_LIMITS,
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  buildExport,
  isFileSizeAllowed,
  serializeExport,
  type BackupData,
} from './backup';
import { REVIEW_LOG_VERSION, emptyReviewLog } from './reviewLog';
import type { Flashcard, Note, ReviewEvent } from '../types';

// ---- Shared generators -------------------------------------------------

const MAX_TIME = 8.64e15;

const arbTime = fc.integer({ min: 0, max: 4_000_000_000_000 });

const arbId = fc.string({ minLength: 1, maxLength: 30 });

const arbNote: fc.Arbitrary<Note> = fc
  .record(
    {
      id: arbId,
      rawText: fc.string({ maxLength: 200 }),
      inputMethod: fc.constantFrom('type', 'mic', 'photo', 'audio') as fc.Arbitrary<Note['inputMethod']>,
      createdAt: arbTime,
      title: fc.string({ maxLength: 50 }),
    },
    { requiredKeys: ['id', 'rawText', 'inputMethod', 'createdAt'] },
  );

const arbCard: fc.Arbitrary<Flashcard> = fc.record({
  id: arbId,
  noteId: arbId,
  sentence: fc.string({ maxLength: 100 }),
  clozeWord: fc.string({ minLength: 1, maxLength: 30 }),
  prompt: fc.string({ maxLength: 100 }),
  weaknessScore: fc.double({ min: 0, max: 1, noNaN: true }),
  streakCorrect: fc.integer({ min: 0, max: 10000 }),
  streakWrong: fc.integer({ min: 0, max: 10000 }),
  lastReviewed: fc.option(arbTime, { nil: null }),
  ease: fc.double({ min: 1.3, max: 5, noNaN: true }),
  intervalDays: fc.integer({ min: 0, max: 36500 }),
  dueAt: arbTime,
  reps: fc.integer({ min: 0, max: 10000 }),
});

const arbEvent: fc.Arbitrary<ReviewEvent> = fc.record({
  t: arbTime,
  r: arbId,
  c: fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>,
});

const arbBackupData: fc.Arbitrary<BackupData> = fc.record({
  notes: fc.array(arbNote, { maxLength: 5 }),
  flashcards: fc.array(arbCard, { maxLength: 5 }),
  reviewLog: fc
    .array(arbEvent, { maxLength: 10 })
    .map((events) => ({ v: REVIEW_LOG_VERSION, events })),
});

const EMPTY: BackupData = { notes: [], flashcards: [], reviewLog: emptyReviewLog() };

// ---- Unit tests: export helpers ---------------------------------------

describe('buildExport / serializeExport', () => {
  it('exports a valid envelope with empty arrays for an empty store', () => {
    const file = buildExport(EMPTY, 123);
    expect(file.notes).toEqual([]);
    expect(file.flashcards).toEqual([]);
    expect(file.reviewLog).toEqual({ v: REVIEW_LOG_VERSION, events: [] });
    expect(JSON.parse(serializeExport(file))).toEqual(file);
  });

  it('has exactly the envelope keys', () => {
    const file = buildExport(EMPTY, 42);
    expect(Object.keys(file).sort()).toEqual(
      ['app', 'exportedAt', 'flashcards', 'notes', 'reviewLog', 'schemaVersion'],
    );
    expect(file.app).toBe(BACKUP_APP);
    expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(file.exportedAt).toBe(42);
  });

  it('does not export extra fields that sit on the input object', () => {
    const polluted = { ...EMPTY, currentView: 'quiz', soundEnabled: true } as BackupData;
    expect(Object.keys(buildExport(polluted, 1))).not.toContain('currentView');
    expect(Object.keys(buildExport(polluted, 1))).not.toContain('soundEnabled');
  });
});

describe('backupFileName', () => {
  it('uses the UTC date by default', () => {
    expect(backupFileName(Date.UTC(2026, 10, 15, 12, 0, 0))).toBe('haunted-notes-backup-2026-11-15.json');
  });

  it('applies the timezone offset (getTimezoneOffset convention)', () => {
    const now = Date.UTC(2026, 10, 15, 23, 30, 0);
    // UTC+2 -> offset -120 -> local is 01:30 on the 16th
    expect(backupFileName(now, -120)).toBe('haunted-notes-backup-2026-11-16.json');
    // UTC-5 -> offset 300 -> local is 18:30 on the 15th
    expect(backupFileName(now, 300)).toBe('haunted-notes-backup-2026-11-15.json');
  });
});

describe('isFileSizeAllowed', () => {
  it('accepts the 5 MiB boundary and rejects one byte more', () => {
    expect(isFileSizeAllowed(5 * 1024 * 1024)).toBe(true);
    expect(isFileSizeAllowed(5 * 1024 * 1024 + 1)).toBe(false);
  });

  it('accepts zero and rejects negative and non-finite sizes', () => {
    expect(isFileSizeAllowed(0)).toBe(true);
    expect(isFileSizeAllowed(-1)).toBe(false);
    expect(isFileSizeAllowed(Number.NaN)).toBe(false);
    expect(isFileSizeAllowed(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

// ---- Property tests ----------------------------------------------------

describe('properties', () => {
  // Feature: data-safety-offline, Property 1: Export envelope is exact and deterministic
  // **Validates: Requirements 1.2, 1.3, 1.7**
  it('Property 1: Export envelope is exact and deterministic', () => {
    fc.assert(
      fc.property(arbBackupData, arbTime, (data, now) => {
        const a = buildExport(data, now);
        const b = buildExport(data, now);
        expect(Object.keys(a).sort()).toEqual(
          ['app', 'exportedAt', 'flashcards', 'notes', 'reviewLog', 'schemaVersion'],
        );
        expect(a.app).toBe('haunted-notes');
        expect(a.schemaVersion).toBe(1);
        expect(a.exportedAt).toBe(now);
        expect(a.notes).toEqual(data.notes);
        expect(a.flashcards).toEqual(data.flashcards);
        expect(a.reviewLog).toEqual(data.reviewLog);
        expect(a).toEqual(b);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 3: Backup file name and size check
  // **Validates: Requirements 1.4, 3.2**
  it('Property 3: file name matches the local date and size check is exact', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        fc.integer({ min: -840, max: 720 }),
        (now, tz) => {
          const name = backupFileName(now, tz);
          expect(name).toMatch(/^haunted-notes-backup-\d{4}-\d{2}-\d{2}\.json$/);
          const local = new Date(now - tz * 60000).toISOString().slice(0, 10);
          expect(name).toBe(`haunted-notes-backup-${local}.json`);
        },
      ),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(fc.integer({ min: -10, max: 2 * BACKUP_LIMITS.fileBytes }), (bytes) => {
        expect(isFileSizeAllowed(bytes)).toBe(bytes >= 0 && bytes <= 5 * 1024 * 1024);
      }),
      { numRuns: 100 },
    );
  });
});

void MAX_TIME;
