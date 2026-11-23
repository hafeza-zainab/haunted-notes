import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEY = 'haunted-notes-storage';

async function load() {
  const data = new Map<string, string>();
  const storage = {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  vi.resetModules();
  return { useStore: (await import('./useStore')).useStore, storage };
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('60-second tour in the store', () => {
  it('starts closed', async () => {
    const { useStore } = await load();
    expect(useStore.getState().tourStep).toBeNull();
  });

  it('startTour loads the demo and opens step 0 on the dashboard', async () => {
    const { useStore } = await load();
    useStore.setState({ currentView: 'add' });
    useStore.getState().startTour();
    const s = useStore.getState();
    expect(s.isDemoLoaded).toBe(true);
    expect(s.notes.length).toBeGreaterThan(0);
    expect(s.tourStep).toBe(0);
    expect(s.currentView).toBe('dashboard');
  });

  it('startTour does not load the demo twice', async () => {
    const { useStore } = await load();
    useStore.getState().startTour();
    const count = useStore.getState().flashcards.length;
    useStore.getState().endTour();
    useStore.getState().startTour();
    expect(useStore.getState().flashcards.length).toBe(count);
  });

  it('walks every step, opens an unfiltered quiz for step 4, and closes after the last', async () => {
    const { useStore } = await load();
    useStore.setState({ quizNoteId: 'x', quizDueOnly: true });
    useStore.getState().startTour();
    const views: string[] = [useStore.getState().currentView];
    for (let i = 0; i < 4; i++) {
      useStore.getState().advanceTour();
      views.push(useStore.getState().currentView);
      if (useStore.getState().tourStep === 3) {
        expect(useStore.getState().quizNoteId).toBeNull();
        expect(useStore.getState().quizDueOnly).toBe(false);
      }
    }
    expect(views).toEqual(['dashboard', 'dashboard', 'dashboard', 'quiz', 'dashboard']);
    useStore.getState().advanceTour();
    expect(useStore.getState().tourStep).toBeNull();
  });

  it('replayTour opens step 0 on the dashboard and never loads or reloads the demo', async () => {
    const { useStore } = await load();
    useStore.getState().loadDemoData();
    const before = useStore.getState().flashcards;
    useStore.setState({ currentView: 'add' });
    useStore.getState().replayTour();
    const s = useStore.getState();
    expect(s.tourStep).toBe(0);
    expect(s.currentView).toBe('dashboard');
    expect(s.flashcards).toBe(before);
  });

  it('replayTour with your own notes does not add demo notes', async () => {
    const { useStore } = await load();
    useStore.getState().addNote({ rawText: 'The heart pumps blood around the whole body every day.', inputMethod: 'type' });
    const notes = useStore.getState().notes;
    useStore.getState().replayTour();
    expect(useStore.getState().notes).toBe(notes);
    expect(useStore.getState().isDemoLoaded).toBe(false);
    expect(useStore.getState().tourStep).toBe(0);
  });

  it('endTour closes it, and the tour step is never persisted', async () => {
    const { useStore, storage } = await load();
    useStore.getState().startTour();
    expect(storage.data.get(KEY)).not.toContain('tourStep');
    useStore.getState().endTour();
    expect(useStore.getState().tourStep).toBeNull();
  });
});
