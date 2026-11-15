import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultSrsFields } from '../lib/srs';

const KEY = 'haunted-notes-storage';

function makeStorage(initial?: string, failWrites = false) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(KEY, initial);
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (failWrites) throw new DOMException('quota', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

async function loadWith(initial?: string, failWrites = false) {
  const storage = makeStorage(initial, failWrites);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  vi.resetModules();
  return (await import('./useStore')).useStore;
}

const wrap = (state: unknown) => JSON.stringify({ state, version: 0 });

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('corrupted localStorage (autopilot fault-finding)', () => {
  const cases: [string, string][] = [
    ['invalid JSON', '{not json'],
    ['JSON null', 'null'],
    ['a bare string', '"hello"'],
    ['state is a string', wrap('oops')],
    ['flashcards null', wrap({ notes: [], flashcards: null })],
    ['flashcards is an object', wrap({ notes: [], flashcards: { a: 1 } })],
    ['notes is a string', wrap({ notes: 'x', flashcards: [] })],
    ['null card inside flashcards', wrap({ notes: [], flashcards: [null, 5, 'x'] })],
  ];

  for (const [name, raw] of cases) {
    it(`loads without throwing and keeps arrays valid: ${name}`, async () => {
      const useStore = await loadWith(raw);
      const s = useStore.getState();
      expect(Array.isArray(s.notes)).toBe(true);
      expect(Array.isArray(s.flashcards)).toBe(true);
      expect(s.reviewLog.v).toBe(1);
      for (const c of s.flashcards) expect(c && typeof c === 'object').toBe(true);
    });
  }

  it('keeps valid cards that have no SRS fields and fills defaults', async () => {
    const legacy = { id: 'c', noteId: 'n', sentence: 's', clozeWord: 'w', prompt: 'p', weaknessScore: 1, streakCorrect: 0, streakWrong: 0, lastReviewed: null };
    const useStore = await loadWith(wrap({ notes: [], flashcards: [legacy] }));
    expect(useStore.getState().flashcards[0].ease).toBe(defaultSrsFields(0).ease);
  });

  it('a localStorage quota error on write does not throw out of an action', async () => {
    const useStore = await loadWith(undefined, true);
    expect(() => useStore.getState().addNote({ rawText: 'The heart pumps blood around the body quickly.', inputMethod: 'type' })).not.toThrow();
  });
});
