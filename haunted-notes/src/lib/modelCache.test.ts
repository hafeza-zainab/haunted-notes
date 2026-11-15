import { describe, it, expect } from 'vitest';
import { readModelStatus, MODEL_CACHE_NAME } from './modelCache';
import { REQUIRED_MODEL_FILES, WHISPER_MODEL_ID } from './offlineStatus';

interface FakeOptions {
  buckets?: Record<string, string[]>;
  throwOnOpen?: boolean;
}

function fakeStorage(opts: FakeOptions) {
  const calls = { open: 0 };
  const storage = {
    has: async (name: string) => Object.hasOwn(opts.buckets ?? {}, name),
    open: async (name: string) => {
      calls.open++;
      if (opts.throwOnOpen) throw new Error('boom');
      const urls = opts.buckets?.[name] ?? [];
      return { keys: async () => urls.map((url) => ({ url })) };
    },
  } as unknown as CacheStorage;
  return { storage, calls };
}

describe('readModelStatus', () => {
  it('missing bucket is not-downloaded and open is never called', async () => {
    const { storage, calls } = fakeStorage({});
    expect(await readModelStatus(storage)).toBe('not-downloaded');
    expect(calls.open).toBe(0);
  });

  it('a throwing open gives unknown', async () => {
    const { storage } = fakeStorage({ buckets: { [MODEL_CACHE_NAME]: [] }, throwOnOpen: true });
    expect(await readModelStatus(storage)).toBe('unknown');
  });

  it('no caches gives unknown', async () => {
    expect(await readModelStatus(undefined)).toBe('unknown');
  });

  it('a full bucket gives ready', async () => {
    const urls = REQUIRED_MODEL_FILES.map(
      (f) => `https://huggingface.co/${WHISPER_MODEL_ID}/resolve/main/${f}`,
    );
    const { storage } = fakeStorage({ buckets: { [MODEL_CACHE_NAME]: urls } });
    expect(await readModelStatus(storage)).toBe('ready');
  });
});
