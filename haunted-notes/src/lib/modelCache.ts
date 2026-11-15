import { modelStatus, type ModelStatus } from './offlineStatus';

/** Cache Storage bucket where the Whisper library keeps downloaded model files. */
export const MODEL_CACHE_NAME = 'transformers-cache';

/**
 * Reads which model files are cached. Never fetches, never creates the bucket,
 * never imports the heavy library.
 */
export async function readModelStatus(
  cacheStorage: CacheStorage | undefined = typeof caches === 'undefined' ? undefined : caches,
): Promise<ModelStatus> {
  if (!cacheStorage) return 'unknown';
  try {
    if (!(await cacheStorage.has(MODEL_CACHE_NAME))) return 'not-downloaded';
    const cache = await cacheStorage.open(MODEL_CACHE_NAME);
    const requests = await cache.keys();
    return modelStatus(requests.map((r) => r.url));
  } catch {
    return 'unknown';
  }
}
