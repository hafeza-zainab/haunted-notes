/**
 * Shared Vitest setup. Tests run in Node, which has no `window`, so every store
 * write hit the localStorage wrapper's catch and printed "could not save to
 * localStorage ... window is not defined". Give the environment an in-memory
 * `window.localStorage` instead, cleared before each test.
 *
 * Assigned directly (not with vi.stubGlobal) so that a test file's own
 * vi.stubGlobal('window', ...) plus vi.unstubAllGlobals() restores this value.
 */
import { beforeEach } from 'vitest';

const data = new Map<string, string>();
const memoryStorage = {
  get length() {
    return data.size;
  },
  key: (i: number) => [...data.keys()][i] ?? null,
  getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    data.set(k, String(v));
  },
  removeItem: (k: string) => {
    data.delete(k);
  },
  clear: () => data.clear(),
} as unknown as Storage;

const g = globalThis as unknown as { window?: unknown; localStorage?: Storage };
if (g.window === undefined) g.window = { localStorage: memoryStorage };
if (g.localStorage === undefined) g.localStorage = memoryStorage;

beforeEach(() => {
  data.clear();
});
