// Generates the PWA icons as PNG files. Run once: node scripts/make-icons.mjs
// Uses only node:zlib and node:fs. The output files are committed.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BG = [0x0d, 0x0d, 0x14]
const BODY = [0xe8, 0xe6, 0xf5]
const EYE = [0x0d, 0x0d, 0x14]
const GLOW = [0x8b, 0x7c, 0xff]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Ghost in unit coordinates (0..1), centered at 0.5. Returns a layer name or null.
function ghostAt(u, v) {
  // body: half disc on top, straight sides, wavy bottom
  const cx = 0.5
  const r = 0.5
  const top = 0.0
  const dx = u - cx
  const cy = top + r
  let inBody = false
  if (v <= cy) inBody = dx * dx + (v - cy) * (v - cy) <= r * r
  else {
    const bottom = 0.92 + 0.08 * Math.sin(((u - 0.0) / 1.0) * Math.PI * 6)
    inBody = Math.abs(dx) <= r && v <= bottom
  }
  if (!inBody) return null
  const ex = 0.17
  const ey = 0.42
  const er = 0.075
  for (const sx of [-1, 1]) {
    const ddx = u - (cx + sx * ex)
    const ddy = v - ey
    if (ddx * ddx + ddy * ddy <= er * er) return 'eye'
  }
  const mdx = u - cx
  const mdy = v - 0.62
  if ((mdx * mdx) / (0.07 * 0.07) + (mdy * mdy) / (0.05 * 0.05) <= 1) return 'eye'
  return 'body'
}

function render(size, scale) {
  const buf = Buffer.alloc(size * size * 4)
  const SS = 3
  const off = (1 - scale) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size
          const py = (y + (sy + 0.5) / SS) / size
          const u = (px - off) / scale
          const v = (py - off) / scale
          const layer = ghostAt(u, v)
          let c = BG
          if (layer === 'body') c = BODY
          else if (layer === 'eye') c = EYE
          else {
            // soft glow around the ghost
            const gd = Math.hypot(u - 0.5, v - 0.5)
            const k = Math.max(0, 1 - gd / 0.9) * 0.18
            c = BG.map((bgc, i) => Math.round(bgc + (GLOW[i] - bgc) * k))
          }
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      buf[i] = Math.round(r / n)
      buf[i + 1] = Math.round(g / n)
      buf[i + 2] = Math.round(b / n)
      buf[i + 3] = 255
    }
  }
  return buf
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// Maskable: ghost stays inside the central 80% safe zone (scale 0.6 leaves margin for the wave and glow).
const targets = [
  ['icon-192.png', 192, 0.72],
  ['icon-512.png', 512, 0.72],
  ['icon-maskable-512.png', 512, 0.6],
]
for (const [name, size, scale] of targets) {
  writeFileSync(join(outDir, name), encodePng(size, render(size, scale)))
  console.log('wrote', name)
}
