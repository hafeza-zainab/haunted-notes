import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import {
  makeBuildId,
  selectPrecacheUrls,
  stampServiceWorker,
  SW_BUILD_TOKEN,
  SW_PRECACHE_TOKEN,
} from './src/lib/swStamp.ts'

// Files copied from public/ that the worker precaches alongside the bundle.
const EXTRA_PRECACHE = [
  'manifest.webmanifest',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
]

function swStampPlugin(): Plugin {
  return {
    name: 'haunted-sw-stamp',
    apply: 'build',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? 'dist'
      const fileNames = Object.keys(bundle)
      const sha = (s: string) => createHash('sha256').update(s).digest('hex')
      const buildId = makeBuildId(fileNames, sha)
      const urls = selectPrecacheUrls(fileNames, EXTRA_PRECACHE)
      const swPath = join(outDir, 'sw.js')
      const stamped = stampServiceWorker(readFileSync(swPath, 'utf8'), buildId, urls)
      if (stamped.includes(SW_BUILD_TOKEN) || stamped.includes(SW_PRECACHE_TOKEN)) {
        throw new Error('haunted-sw-stamp: a token remains in sw.js')
      }
      writeFileSync(swPath, stamped)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swStampPlugin()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // @huggingface/transformers uses dynamic imports and top-level await;
    // excluding it from pre-bundling avoids CommonJS transform issues.
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'esnext',
  },
  test: {
    // Property tests can be slow on busy or slower machines; 30 s avoids false timeouts.
    testTimeout: 30000,
  },
})
