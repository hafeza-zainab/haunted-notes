import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Flashcard, Note } from '../types';
import { defaultSrsFields } from '../lib/srs';

const KEY = 'haunted-notes-storage';

function makeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

function makeCard(id: string, noteId: string): Flashcard {
  return {
    id,
    noteId,
    sentence: 'The mitochondria is the powerhouse.',
    clozeWord: 'mitochondria',
    prompt: 'The ____ is the powerhouse.',
    weaknessScore: 0.5,
    streakCorrect: 0,
    streakWrong: 0,
    lastReviewed: null,
    ...defaultSrsFields(0),
  };
}

function makeNote(id: string): Note {
  return { id, rawText: 'x', inputMethod: 'type', createdAt: 0 };
}

let storage: ReturnType<typeof makeLocalStorage>;

/** Fresh store module bound to the stubbed localStorage. */
async function loadStore() {
  vi.resetModules();
  return (await import('./useStore')).useStore;
}

beforeEach(() => {
  storage = makeLocalStorage();
  vi.stubGlobal('localStorage', storage);
  // zustand's default storage reads window.localStorage.
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useStore reviewLog', () => {
  it('starts with an empty versioned log', async () => {
    const useStore = await loadStore();
    expect(useStore.getState().reviewLog).toEqual({ v: 1, events: [] });
  });

  it('answerCard appends a correct event with the card room id', async () => {
    const useStore = await loadStore();
    useStore.setState({ flashcards: [makeCard('c1', 'room-a')] });
    useStore.getState().answerCard('c1', true);
    const { events } = useStore.getState().reviewLog;
    expect(events).toHaveLength(1);
    expect(events[0].r).toBe('room-a');
    expect(events[0].c).toBe(1);
    expect(Number.isFinite(events[0].t)).toBe(true);
    expect(Object.keys(events[0]).sort()).toEqual(['c', 'r', 't']);
  });

  it('answerCard appends a wrong event with c = 0', async () => {
    const useStore = await loadStore();
    useStore.setState({ flashcards: [makeCard('c1', 'room-a'), makeCard('c2', 'room-b')] });
    useStore.getState().answerCard('c1', true);
    useStore.getState().answerCard('c2', false);
    const { events } = useStore.getState().reviewLog;
    expect(events.map((e) => [e.r, e.c])).toEqual([
      ['room-a', 1],
      ['room-b', 0],
    ]);
  });

  it('an unknown card id appends nothing and changes nothing', async () => {
    const useStore = await loadStore();
    useStore.setState({ flashcards: [makeCard('c1', 'room-a')] });
    const before = useStore.getState();
    useStore.getState().answerCard('missing', true);
    const after = useStore.getState();
    expect(after.reviewLog.events).toHaveLength(0);
    expect(after.reviewLog).toBe(before.reviewLog);
    expect(after.flashcards).toBe(before.flashcards);
  });

  it('resetAll clears the log', async () => {
    const useStore = await loadStore();
    useStore.setState({ flashcards: [makeCard('c1', 'room-a')] });
    useStore.getState().answerCard('c1', false);
    expect(useStore.getState().reviewLog.events).toHaveLength(1);
    useStore.getState().resetAll();
    expect(useStore.getState().reviewLog).toEqual({ v: 1, events: [] });
  });

  it('persists reviewLog with v: 1 in localStorage', async () => {
    const useStore = await loadStore();
    useStore.setState({ flashcards: [makeCard('c1', 'room-a')] });
    useStore.getState().answerCard('c1', true);
    const stored = JSON.parse(storage.getItem(KEY)!);
    expect(stored.state.reviewLog.v).toBe(1);
    expect(stored.state.reviewLog.events).toHaveLength(1);
    expect(stored.state.reviewLog.events[0]).toMatchObject({ r: 'room-a', c: 1 });
  });
});

describe('useStore reviewLog rehydration', () => {
  async function rehydrateWith(state: Record<string, unknown>) {
    storage.setItem(KEY, JSON.stringify({ state, version: 0 }));
    const useStore = await loadStore();
    await useStore.persist.rehydrate();
    return useStore;
  }

  const notes = [makeNote('room-a')];
  const flashcards = [makeCard('c1', 'room-a')];

  it('a missing reviewLog becomes an empty log and keeps flashcards', async () => {
    const useStore = await rehydrateWith({ notes, flashcards });
    expect(useStore.getState().reviewLog).toEqual({ v: 1, events: [] });
    expect(useStore.getState().flashcards).toHaveLength(1);
    expect(useStore.getState().notes).toHaveLength(1);
  });

  it.each([
    ['a string', 'junk'],
    ['null', null],
    ['an array', [1, 2]],
    ['a newer version', { v: 2, events: [{ t: 1, r: 'a', c: 1 }] }],
    ['non-array events', { v: 1, events: 'nope' }],
  ])('a corrupt reviewLog (%s) becomes empty and keeps flashcards', async (_name, bad) => {
    const useStore = await rehydrateWith({ notes, flashcards, reviewLog: bad });
    expect(useStore.getState().reviewLog).toEqual({ v: 1, events: [] });
    expect(useStore.getState().flashcards.map((c) => c.id)).toEqual(['c1']);
  });

  it('keeps valid events and drops invalid ones on rehydrate', async () => {
    const useStore = await rehydrateWith({
      notes,
      flashcards,
      reviewLog: {
        v: 1,
        events: [
          { t: 20, r: 'room-a', c: 0 },
          { t: 'bad', r: 'room-a', c: 1 },
          { t: 10, r: 'room-a', c: 1 },
        ],
      },
    });
    expect(useStore.getState().reviewLog.events).toEqual([
      { t: 10, r: 'room-a', c: 1 },
      { t: 20, r: 'room-a', c: 0 },
    ]);
  });
});

describe('useStore importBackup', () => {
  const incoming = {
    notes: [makeNote('room-b')],
    flashcards: [{ ...makeCard('c2', 'room-b'), sentence: 'Other sentence.' }],
    reviewLog: { v: 1, events: [{ t: 5, r: 'room-b', c: 1 as const }] },
  };

  it('changes only notes, flashcards and reviewLog and returns the summary', async () => {
    const useStore = await loadStore();
    useStore.setState({
      notes: [makeNote('room-a')],
      flashcards: [makeCard('c1', 'room-a')],
      currentView: 'quiz',
      soundEnabled: true,
      quizNoteId: 'room-a',
      quizDueOnly: true,
      isDemoLoaded: true,
    });
    const summary = useStore.getState().importBackup(incoming);
    const s = useStore.getState();
    expect(s.notes.map((n) => n.id)).toEqual(['room-a', 'room-b']);
    expect(s.flashcards.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(s.reviewLog.events).toEqual([{ t: 5, r: 'room-b', c: 1 }]);
    expect(summary.notes).toEqual({ added: 1, skipped: 0 });
    expect(summary.flashcards).toEqual({ added: 1, skipped: 0 });
    expect(summary.events).toEqual({ added: 1, skipped: 0 });
    expect(s.currentView).toBe('quiz');
    expect(s.soundEnabled).toBe(true);
    expect(s.quizNoteId).toBe('room-a');
    expect(s.quizDueOnly).toBe(true);
    expect(s.isDemoLoaded).toBe(true);
  });

  it('a second call with the same data adds nothing', async () => {
    const useStore = await loadStore();
    useStore.getState().importBackup(incoming);
    const after = useStore.getState();
    const second = useStore.getState().importBackup(incoming);
    expect(second.notes.added).toBe(0);
    expect(second.flashcards.added).toBe(0);
    expect(second.events.added).toBe(0);
    expect(useStore.getState().notes).toEqual(after.notes);
    expect(useStore.getState().flashcards).toEqual(after.flashcards);
    expect(useStore.getState().reviewLog).toEqual(after.reviewLog);
  });

  it('keeps an existing card unchanged when the incoming card matches', async () => {
    const useStore = await loadStore();
    const mine = { ...makeCard('c1', 'room-a'), ease: 2.1, reps: 7 };
    useStore.setState({ notes: [makeNote('room-a')], flashcards: [mine] });
    useStore.getState().importBackup({
      notes: [makeNote('room-a')],
      flashcards: [makeCard('c1', 'room-a')],
      reviewLog: { v: 1, events: [] },
    });
    expect(useStore.getState().flashcards).toEqual([mine]);
  });
});
