/** Pure helpers that stamp the built service worker. No imports. */

export const SW_BUILD_TOKEN = '__BUILD_ID__'
export const SW_PRECACHE_TOKEN = '"__PRECACHE_LIST__"'

/** Replace both tokens in the worker source. Uses function replacers so `$` in input is literal. */
export function stampServiceWorker(
  source: string,
  buildId: string,
  urls: readonly string[],
): string {
  const list = JSON.stringify(urls)
  return source
    .split(SW_PRECACHE_TOKEN)
    .join(list)
    .split(SW_BUILD_TOKEN)
    .join(buildId)
}

/** Build id: first 12 characters of the hash of the sorted, de-duplicated file names. */
export function makeBuildId(
  fileNames: readonly string[],
  hash: (s: string) => string,
): string {
  const sorted = Array.from(new Set(fileNames)).sort()
  return hash(sorted.join('\n')).slice(0, 12)
}

/** Keep `index.html` and `assets/*.js|css`, then append extras, sort and de-duplicate. */
export function selectPrecacheUrls(
  fileNames: readonly string[],
  extra: readonly string[],
): string[] {
  const shell = fileNames.filter(
    (name) =>
      name === 'index.html' ||
      (name.startsWith('assets/') && /\.(js|css)$/.test(name)),
  )
  return Array.from(new Set([...shell, ...extra])).sort()
}
