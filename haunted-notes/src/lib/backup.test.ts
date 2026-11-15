import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import {
  BACKUP_APP,
  BACKUP_LIMITS,
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  buildExport,
  isFileSizeAllowed,
  mergeBackup,
  parseBackupText,
  serializeExport,
  validateBackup,
  type BackupData,
  type RejectReason,
  type ValidateContext,
} from './backup';
import { REVIEW_LOG_VERSION, emptyReviewLog } from './reviewLog';
import { defaultSrsFields } from './srs';
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

// ---- Validation helpers ------------------------------------------------

const CTX: ValidateContext = { existingNoteIds: new Set<string>(), now: 1000 };

function goodNote(id: string): Record<string, unknown> {
  return { id, rawText: 'some text', inputMethod: 'type', createdAt: 5 };
}

function goodCard(id: string, noteId: string): Record<string, unknown> {
  return {
    id,
    noteId,
    sentence: 'The cat sat.',
    clozeWord: 'cat',
    prompt: 'The ___ sat.',
    weaknessScore: 0.5,
    streakCorrect: 0,
    streakWrong: 0,
    lastReviewed: null,
    ease: 2.5,
    intervalDays: 1,
    dueAt: 10,
    reps: 1,
  };
}

function envelope(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    app: 'haunted-notes',
    schemaVersion: 1,
    exportedAt: 1,
    notes: [goodNote('n1')],
    flashcards: [goodCard('c1', 'n1')],
    reviewLog: { v: 1, events: [] },
    ...over,
  };
}

function reasonOf(raw: unknown): RejectReason | 'ok' {
  const r = validateBackup(raw, CTX);
  return r.ok ? 'ok' : r.reason;
}

// ---- Unit tests: validation -------------------------------------------

describe('validateBackup (unit)', () => {
  it('accepts a good envelope', () => {
    expect(reasonOf(envelope())).toBe('ok');
  });

  it('rejects text that is not JSON with not-json', () => {
    const r = parseBackupText('{nope', CTX);
    expect(r).toEqual({ ok: false, reason: 'not-json' });
  });

  it('rejects non-objects with not-an-object', () => {
    expect(reasonOf(null)).toBe('not-an-object');
    expect(reasonOf([])).toBe('not-an-object');
    expect(reasonOf('x')).toBe('not-an-object');
    expect(reasonOf(7)).toBe('not-an-object');
  });

  it('rejects another app with wrong-app', () => {
    expect(reasonOf(envelope({ app: 'other' }))).toBe('wrong-app');
  });

  it('rejects a non-integer version with bad-version', () => {
    expect(reasonOf(envelope({ schemaVersion: '1' }))).toBe('bad-version');
    expect(reasonOf(envelope({ schemaVersion: 1.5 }))).toBe('bad-version');
  });

  it('rejects an integer version other than 1 with unknown-version', () => {
    expect(reasonOf(envelope({ schemaVersion: 2 }))).toBe('unknown-version');
  });

  it('rejects notes or flashcards that are not arrays with bad-shape', () => {
    expect(reasonOf(envelope({ notes: {} }))).toBe('bad-shape');
    expect(reasonOf(envelope({ flashcards: 'x' }))).toBe('bad-shape');
  });

  it('rejects over-limit counts with too-many', () => {
    expect(reasonOf(envelope({ notes: new Array<unknown>(BACKUP_LIMITS.notes + 1).fill(null) }))).toBe('too-many');
    expect(reasonOf(envelope({ flashcards: new Array<unknown>(BACKUP_LIMITS.flashcards + 1).fill(null) }))).toBe(
      'too-many',
    );
    const events = new Array<unknown>(BACKUP_LIMITS.events + 1).fill(null);
    expect(reasonOf(envelope({ reviewLog: { v: 1, events } }))).toBe('too-many');
  });

  it('gives a legacy card without SRS fields the default SRS fields', () => {
    const legacy = goodCard('c1', 'n1');
    delete legacy.ease;
    delete legacy.intervalDays;
    delete legacy.dueAt;
    delete legacy.reps;
    const r = validateBackup(envelope({ flashcards: [legacy] }), CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const card = r.data.flashcards[0];
    const d = defaultSrsFields(CTX.now);
    expect([card.ease, card.intervalDays, card.dueAt, card.reps]).toEqual([d.ease, d.intervalDays, d.dueAt, d.reps]);
  });

  it('drops only the title when it is 201 characters long', () => {
    const note = { ...goodNote('n1'), title: 'x'.repeat(201) };
    const r = validateBackup(envelope({ notes: [note] }), CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.notes).toHaveLength(1);
    expect(Object.hasOwn(r.data.notes[0], 'title')).toBe(false);
    expect(r.dropped.notes).toBe(0);
  });

  it('does not pollute Object.prototype from a __proto__ payload', () => {
    const r = parseBackupText('{"__proto__":{"polluted":1}}', CTX);
    expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops a card whose id is __proto__', () => {
    const r = validateBackup(
      envelope({ flashcards: [goodCard('__proto__', 'n1'), goodCard('c2', 'n1')] }),
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.flashcards.map((c) => c.id)).toEqual(['c2']);
    expect(r.dropped.flashcards).toBe(1);
  });

  it('drops an orphan card', () => {
    const r = validateBackup(envelope({ flashcards: [goodCard('c1', 'missing')] }), CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.flashcards).toEqual([]);
    expect(r.dropped.flashcards).toBe(1);
  });

  it('warns and ignores a newer review log while keeping notes and cards', () => {
    const r = validateBackup(envelope({ reviewLog: { v: 2, events: [{ t: 1, r: 'n1', c: 1 }] } }), CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual(['review-log-ignored']);
    expect(r.data.reviewLog).toEqual(emptyReviewLog());
    expect(r.data.notes).toHaveLength(1);
    expect(r.data.flashcards).toHaveLength(1);
  });
});

// ---- Validation generators --------------------------------------------

const FORBIDDEN = ['__proto__', 'constructor', 'prototype'];
const KNOWN_REASONS: readonly string[] = [
  'not-json', 'not-an-object', 'wrong-app', 'bad-version', 'unknown-version', 'bad-shape', 'too-many',
];

const arbSafeId = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => !FORBIDDEN.includes(s));

/** Valid, round-trippable backup data: unique ids, cards reference notes, sorted events, no -0. */
const arbValidBackup: fc.Arbitrary<BackupData> = fc
  .uniqueArray(
    fc.record(
      {
        id: arbSafeId,
        rawText: fc.string({ maxLength: 200 }),
        inputMethod: fc.constantFrom('type', 'mic', 'photo', 'audio') as fc.Arbitrary<Note['inputMethod']>,
        createdAt: arbTime,
        title: fc.string({ maxLength: 50 }),
      },
      { requiredKeys: ['id', 'rawText', 'inputMethod', 'createdAt'] },
    ),
    { selector: (n) => n.id, maxLength: 5 },
  )
  .chain((notes) => {
    const cards: fc.Arbitrary<Flashcard[]> =
      notes.length === 0
        ? fc.constant([])
        : fc.uniqueArray(
            fc.record({
              id: arbSafeId,
              noteId: fc.constantFrom(...notes.map((n) => n.id)),
              sentence: fc.string({ maxLength: 100 }),
              clozeWord: fc.string({ minLength: 1, maxLength: 30 }),
              prompt: fc.string({ maxLength: 100 }),
              weaknessScore: fc.double({ min: 0, max: 1, noNaN: true }).map((x) => x + 0),
              streakCorrect: fc.integer({ min: 0, max: 10000 }),
              streakWrong: fc.integer({ min: 0, max: 10000 }),
              lastReviewed: fc.option(arbTime, { nil: null }),
              ease: fc.double({ min: 1.3, max: 5, noNaN: true }).map((x) => x + 0),
              intervalDays: fc.integer({ min: 0, max: 36500 }),
              dueAt: arbTime,
              reps: fc.integer({ min: 0, max: 10000 }),
            }),
            { selector: (c) => c.id, maxLength: 5 },
          );
    const events = fc
      .array(fc.record({ t: arbTime, r: arbSafeId, c: fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1> }), {
        maxLength: 10,
      })
      .map((evs) => [...evs].sort((a, b) => a.t - b.t));
    return fc.record({
      notes: fc.constant(notes),
      flashcards: cards,
      reviewLog: events.map((e) => ({ v: REVIEW_LOG_VERSION, events: e })),
    });
  });

function asJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

// ---- Property tests: validation ---------------------------------------

describe('validation properties', () => {
  // Feature: data-safety-offline, Property 2: Export round trip
  // **Validates: Requirements 2.1, 2.2, 2.3, 9.1**
  it('Property 2: Export round trip', () => {
    fc.assert(
      fc.property(arbValidBackup, arbTime, arbTime, (data, exportedAt, now) => {
        const text = serializeExport(buildExport(data, exportedAt));
        const r = parseBackupText(text, { existingNoteIds: new Set<string>(), now });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.data).toEqual(data);
        expect(r.dropped).toEqual({ notes: 0, flashcards: 0, events: 0 });
        expect(r.warnings).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 4: Validation is total
  // **Validates: Requirements 3.3, 3.6, 5.8, 15.5**
  it('Property 4: Validation is total', () => {
    const check = (r: ReturnType<typeof validateBackup>): void => {
      expect(typeof r).toBe('object');
      expect(typeof r.ok).toBe('boolean');
      if (!r.ok) expect(KNOWN_REASONS).toContain(r.reason);
    };
    const anything = fc.anything({ withNullPrototype: true, withBigInt: true, withDate: true, withSparseArray: true });
    fc.assert(fc.property(anything, (v) => check(validateBackup(v, CTX))), { numRuns: 200 });
    fc.assert(fc.property(fc.string(), (s) => check(parseBackupText(s, CTX))), { numRuns: 200 });
    fc.assert(
      fc.property(fc.jsonValue(), (v) => check(parseBackupText(JSON.stringify(v), CTX))),
      { numRuns: 200 },
    );
    // Right envelope, arbitrary junk inside, to reach the record sanitizers.
    fc.assert(
      fc.property(
        fc.array(fc.anything(), { maxLength: 8 }),
        fc.array(fc.anything(), { maxLength: 8 }),
        fc.anything(),
        (notes, flashcards, reviewLog) => {
          check(validateBackup({ app: 'haunted-notes', schemaVersion: 1, notes, flashcards, reviewLog }, CTX));
        },
      ),
      { numRuns: 200 },
    );
  });

  // Feature: data-safety-offline, Property 5: Envelope defects are rejected with the right reason
  // **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.6**
  it('Property 5: Envelope defects are rejected with the right reason', () => {
    type Defect = { reason: RejectReason; apply: (e: Record<string, unknown>) => unknown };
    const junk = (n: number): unknown[] => new Array<unknown>(n).fill(0);
    const defects: fc.Arbitrary<Defect> = fc.oneof(
      fc
        .oneof(fc.constant(null), fc.array(fc.anything(), { maxLength: 3 }), fc.string(), fc.double(), fc.boolean())
        .map((v): Defect => ({ reason: 'not-an-object', apply: () => v })),
      fc
        .oneof(fc.string().filter((s) => s !== 'haunted-notes'), fc.integer(), fc.constant(null))
        .map((v): Defect => ({ reason: 'wrong-app', apply: (e) => ({ ...e, app: v }) })),
      fc
        .oneof(
          fc.string(),
          fc.double({ noNaN: true }).filter((d) => !Number.isInteger(d)),
          fc.constant(null),
          fc.boolean(),
        )
        .map((v): Defect => ({ reason: 'bad-version', apply: (e) => ({ ...e, schemaVersion: v }) })),
      fc
        .integer()
        .filter((n) => n !== 1)
        .map((v): Defect => ({ reason: 'unknown-version', apply: (e) => ({ ...e, schemaVersion: v }) })),
      fc
        .oneof(fc.constant(undefined), fc.constant(null), fc.string(), fc.integer(), fc.object())
        .map((v): Defect => ({ reason: 'bad-shape', apply: (e) => ({ ...e, notes: v }) })),
      fc
        .oneof(fc.constant(undefined), fc.constant(null), fc.string(), fc.integer(), fc.object())
        .map((v): Defect => ({ reason: 'bad-shape', apply: (e) => ({ ...e, flashcards: v }) })),
      fc
        .integer({ min: BACKUP_LIMITS.notes + 1, max: BACKUP_LIMITS.notes + 50 })
        .map((n): Defect => ({ reason: 'too-many', apply: (e) => ({ ...e, notes: junk(n) }) })),
      fc
        .integer({ min: BACKUP_LIMITS.flashcards + 1, max: BACKUP_LIMITS.flashcards + 50 })
        .map((n): Defect => ({ reason: 'too-many', apply: (e) => ({ ...e, flashcards: junk(n) }) })),
      fc.integer({ min: BACKUP_LIMITS.events + 1, max: BACKUP_LIMITS.events + 50 }).map(
        (n): Defect => ({
          reason: 'too-many',
          apply: (e) => ({ ...e, reviewLog: { v: REVIEW_LOG_VERSION, events: junk(n) } }),
        }),
      ),
    );
    fc.assert(
      fc.property(arbValidBackup, arbTime, defects, (data, now, defect) => {
        const base = asJson(buildExport(data, now)) as Record<string, unknown>;
        const r = validateBackup(defect.apply(base), CTX);
        expect(r).toEqual({ ok: false, reason: defect.reason });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 6: Invalid records are dropped and the rest kept
  // **Validates: Requirements 4.7, 4.8, 4.9, 4.10, 4.12, 5.4, 9.5**
  it('Property 6: Invalid records are dropped and the rest kept', () => {
    const noteDefects: Array<(n: Record<string, unknown>) => Record<string, unknown>> = [
      (n) => ({ ...n, id: '' }),
      (n) => ({ ...n, id: '__proto__' }),
      (n) => ({ ...n, id: 'x'.repeat(BACKUP_LIMITS.id + 1) }),
      (n) => ({ ...n, rawText: 5 }),
      (n) => ({ ...n, rawText: 'x'.repeat(BACKUP_LIMITS.rawText + 1) }),
      (n) => ({ ...n, inputMethod: 'fax' }),
      (n) => ({ ...n, createdAt: -1 }),
      (n) => ({ ...n, createdAt: '5' }),
    ];
    const cardDefects: Array<(c: Record<string, unknown>) => Record<string, unknown>> = [
      (c) => ({ ...c, id: 5 }),
      (c) => ({ ...c, id: 'constructor' }),
      (c) => ({ ...c, noteId: 'orphan-note' }),
      (c) => ({ ...c, sentence: 'x'.repeat(BACKUP_LIMITS.sentence + 1) }),
      (c) => ({ ...c, clozeWord: 'x'.repeat(BACKUP_LIMITS.clozeWord + 1) }),
      (c) => ({ ...c, weaknessScore: 1.5 }),
      (c) => ({ ...c, streakCorrect: -1 }),
      (c) => ({ ...c, lastReviewed: 'yesterday' }),
      (c) => ({ ...c, ease: 0.5 }),
      (c) => ({ ...c, reps: 1.5 }),
    ];
    const plan = fc.record({
      notes: fc.array(fc.option(fc.nat({ max: noteDefects.length - 1 }), { nil: undefined }), { maxLength: 12 }),
      cards: fc.array(fc.option(fc.nat({ max: cardDefects.length - 1 }), { nil: undefined }), { maxLength: 15 }),
      dupNote: fc.boolean(),
      dupCard: fc.boolean(),
      useExisting: fc.boolean(),
    });
    fc.assert(
      fc.property(plan, (p) => {
        const notes: unknown[] = [goodNote('base')];
        const expectedNotes: string[] = ['base'];
        let invalidNotes = 0;
        p.notes.forEach((d, i) => {
          if (d === undefined) {
            notes.push(goodNote(`n${i}`));
            expectedNotes.push(`n${i}`);
          } else {
            notes.push(noteDefects[d](goodNote(`bad${i}`)));
            invalidNotes += 1;
          }
        });
        if (p.dupNote) {
          notes.push(goodNote('base'));
          invalidNotes += 1;
        }
        const existing = new Set<string>(p.useExisting ? ['existing'] : []);
        const refs = [...expectedNotes, ...(p.useExisting ? ['existing'] : [])];
        const cards: unknown[] = [];
        const expectedCards: string[] = [];
        let invalidCards = 0;
        p.cards.forEach((d, i) => {
          if (d === undefined) {
            cards.push(goodCard(`c${i}`, refs[i % refs.length]));
            expectedCards.push(`c${i}`);
          } else {
            cards.push(cardDefects[d](goodCard(`badc${i}`, 'base')));
            invalidCards += 1;
          }
        });
        if (p.dupCard) {
          cards.push(goodCard('dupcard', 'base'), goodCard('dupcard', 'base'));
          expectedCards.push('dupcard');
          invalidCards += 1;
        }
        const r = validateBackup(envelope({ notes, flashcards: cards }), { existingNoteIds: existing, now: 1000 });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.data.notes.map((n) => n.id)).toEqual(expectedNotes);
        expect(r.data.flashcards.map((c) => c.id)).toEqual(expectedCards);
        expect(r.dropped.notes).toBe(invalidNotes);
        expect(r.dropped.flashcards).toBe(invalidCards);
        const known = new Set([...r.data.notes.map((n) => n.id), ...existing]);
        expect(r.data.flashcards.every((c) => known.has(c.noteId))).toBe(true);
        expect(new Set(r.data.flashcards.map((c) => c.id)).size).toBe(r.data.flashcards.length);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 7: Output contains only known keys and no pollution
  // **Validates: Requirements 5.1, 5.2, 5.3, 5.7**
  it('Property 7: Output contains only known keys and no pollution', () => {
    const NOTE_KEYS = ['id', 'rawText', 'inputMethod', 'createdAt'];
    const CARD_KEYS = [
      'id', 'noteId', 'sentence', 'clozeWord', 'prompt', 'weaknessScore', 'streakCorrect', 'streakWrong',
      'lastReviewed', 'ease', 'intervalDays', 'dueAt', 'reps',
    ];
    const hostile = (name: string, extra: string): string =>
      `"${name}":{"polluted":true,"deep":{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}},` +
      `"constructor":{"prototype":{"polluted":true}},"prototype":{"x":1},${JSON.stringify(extra)}:1`;
    // Appends hostile own keys to the JSON text of an object.
    const inject = (value: unknown, name: string, extra: string): string =>
      `${JSON.stringify(value).slice(0, -1)},${hostile(name, extra)}}`;
    const noOwnForbidden = (v: unknown): boolean => {
      if (typeof v !== 'object' || v === null) return true;
      for (const k of Object.getOwnPropertyNames(v)) {
        if (FORBIDDEN.includes(k)) return false;
        if (!noOwnForbidden((v as Record<string, unknown>)[k])) return false;
      }
      return true;
    };
    const sorted = (o: object): string[] => Object.getOwnPropertyNames(o).sort();
    fc.assert(
      fc.property(arbValidBackup, fc.constantFrom(...FORBIDDEN), arbSafeId, (data, name, extra) => {
        const before = sorted(Object.prototype);
        const parts = {
          notes: data.notes.map((n) => inject(n, name, `x${extra}`)).join(','),
          cards: data.flashcards.map((c) => inject(c, name, `x${extra}`)).join(','),
          events: data.reviewLog.events.map((e) => inject(e, name, `x${extra}`)).join(','),
        };
        const log = `{"v":1,"events":[${parts.events}],${hostile(name, `x${extra}`)}}`;
        const text =
          `{"app":"haunted-notes","schemaVersion":1,"exportedAt":1,"notes":[${parts.notes}],` +
          `"flashcards":[${parts.cards}],"reviewLog":${log},${hostile(name, `x${extra}`)}}`;
        const r = parseBackupText(text, CTX);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.data.notes.length).toBe(data.notes.length);
        expect(r.data.flashcards.length).toBe(data.flashcards.length);
        for (const n of r.data.notes) {
          const keys = Object.keys(n);
          expect(keys.every((k) => [...NOTE_KEYS, 'title'].includes(k))).toBe(true);
          expect(NOTE_KEYS.every((k) => keys.includes(k))).toBe(true);
        }
        for (const c of r.data.flashcards) expect(Object.keys(c).sort()).toEqual([...CARD_KEYS].sort());
        expect(Object.keys(r.data.reviewLog).sort()).toEqual(['events', 'v']);
        for (const e of r.data.reviewLog.events) expect(Object.keys(e).sort()).toEqual(['c', 'r', 't']);
        expect(noOwnForbidden(r.data)).toBe(true);
        expect(sorted(Object.prototype)).toEqual(before);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 13: Newer or malformed review log is ignored with a warning
  // **Validates: Requirements 9.3**
  it('Property 13: Newer or malformed review log is ignored with a warning', () => {
    const badLog = fc.oneof(
      fc.constant(null),
      fc.string(),
      fc.double(),
      fc.boolean(),
      fc.array(fc.anything(), { maxLength: 3 }),
      fc
        .integer({ min: REVIEW_LOG_VERSION + 1, max: 1000 })
        .chain((v) => fc.array(arbEvent, { maxLength: 5 }).map((events) => ({ v, events }))),
    );
    fc.assert(
      fc.property(arbValidBackup, badLog, (data, log) => {
        const base = asJson(buildExport(data, 1)) as Record<string, unknown>;
        const r = validateBackup({ ...base, reviewLog: log }, CTX);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.data.reviewLog).toEqual(emptyReviewLog());
        expect(r.warnings).toContain('review-log-ignored');
        expect(r.data.notes).toEqual(data.notes);
        expect(r.data.flashcards).toEqual(data.flashcards);
      }),
      { numRuns: 100 },
    );
  });
});

void MAX_TIME;

// ---- Unit tests: merge --------------------------------------------------

function mNote(id: string, rawText = 'x'): Note {
  return { id, rawText, inputMethod: 'type', createdAt: 1 };
}

function mCard(id: string, noteId: string, sentence = 'S', clozeWord = 'w', extra: Partial<Flashcard> = {}): Flashcard {
  return {
    id,
    noteId,
    sentence,
    clozeWord,
    prompt: 'p',
    weaknessScore: 0.5,
    streakCorrect: 0,
    streakWrong: 0,
    lastReviewed: null,
    ...defaultSrsFields(0),
    ...extra,
  };
}

function mData(notes: Note[], flashcards: Flashcard[], events: ReviewEvent[] = []): BackupData {
  return { notes, flashcards, reviewLog: { v: REVIEW_LOG_VERSION, events } };
}

describe('mergeBackup', () => {
  it('skips a note with an existing id and keeps the existing record', () => {
    const current = mData([mNote('a', 'mine')], []);
    const incoming = mData([mNote('a', 'theirs')], []);
    const { data, summary } = mergeBackup(current, incoming);
    expect(data.notes).toEqual([mNote('a', 'mine')]);
    expect(data.notes[0]).toBe(current.notes[0]);
    expect(summary.notes).toEqual({ added: 0, skipped: 1 });
  });

  it('skips a card with the same content under a new id', () => {
    const current = mData([mNote('a')], [mCard('c1', 'a')]);
    const incoming = mData([mNote('a')], [mCard('c2', 'a')]);
    const { data, summary } = mergeBackup(current, incoming);
    expect(data.flashcards.map((c) => c.id)).toEqual(['c1']);
    expect(summary.flashcards).toEqual({ added: 0, skipped: 1 });
  });

  it('keeps existing SRS fields when an incoming card matches', () => {
    const mine = mCard('c1', 'a', 'S', 'w', { ease: 2.1, intervalDays: 9, reps: 4, dueAt: 777 });
    const theirs = mCard('c1', 'a', 'S', 'w', { ease: 4, intervalDays: 1, reps: 0, dueAt: 5 });
    const { data } = mergeBackup(mData([mNote('a')], [mine]), mData([mNote('a')], [theirs]));
    expect(data.flashcards).toHaveLength(1);
    expect(data.flashcards[0]).toBe(mine);
    expect(data.flashcards[0].ease).toBe(2.1);
    expect(data.flashcards[0].dueAt).toBe(777);
  });

  it('appends new items after existing ones in file order', () => {
    const current = mData([mNote('a')], [mCard('c1', 'a', 'S1')]);
    const incoming = mData(
      [mNote('z'), mNote('b')],
      [mCard('c9', 'z', 'S9'), mCard('c3', 'b', 'S3')],
    );
    const { data } = mergeBackup(current, incoming);
    expect(data.notes.map((n) => n.id)).toEqual(['a', 'z', 'b']);
    expect(data.flashcards.map((c) => c.id)).toEqual(['c1', 'c9', 'c3']);
  });

  it('does not mutate current', () => {
    const current = mData([mNote('a')], [mCard('c1', 'a')], [{ t: 1, r: 'a', c: 1 }]);
    const snapshot = JSON.stringify(current);
    mergeBackup(current, mData([mNote('b')], [mCard('c2', 'b')], [{ t: 2, r: 'b', c: 0 }]));
    expect(JSON.stringify(current)).toBe(snapshot);
  });

  it('applies the 500 event cap, keeping the newest', () => {
    const cur: ReviewEvent[] = Array.from({ length: 400 }, (_, i) => ({ t: i, r: 'a', c: 1 as const }));
    const inc: ReviewEvent[] = Array.from({ length: 300 }, (_, i) => ({ t: 1000 + i, r: 'a', c: 0 as const }));
    const { data, summary } = mergeBackup(mData([], [], cur), mData([], [], inc));
    expect(data.reviewLog.events).toHaveLength(500);
    expect(data.reviewLog.events[499].t).toBe(1299);
    expect(data.reviewLog.events[0].t).toBe(200);
    expect(summary.events).toEqual({ added: 300, skipped: 0 });
  });

  it('reports summary numbers for a small example', () => {
    const current = mData([mNote('a')], [mCard('c1', 'a')], [{ t: 1, r: 'a', c: 1 }]);
    const incoming = mData(
      [mNote('a'), mNote('b')],
      [mCard('c1', 'a'), mCard('c2', 'b'), mCard('c3', 'b', 'S3')],
      [{ t: 1, r: 'a', c: 1 }, { t: 2, r: 'b', c: 0 }],
    );
    const { summary } = mergeBackup(current, incoming, { notes: 1, flashcards: 2, events: 3 }, ['review-log-ignored']);
    expect(summary.notes).toEqual({ added: 1, skipped: 1 });
    expect(summary.flashcards).toEqual({ added: 2, skipped: 1 });
    expect(summary.events).toEqual({ added: 1, skipped: 1 });
    expect(summary.dropped).toEqual({ notes: 1, flashcards: 2, events: 3 });
    expect(summary.warnings).toEqual(['review-log-ignored']);
  });
});

// ---- Property tests: merge ---------------------------------------------

const contentKey = (c: Flashcard): string => JSON.stringify([c.noteId, c.sentence, c.clozeWord]);
const evKey = (e: ReviewEvent): string => `${e.t}|${e.r}|${e.c}`;

function uniqueBy<T>(items: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/** A valid store state: unique note ids, unique card ids and contents. */
const arbCurrent: fc.Arbitrary<BackupData> = arbValidBackup.map((d) => ({
  notes: d.notes,
  flashcards: uniqueBy(d.flashcards, contentKey),
  reviewLog: d.reviewLog,
}));

/** Incoming data that deliberately overlaps with `current` (same ids, same content, same events). */
const arbMergePair: fc.Arbitrary<{ current: BackupData; incoming: BackupData }> = fc
  .tuple(arbCurrent, arbValidBackup, fc.array(fc.boolean(), { minLength: 24, maxLength: 24 }), fc.boolean())
  .map(([current, fresh, mask, reidCards]) => {
    const pick = <T,>(xs: T[], offset: number): T[] => xs.filter((_, i) => mask[(i + offset) % mask.length]);
    const sharedCards = pick(current.flashcards, 8).map((c, i) => (reidCards ? { ...c, id: `re-${i}` } : c));
    const notes = uniqueBy([...pick(current.notes, 0), ...fresh.notes], (n) => n.id);
    const flashcards = uniqueBy(
      uniqueBy([...sharedCards, ...fresh.flashcards], contentKey),
      (c) => c.id,
    );
    const events = [...pick(current.reviewLog.events, 16), ...fresh.reviewLog.events].sort((a, b) => a.t - b.t);
    return {
      current,
      incoming: { notes, flashcards, reviewLog: { v: REVIEW_LOG_VERSION, events } },
    };
  });

describe('mergeBackup properties', () => {
  // Feature: data-safety-offline, Property 8: Merge preserves existing data and adds each new item once
  // **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.8**
  it('Property 8: Merge preserves existing data and adds each new item once', () => {
    fc.assert(
      fc.property(arbMergePair, ({ current, incoming }) => {
        const before = JSON.stringify(current);
        const { data } = mergeBackup(current, incoming);
        expect(JSON.stringify(current)).toBe(before);

        const nNotes = current.notes.length;
        expect(data.notes.slice(0, nNotes).every((n, i) => n === current.notes[i])).toBe(true);
        const curIds = new Set(current.notes.map((n) => n.id));
        expect(data.notes.slice(nNotes)).toEqual(incoming.notes.filter((n) => !curIds.has(n.id)));

        const nCards = current.flashcards.length;
        expect(data.flashcards.slice(0, nCards).every((c, i) => c === current.flashcards[i])).toBe(true);
        const cardIds = new Set(current.flashcards.map((c) => c.id));
        const cardKeys = new Set(current.flashcards.map(contentKey));
        expect(data.flashcards.slice(nCards)).toEqual(
          incoming.flashcards.filter((c) => !cardIds.has(c.id) && !cardKeys.has(contentKey(c))),
        );
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 9: Merge result has no duplicates
  // **Validates: Requirements 8.5**
  it('Property 9: Merge result has no duplicates', () => {
    fc.assert(
      fc.property(arbMergePair, ({ current, incoming }) => {
        const { data } = mergeBackup(current, incoming);
        expect(new Set(data.notes.map((n) => n.id)).size).toBe(data.notes.length);
        expect(new Set(data.flashcards.map((c) => c.id)).size).toBe(data.flashcards.length);
        expect(new Set(data.flashcards.map(contentKey)).size).toBe(data.flashcards.length);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 10: Merge is idempotent
  // **Validates: Requirements 8.6**
  it('Property 10: Merge is idempotent', () => {
    fc.assert(
      fc.property(arbMergePair, ({ current, incoming }) => {
        const first = mergeBackup(current, incoming);
        const second = mergeBackup(first.data, incoming);
        expect(second.data).toEqual(first.data);
        expect(second.summary.notes.added).toBe(0);
        expect(second.summary.flashcards.added).toBe(0);
        expect(second.summary.events.added).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 11: Summary counts add up
  // **Validates: Requirements 8.7, 7.2**
  it('Property 11: Summary counts add up', () => {
    fc.assert(
      fc.property(arbMergePair, ({ current, incoming }) => {
        const { data, summary } = mergeBackup(current, incoming);
        expect(summary.notes.added + summary.notes.skipped).toBe(incoming.notes.length);
        expect(summary.flashcards.added + summary.flashcards.skipped).toBe(incoming.flashcards.length);
        expect(summary.events.added + summary.events.skipped).toBe(incoming.reviewLog.events.length);
        expect(data.notes.length - current.notes.length).toBe(summary.notes.added);
        expect(data.flashcards.length - current.flashcards.length).toBe(summary.flashcards.added);
        // Generated logs are far below the 500 cap, so growth equals added.
        expect(data.reviewLog.events.length - current.reviewLog.events.length).toBe(summary.events.added);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: data-safety-offline, Property 12: Merged review log is valid, sorted and capped
  // **Validates: Requirements 9.2, 9.4**
  it('Property 12: Merged review log is valid, sorted and capped', () => {
    const arbLog = fc
      .array(arbEvent, { maxLength: 400 })
      .map((evs) => ({ v: REVIEW_LOG_VERSION, events: [...evs].sort((a, b) => a.t - b.t) }));
    fc.assert(
      fc.property(arbLog, arbLog, (cur, inc) => {
        const merged = mergeBackup({ notes: [], flashcards: [], reviewLog: cur }, { notes: [], flashcards: [], reviewLog: inc }).data.reviewLog;
        expect(merged.v).toBe(REVIEW_LOG_VERSION);
        expect(merged.events.length).toBeLessThanOrEqual(500);
        for (let i = 1; i < merged.events.length; i += 1) {
          expect(merged.events[i].t).toBeGreaterThanOrEqual(merged.events[i - 1].t);
        }
        const distinct = new Set([...cur.events, ...inc.events].map(evKey));
        if (distinct.size <= 500 && cur.events.length + inc.events.length <= 500) {
          const got = new Set(merged.events.map(evKey));
          for (const k of distinct) expect(got.has(k)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('backup.ts source scan', () => {
  it('uses no Object.assign, clock, React or Zustand', () => {
    const src = readFileSync(new URL('./backup.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('Object.assign');
    expect(src).not.toContain('Date.now');
    expect(src).not.toContain("from 'react'");
    expect(src).not.toContain("from 'zustand'");
  });
});
