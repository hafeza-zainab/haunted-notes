import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEY = 'haunted-notes-storage';
const BACKUP = 'haunted-notes-storage-backup';

function makeStorage(initial: Record<string, string> = {}, failBackup = false) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (failBackup && k === BACKUP) throw new DOMException('quota', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

async function load(initial: Record<string, string> = {}, failBackup = false) {
  const storage = makeStorage(initial, failBackup);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  vi.resetModules();
  const useStore = (await import('./useStore')).useStore;
  return { useStore, storage };
}

const note = { id: 'n1', rawText: 'The heart pumps blood around the body.', inputMethod: 'type', createdAt: 1 };
const wrap = (state: unknown) => JSON.stringify({ state, version: 0 });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('safer loading of saved data', () => {
  it('valid saved data: no notice and no backup key', async () => {
    const raw = wrap({ notes: [note], flashcards: [] });
    const { useStore, storage } = await load({ [KEY]: raw });
    expect(useStore.getState().loadNotice).toBeNull();
    expect(storage.data.has(BACKUP)).toBe(false);
    expect(useStore.getState().notes).toHaveLength(1);
  });

  it('nothing saved: no notice and no backup key', async () => {
    const { useStore, storage } = await load();
    expect(useStore.getState().loadNotice).toBeNull();
    expect(storage.data.has(BACKUP)).toBe(false);
  });

  it('dropped items: backup equals the original raw value, notice counts them', async () => {
    const raw = wrap({ notes: [note, null, 5], flashcards: [] });
    const { useStore, storage } = await load({ [KEY]: raw });
    expect(storage.data.get(BACKUP)).toBe(raw);
    expect(useStore.getState().loadNotice).toEqual({ dropped: 2, unreadable: false, backedUp: true });
    expect(useStore.getState().notes).toHaveLength(1);
  });

  it('unreadable value: backup equals the raw value, app starts empty, notice shown', async () => {
    const raw = '{not json';
    const { useStore, storage } = await load({ [KEY]: raw });
    expect(storage.data.get(BACKUP)).toBe(raw);
    expect(useStore.getState().loadNotice?.unreadable).toBe(true);
    expect(useStore.getState().notes).toEqual([]);
  });

  it('never overwrites an existing backup', async () => {
    const { storage } = await load({ [KEY]: wrap({ notes: [null], flashcards: [] }), [BACKUP]: 'older backup' });
    expect(storage.data.get(BACKUP)).toBe('older backup');
  });

  it('the notice is not persisted, and dismiss clears it', async () => {
    const { useStore, storage } = await load({ [KEY]: wrap({ notes: [note, null], flashcards: [] }) });
    expect(useStore.getState().loadNotice).not.toBeNull();
    useStore.getState().addNote({ rawText: 'The liver filters blood in the body every day.', inputMethod: 'type' });
    expect(storage.data.get(KEY)).not.toContain('loadNotice');
    useStore.getState().dismissLoadNotice();
    expect(useStore.getState().loadNotice).toBeNull();
  });

  it('the backup is made before the cleaned state is saved', async () => {
    const raw = wrap({ notes: [note, null], flashcards: [] });
    const { useStore, storage } = await load({ [KEY]: raw });
    useStore.getState().addNote({ rawText: 'The liver filters blood in the body every day.', inputMethod: 'type' });
    expect(storage.data.get(KEY)).not.toBe(raw);
    expect(storage.data.get(BACKUP)).toBe(raw);
  });

  it('a quota error while writing the backup does not throw and the notice says so', async () => {
    const { useStore } = await load({ [KEY]: wrap({ notes: [null], flashcards: [] }) }, true);
    expect(useStore.getState().loadNotice).toEqual({ dropped: 1, unreadable: false, backedUp: false });
  });
});
