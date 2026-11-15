import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8')) as {
  name: string
  short_name: string
  start_url: string
  scope: string
  display: string
  background_color: string
  theme_color: string
  icons: { src: string; sizes: string; type: string; purpose?: string }[]
}
const html = readFileSync(join(root, 'index.html'), 'utf8')

describe('manifest', () => {
  it('has the required fields and colors', () => {
    expect(manifest.name).toBe('Haunted Notes')
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.background_color).toBe('#0d0d14')
    expect(manifest.theme_color).toBe('#0d0d14')
  })

  it('uses relative URLs', () => {
    for (const url of [manifest.start_url, manifest.scope, ...manifest.icons.map((i) => i.src)]) {
      expect(url.startsWith('/')).toBe(false)
      expect(url).not.toMatch(/^[a-z]+:/i)
    }
  })

  it('has a maskable icon and 192 and 512 sizes', () => {
    const sizes = manifest.icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it.each(manifest.icons.map((i) => [i.src, i.sizes] as const))(
    'icon %s is a PNG of size %s',
    (src, sizes) => {
      const buf = readFileSync(join(root, 'public', src))
      expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR')
      expect(`${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`).toBe(sizes)
    },
  )
})

describe('index.html', () => {
  it('links the manifest and apple touch icon', () => {
    expect(html).toMatch(/<link rel="manifest" href="manifest\.webmanifest"/)
    expect(html).toMatch(/<link rel="apple-touch-icon" href="icons\/icon-192\.png"/)
  })
})
