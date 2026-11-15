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
})
