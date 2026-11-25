import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Note } from '../types';

const KEY = 'haunted-notes-storage';

/** Fresh store module on top of an in-memory localStorage that can be inspected. */
async function load(initial?: Record<string, string>) {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  const storage = {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  vi.resetModules();
  const { useStore } = await import('./useStore');
  const { takeSnapshot } = await import('../lib/demoSnapshot');
  return { useStore, takeSnapshot, data };
}

const note = (id: string): Omit<Note, 'id' | 'createdAt'> => ({
  rawText: `Mitochondria are the powerhouse of the cell and make most of its energy ${id}.`,
  inputMethod: 'type',
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('demo run in the store', () => {
  it('beginDemoRun empties the data and sets demoRunning', async () => {
    const { useStore } = await load();
    useStore.getState().addNote(note('a'));
    useStore.getState().beginDemoRun();
    const s = useStore.getState();
    expect(s.demoRunning).toBe(true);
    expect(s.notes).toHaveLength(0);
    expect(s.flashcards).toHaveLength(0);
    expect(s.reviewLog.events).toHaveLength(0);
    expect(s.isDemoLoaded).toBe(false);
  });

  it('does not write the saved store while a run is active', async () => {
    const { useStore, data } = await load();
    useStore.getState().addNote(note('a'));
    const before = data.get(KEY);
    expect(before).toBeTruthy();
    useStore.getState().beginDemoRun();
    useStore.getState().loadDemoData();
    useStore.getState().answerCard(useStore.getState().flashcards[0].id, true);
    expect(data.get(KEY)).toBe(before);
  });

  it('endDemoRun restores the snapshot exactly and saves it', async () => {
    const { useStore, takeSnapshot, data } = await load();
    useStore.getState().addNote(note('a'));
    useStore.getState().addNote(note('b'));
    const snapshot = takeSnapshot(useStore.getState());
    useStore.getState().beginDemoRun();
    useStore.getState().loadDemoData();
    useStore.getState().timeTravelDay();
    useStore.getState().endDemoRun(snapshot);
    const s = useStore.getState();
    expect(s.demoRunning).toBe(false);
    expect(s.notes).toEqual(snapshot.notes);
    expect(s.flashcards).toEqual(snapshot.flashcards);
    expect(s.reviewLog).toEqual(snapshot.reviewLog);
    const saved = JSON.parse(data.get(KEY)!) as { state: { notes: Note[]; demoRunning?: boolean } };
    expect(saved.state.notes).toEqual(snapshot.notes);
    expect(saved.state.demoRunning).toBeUndefined();
  });

  it('never persists demoRunning, and a reload starts with it false', async () => {
    const { useStore, data } = await load();
    useStore.getState().beginDemoRun();
    useStore.setState({ currentView: 'add' }); // write is suspended
    expect(data.get(KEY) ?? '').not.toContain('demoRunning');
    const again = await load({ [KEY]: JSON.stringify({ state: { demoRunning: true, notes: [] }, version: 0 }) });
    expect(again.useStore.getState().demoRunning).toBe(false);
  });

  it('does not mutate the snapshot after it is applied', async () => {
    const { useStore, takeSnapshot } = await load();
    useStore.getState().addNote(note('a'));
    const snapshot = takeSnapshot(useStore.getState());
    useStore.getState().beginDemoRun();
    useStore.getState().endDemoRun(snapshot);
    useStore.getState().deleteNote(useStore.getState().notes[0].id);
    expect(snapshot.notes).toHaveLength(1);
  });
});

describe('answer sounds during a run', () => {
  /** Records the volume of every tone the store starts. */
  function fakeAudio() {
    const volumes: number[] = [];
    class FakeContext {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator() {
        return { connect() {}, type: 'sine', frequency: { value: 0 }, start() {}, stop() {} };
      }
      createGain() {
        return {
          connect() {},
          gain: { setValueAtTime: (v: number) => void volumes.push(v), exponentialRampToValueAtTime() {} },
        };
      }
      resume() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    return volumes;
  }

  async function withDemoCards() {
    const loaded = await load();
    const mod = await import('./useStore');
    loaded.useStore.getState().beginDemoRun();
    loaded.useStore.getState().loadDemoData();
    return { ...loaded, scale: mod.DEMO_SOUND_SCALE };
  }

  it('are silent when neither the app sound nor the demo Sound button is on', async () => {
    const volumes = fakeAudio();
    const { useStore } = await withDemoCards();
    useStore.getState().answerCard('demo-card-bio-1', false);
    expect(volumes).toEqual([]);
  });

  it('play when the demo Sound button is on, at the lower demo volume', async () => {
    const volumes = fakeAudio();
    const { useStore, scale } = await withDemoCards();
    useStore.getState().setDemoSound(true);
    useStore.getState().answerCard('demo-card-bio-1', false); // wrong: a buzz at 0.3
    useStore.getState().answerCard('demo-card-bio-2', true); // right: a chime at 0.08
    expect(volumes[0]).toBeCloseTo(0.3 * scale, 10);
    expect(volumes).toContainEqual(expect.closeTo(0.08 * scale, 10));
    expect(scale).toBeLessThan(1);
  });

  it('Reveal counts as wrong and buzzes too', async () => {
    const volumes = fakeAudio();
    const { useStore, scale } = await withDemoCards();
    useStore.getState().setDemoSound(true);
    useStore.getState().answerCard('demo-card-bio-3', false); // Reveal calls answerCard(id, false)
    expect(volumes[0]).toBeCloseTo(0.3 * scale, 10);
  });

  it('stay silent after the Sound button is turned off again', async () => {
    const volumes = fakeAudio();
    const { useStore } = await withDemoCards();
    useStore.getState().setDemoSound(true);
    useStore.getState().setDemoSound(false);
    useStore.getState().answerCard('demo-card-bio-1', false);
    expect(volumes).toEqual([]);
  });

  it('the app sound setting still plays at full volume outside a run', async () => {
    const volumes = fakeAudio();
    const { useStore } = await load();
    useStore.getState().loadDemoData();
    useStore.getState().toggleSound();
    useStore.getState().answerCard('demo-card-bio-1', false);
    expect(volumes[0]).toBeCloseTo(0.3, 10);
  });

  it('are reset when the run ends, and the demo sound flag is never saved', async () => {
    fakeAudio();
    const { useStore, takeSnapshot, data } = await load();
    const snapshot = takeSnapshot(useStore.getState());
    useStore.getState().beginDemoRun();
    useStore.getState().setDemoSound(true);
    useStore.getState().endDemoRun(snapshot);
    expect(useStore.getState().demoSound).toBe(false);
    expect(data.get(KEY) ?? '').not.toContain('demoSound');
  });
});