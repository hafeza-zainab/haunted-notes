import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  makeBuildId,
  selectPrecacheUrls,
  stampServiceWorker,
  SW_BUILD_TOKEN,
  SW_PRECACHE_TOKEN,
} from './swStamp'

const swSource = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')

describe('stampServiceWorker', () => {
  it('replaces both tokens in the real sw.js', () => {
    expect(swSource).toContain(SW_BUILD_TOKEN)
    expect(swSource).toContain(SW_PRECACHE_TOKEN)
    const out = stampServiceWorker(swSource, 'abc123def456', ['index.html'])
    expect(out).not.toContain(SW_BUILD_TOKEN)
    expect(out).not.toContain(SW_PRECACHE_TOKEN)
    expect(out).toContain("'abc123def456'")
  })
})

describe('selectPrecacheUrls', () => {
  it('keeps shell files, drops maps, wasm, onnx and sw.js, appends extras sorted', () => {
    const out = selectPrecacheUrls(
      [
        'sw.js',
        'index.html',
        'assets/index-a.js',
        'assets/index-a.js.map',
        'assets/ort.wasm',
        'assets/model.onnx',
        'assets/style-b.css',
      ],
      ['manifest.webmanifest'],
    )
    expect(out).toEqual([
      'assets/index-a.js',
      'assets/style-b.css',
      'index.html',
      'manifest.webmanifest',
    ])
  })
})

describe('makeBuildId', () => {
  const hash = (s: string) => {
    let h = 0
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return h.toString(16).padStart(8, '0').repeat(2)
  }
  it('differs when a file name changes and has 12 characters', () => {
    const a = makeBuildId(['index.html', 'assets/a-1.js'], hash)
    const b = makeBuildId(['index.html', 'assets/a-2.js'], hash)
    expect(a).not.toBe(b)
    expect(a).toHaveLength(12)
  })
})

describe('properties', () => {
  // Feature: data-safety-offline, Property 15: Service worker stamping replaces both tokens
  it('Property 15: stamping replaces both tokens', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[0-9a-f]{12}$/),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 20 }),
        (id, urls) => {
          const out = stampServiceWorker(swSource, id, urls)
          expect(out).not.toContain(SW_BUILD_TOKEN)
          expect(out).not.toContain(SW_PRECACHE_TOKEN)
          expect(out).toContain(id)
          const line = out.split('\n').find((l) => l.startsWith('const PRECACHE = '))
          expect(line).toBeDefined()
          expect(JSON.parse((line as string).slice('const PRECACHE = '.length))).toEqual(urls)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: data-safety-offline, Property 16: Precache selection keeps only shell files
  it('Property 16: precache selection keeps only shell files', () => {
    const name = fc.oneof(
      fc.constantFrom('index.html', 'sw.js', 'assets/a.js', 'assets/b.css', 'assets/a.js.map', 'assets/x.wasm', 'assets/m.onnx'),
      fc.stringMatching(/^assets\/[a-z0-9-]{1,10}\.(js|css|map|wasm|onnx)$/),
      fc.stringMatching(/^[a-z]{1,8}\.(html|js|svg)$/),
    )
    fc.assert(
      fc.property(fc.array(name, { maxLength: 30 }), (names) => {
        const out = selectPrecacheUrls(names, [])
        expect(out).toEqual([...out].sort())
        expect(new Set(out).size).toBe(out.length)
        for (const u of out) {
          expect(u).not.toMatch(/\.(map|wasm|onnx)$/)
          expect(u).not.toBe('sw.js')
        }
        for (const n of names) {
          if (n === 'index.html' || /^assets\/.*\.(js|css)$/.test(n)) {
            expect(out).toContain(n)
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe('public/sw.js source scan', () => {
  it('has no model or OCR hosts', () => {
    const lower = swSource.toLowerCase()
    for (const word of ['transformers-cache', 'huggingface', 'jsdelivr', 'tesseract']) {
      expect(lower).not.toContain(word)
    }
  })

  it('deletes only haunted-shell- caches', () => {
    const calls = swSource.match(/caches\.delete\(/g) ?? []
    expect(calls).toHaveLength(1)
    expect(swSource).toMatch(/startsWith\(PREFIX\)[\s\S]{0,80}caches\.delete\(/)
    expect(swSource).toContain("const PREFIX = 'haunted-shell-'")
  })

  it('calls skipWaiting and clients.claim and skips heavy files', () => {
    expect(swSource).toContain('skipWaiting()')
    expect(swSource).toContain('clients.claim()')
    for (const ext of ['.wasm', '.onnx', '.traineddata']) {
      expect(swSource).toContain(`'${ext}'`)
    }
  })

  it('matches cached shell assets with ignoreVary (crossorigin requests carry an Origin header)', () => {
    const assetFirst = swSource.slice(swSource.indexOf('async function assetFirst'))
    expect(assetFirst).toMatch(/caches\.match\(request, \{ ignoreVary: true \}\)/)
  })
})

describe('narration clips and the service worker', () => {
  interface FetchEventLike {
    request: { method: string; url: string; mode: string }
    respondWith: (p: Promise<unknown>) => void
  }

  /** Run the real sw.js against a fake worker scope and return its fetch listener. */
  function loadFetchListener(): (e: FetchEventLike) => void {
    let fetchListener: ((e: FetchEventLike) => void) | undefined
    const fakeSelf = {
      registration: { scope: 'http://localhost/', unregister: async () => true },
      location: { origin: 'http://localhost' },
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
      addEventListener: (type: string, fn: (e: FetchEventLike) => void) => {
        if (type === 'fetch') fetchListener = fn
      },
    }
    const fakeCaches = {
      match: async () => undefined,
      open: async () => ({ put: async () => undefined }),
      keys: async () => [] as string[],
      delete: async () => true,
    }
    const fakeFetch = async () => ({ status: 404, type: 'basic', clone: () => ({}) })
    new Function('self', 'caches', 'fetch', swSource)(fakeSelf, fakeCaches, fakeFetch)
    if (!fetchListener) throw new Error('sw.js did not register a fetch listener')
    return fetchListener
  }

  async function intercepts(path: string): Promise<boolean> {
    const listener = loadFetchListener()
    let responded: Promise<unknown> | null = null
    listener({
      request: { method: 'GET', url: `http://localhost${path}`, mode: 'no-cors' },
      respondWith: (p) => {
        responded = p
      },
    })
    if (responded) await (responded as Promise<unknown>).catch(() => undefined)
    return responded !== null
  }

  it('does not intercept /demo-audio/ requests (media sends range requests)', async () => {
    expect(await intercepts('/demo-audio/chapter-1.wav')).toBe(false)
    expect(await intercepts('/demo-audio/manifest.json')).toBe(false)
    expect(await intercepts('/some/base/demo-audio/chapter-9.wav')).toBe(false)
  })

  it('still handles ordinary shell assets, and still skips the heavy files', async () => {
    expect(await intercepts('/assets/index-abc.js')).toBe(true)
    expect(await intercepts('/model.wasm')).toBe(false)
    expect(await intercepts('/sw.js')).toBe(false)
  })

  it('puts /demo-audio/ in the same bypass section as the heavy files', () => {
    expect(swSource).toMatch(/const SKIP_DIRS = \['\/demo-audio\/'\]/)
  })

  it('never precaches a clip, whatever the file list or the extras contain', () => {
    const out = selectPrecacheUrls(
      ['index.html', 'assets/a.js', 'demo-audio/chapter-1.wav', 'assets/demo-audio/x.js'],
      ['manifest.webmanifest', 'demo-audio/manifest.json', 'demo-audio/chapter-2.wav'],
    )
    expect(out).toEqual(['assets/a.js', 'index.html', 'manifest.webmanifest'])
  })

  it('Property: no precache entry ever contains demo-audio/', () => {
    fc.assert(
      fc.property(fc.array(fc.string()), fc.array(fc.string()), (names, extra) => {
        const out = selectPrecacheUrls([...names, 'demo-audio/chapter-3.wav'], [...extra, 'demo-audio/x'])
        expect(out.some((n) => n.includes('demo-audio/'))).toBe(false)
      }),
    )
  })

  it('the build config does not list the clips as extra precache files', () => {
    const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8')
    const list = config.slice(config.indexOf('EXTRA_PRECACHE'), config.indexOf(']', config.indexOf('EXTRA_PRECACHE')))
    expect(list).not.toContain('demo-audio')
  })

  it('netlify.toml caches /demo-audio/* for an hour', () => {
    const toml = readFileSync(join(process.cwd(), '..', 'netlify.toml'), 'utf8')
    const block = toml.slice(toml.indexOf('for = "/demo-audio/*"'))
    expect(block).toMatch(/^for = "\/demo-audio\/\*"\s+\[headers\.values\]\s+Cache-Control = "public, max-age=3600"/)
  })
})