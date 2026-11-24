import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SNAPSHOT_KEY,
  clearSnapshot,
  parseSnapshot,
  recoverSnapshot,
  serializeSnapshot,
  snapshotPatch,
  takeSnapshot,
  writeSnapshot,
  type DemoSnapshot,
  type StorageLike,
} from './demoSnapshot';
import { buildDemoData } from './demoData';
import { appendReview, emptyReviewLog } from './reviewLog';
import type { Flashcard, Note } from '../types';

const NOW = 1_700_000_000_000;

function memory(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function sample(): DemoSnapshot {
  const { notes, flashcards } = buildDemoData();
  return {
    notes,
    flashcards,
    reviewLog: appendReview(emptyReviewLog(), { t: NOW, r: 'demo-note-java', c: 1 }),
    isDemoLoaded: true,
    currentView: 'quiz',
    quizNoteId: 'demo-note-java',
    quizDueOnly: true,
  };
}

// ── Arbitraries (valid state, as the store always holds) ─────────────────────

const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  rawText: fc.string({ maxLength: 60 }),
  inputMethod: fc.constantFrom('type', 'mic', 'photo', 'audio'),
  createdAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  title: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
});

const cardArb: fc.Arbitrary<Flashcard> = fc.record({
  id: fc.uuid(),
  noteId: fc.uuid(),
  sentence: fc.string({ maxLength: 40 }),
  clozeWord: fc.string({ maxLength: 12 }),
  prompt: fc.string({ maxLength: 40 }),
  weaknessScore: fc.integer({ min: 0, max: 10 }).map((n) => n / 10),
  streakCorrect: fc.nat(20),
  streakWrong: fc.nat(20),
  lastReviewed: fc.option(fc.integer({ min: 0, max: 2_000_000_000_000 }), { nil: null }),
  ease: fc.integer({ min: 13, max: 30 }).map((n) => n / 10),
  intervalDays: fc.nat(60),
  dueAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  reps: fc.nat(10),
});

const snapshotArb: fc.Arbitrary<DemoSnapshot> = fc
  .record({
    notes: fc.uniqueArray(noteArb, { selector: (n) => n.id, maxLength: 6 }),
    flashcards: fc.uniqueArray(cardArb, { selector: (c) => c.id, maxLength: 10 }),
    events: fc.array(
      fc.record({
        t: fc.integer({ min: 0, max: 2_000_000_000_000 }),
        r: fc.string({ minLength: 1, maxLength: 8 }),
        c: fc.constantFrom<0 | 1>(0, 1),
      }),
      { maxLength: 20 },
    ),
    isDemoLoaded: fc.boolean(),
    currentView: fc.constantFrom('add', 'dashboard', 'quiz'),
    quizNoteId: fc.option(fc.string({ maxLength: 8 }), { nil: null }),
    quizDueOnly: fc.boolean(),
  })
  .map(({ events, ...rest }) => ({
    ...rest,
    // The store keeps events oldest first, so build them in time order.
    reviewLog: events
      .slice()
      .sort((a, b) => a.t - b.t)
      .reduce((log, e) => appendReview(log, e), emptyReviewLog()),
  }));

// ── Unit tests ───────────────────────────────────────────────────────────────

describe('takeSnapshot', () => {
  it('copies only the snapshot fields and is independent of the source', () => {
    const state = { ...sample(), soundEnabled: true, extra: 1 };
    const snap = takeSnapshot(state);
    expect(Object.keys(snap).sort()).toEqual(
      ['currentView', 'flashcards', 'isDemoLoaded', 'notes', 'quizDueOnly', 'quizNoteId', 'reviewLog'],
    );
    state.notes[0].rawText = 'changed';
    state.flashcards.pop();
    expect(snap.notes[0].rawText).not.toBe('changed');
    expect(snap.flashcards).toHaveLength(9);
  });

  it('snapshotPatch returns a copy that cannot change the snapshot', () => {
    const snap = takeSnapshot(sample());
    const patch = snapshotPatch(snap);
    patch.notes.length = 0;
    expect(snap.notes).toHaveLength(3);
  });
});

describe('serialize and parse', () => {
  it('round-trips a snapshot', () => {
    const snap = sample();
    expect(parseSnapshot(serializeSnapshot(snap), NOW)).toEqual(snap);
  });

  it.each([
    null,
    undefined,
    '',
    'not json',
    '[]',
    'null',
    '{"v":2,"data":{}}',
    '{"v":1}',
    '{"v":1,"data":{"notes":1,"flashcards":[]}}',
    '{"v":1,"data":{"notes":[],"flashcards":"x"}}',
    42,
  ])('returns null for %j', (raw) => {
    expect(parseSnapshot(raw, NOW)).toBeNull();
  });

  it('drops malformed items but keeps the rest', () => {
    const raw = JSON.stringify({
      v: 1,
      data: { notes: [null, { id: 'a', rawText: 't', inputMethod: 'type', createdAt: 1 }], flashcards: [] },
    });
    const snap = parseSnapshot(raw, NOW);
    expect(snap?.notes.map((n) => n.id)).toEqual(['a']);
    expect(snap?.currentView).toBe('dashboard');
  });
});

describe('writeSnapshot and recoverSnapshot', () => {
  it('writes under its own key and reports a failed write', () => {
    const store = memory();
    expect(writeSnapshot(store, sample())).toBe(true);
    expect(store.data.has(SNAPSHOT_KEY)).toBe(true);
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(writeSnapshot(full, sample())).toBe(false);
  });

  it('returns none when there is no key', () => {
    const apply = (): void => {
      throw new Error('must not run');
    };
    expect(recoverSnapshot(memory(), apply, NOW)).toBe('none');
  });

  it('applies a leftover snapshot, then deletes the key', () => {
    const snap = sample();
    const store = memory();
    writeSnapshot(store, snap);
    let applied: DemoSnapshot | null = null;
    expect(recoverSnapshot(store, (s) => (applied = s), NOW)).toBe('restored');
    expect(applied).toEqual(snap);
    expect(store.data.has(SNAPSHOT_KEY)).toBe(false);
  });

  it('is idempotent: a second recovery does nothing', () => {
    const store = memory();
    writeSnapshot(store, sample());
    let calls = 0;
    recoverSnapshot(store, () => void calls++, NOW);
    expect(recoverSnapshot(store, () => void calls++, NOW)).toBe('none');
    expect(calls).toBe(1);
  });

  it('deletes a corrupt snapshot without applying it', () => {
    const store = memory({ [SNAPSHOT_KEY]: '{broken' });
    expect(recoverSnapshot(store, () => { throw new Error('no'); }, NOW)).toBe('discarded');
    expect(store.data.has(SNAPSHOT_KEY)).toBe(false);
  });

  it('keeps the key when apply throws, so the next load can retry', () => {
    const store = memory();
    writeSnapshot(store, sample());
    expect(recoverSnapshot(store, () => { throw new Error('boom'); }, NOW)).toBe('failed');
    expect(store.data.has(SNAPSHOT_KEY)).toBe(true);
  });

  it('does not throw when storage itself throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(recoverSnapshot(broken, () => undefined, NOW)).toBe('none');
    expect(() => clearSnapshot(broken)).not.toThrow();
  });
});

// ── Property tests ───────────────────────────────────────────────────────────

describe('properties', () => {
  it('restore after any abort point gives exactly the original data', () => {
    fc.assert(
      fc.property(snapshotArb, snapshotArb, fc.nat(4), (original, demoState, abortPoint) => {
        // The store the run mutates: starts as the original, is replaced by demo
        // state, then edited a further `abortPoint` times before the run is aborted.
        const live: DemoSnapshot = structuredClone(original);
        const memorySnap = takeSnapshot(live);
        const store = memory();
        writeSnapshot(store, memorySnap);

        Object.assign(live, structuredClone(demoState));
        for (let i = 0; i < abortPoint; i++) {
          live.notes.pop();
          live.flashcards.push(...structuredClone(demoState.flashcards).slice(0, 1));
          live.isDemoLoaded = !live.isDemoLoaded;
        }

        // In-memory path (Stop, Escape, error, finish)
        expect(snapshotPatch(memorySnap)).toEqual(original);
        // Recovery path (tab closed mid-run)
        let recovered: DemoSnapshot | null = null;
        recoverSnapshot(store, (s) => (recovered = s), NOW);
        expect(recovered).toEqual(original);
      }),
      { numRuns: 100 },
    );
  });

  it('serialize then parse returns the same snapshot', () => {
    fc.assert(
      fc.property(snapshotArb, (snap) => {
        expect(parseSnapshot(serializeSnapshot(snap), NOW)).toEqual(snap);
      }),
      { numRuns: 100 },
    );
  });

  it('recovery on load is idempotent', () => {
    fc.assert(
      fc.property(snapshotArb, (snap) => {
        const store = memory();
        writeSnapshot(store, snap);
        const first: DemoSnapshot[] = [];
        expect(recoverSnapshot(store, (s) => first.push(s), NOW)).toBe('restored');
        expect(recoverSnapshot(store, (s) => first.push(s), NOW)).toBe('none');
        expect(first).toHaveLength(1);
        expect(store.data.size).toBe(0);
      }),
      { numRuns: 50 },
    );
  });

  it('a corrupt snapshot never throws and is always deleted', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json(), fc.jsonValue().map((v) => JSON.stringify(v))), (raw) => {
        expect(() => parseSnapshot(raw, NOW)).not.toThrow();
        const store = memory({ [SNAPSHOT_KEY]: raw });
        expect(() => recoverSnapshot(store, () => undefined, NOW)).not.toThrow();
        expect(store.data.has(SNAPSHOT_KEY)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});
