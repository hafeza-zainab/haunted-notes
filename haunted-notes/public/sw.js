/* Haunted Notes service worker. Stamped at build time (see vite.config.ts). */
const BUILD_ID = '__BUILD_ID__'
const PRECACHE = "__PRECACHE_LIST__"
const PREFIX = 'haunted-shell-'
const CACHE = PREFIX + BUILD_ID
const SCOPE = self.registration.scope
const INDEX_URL = new URL('index.html', SCOPE).href
const SKIP_SUFFIXES = ['/sw.js', '/manifest.webmanifest', '.wasm', '.onnx', '.traineddata']

// An unstamped worker (for example served by `vite dev`) has an id starting with "__".
const UNSTAMPED = /^__/.test(BUILD_ID)

async function precache() {
  const cache = await caches.open(CACHE)
  for (const path of PRECACHE) {
    const url = new URL(path, SCOPE).href
    const response = await fetch(url, { cache: 'reload' })
    if (response.status !== 200) {
      throw new Error('Precache failed: ' + url)
    }
    await cache.put(url, response)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (UNSTAMPED) {
        await self.registration.unregister()
        return
      }
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

function shouldSkip(request, url) {
  if (request.method !== 'GET') return true
  if (url.origin !== self.location.origin) return true
  return SKIP_SUFFIXES.some((suffix) => url.pathname.endsWith(suffix))
}

async function navigate(request) {
  try {
    const response = await fetch(request)
    if (response.status === 200) {
      const cache = await caches.open(CACHE)
      await cache.put(INDEX_URL, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(INDEX_URL)
    if (cached) return cached
    throw error
  }
}

async function assetFirst(request) {
  // ignoreVary: module scripts and crossorigin styles are requested with an Origin
  // header, while precache stored them without one. Servers that send
  // `Vary: Origin` (vite preview does) would otherwise miss the cache offline.
  const cached = await caches.match(request, { ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (shouldSkip(request, url)) return
  event.respondWith(request.mode === 'navigate' ? navigate(request) : assetFirst(request))
})
