import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  FIT_MARGIN_MS,
  MAX_TOTAL_MS,
  NARRATION_EXT,
  chapterWindows,
  fitReport,
  narrationFile,
  narrationSrc,
  type NarrationManifest,
} from './demoNarration';
import { CHAPTER_IDS, CHAPTER_TITLES, DEMO_STEPS, END_HOLD_MS, scriptTotalMs, type DemoStep } from './demoScript';

const dir = join(process.cwd(), 'public', 'demo-audio');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as NarrationManifest;

describe('manifest matches the script', () => {
  it('has one clip per chapter: same count, ids and order', () => {
    expect(manifest.version).toBe(1);
    expect(manifest.clips).toHaveLength(CHAPTER_TITLES.length);
    expect(manifest.clips.map((c) => c.chapterId)).toEqual([...CHAPTER_IDS]);
    expect(manifest.clips.map((c) => c.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('file names are chapter-N.<ext>, all with the same extension, as the runner builds them', () => {
    manifest.clips.forEach((c, i) => {
      expect(c.file).toBe(narrationFile(i));
      expect(c.file.endsWith(`.${NARRATION_EXT}`)).toBe(true);
    });
    expect(new Set(manifest.clips.map((c) => c.file.split('.').pop())).size).toBe(1);
  });

  it('every clip file exists and is not empty', () => {
    for (const c of manifest.clips) {
      const p = join(dir, c.file);
      expect(existsSync(p), c.file).toBe(true);
      expect(statSync(p).size, c.file).toBeGreaterThan(10_000);
    }
  });

  it('every duration is a positive whole number of milliseconds', () => {
    for (const c of manifest.clips) {
      expect(Number.isInteger(c.durationMs) && c.durationMs > 0, c.chapterId).toBe(true);
    }
  });

  it('durations match the WAV headers of the files (so they were measured, not guessed)', () => {
    for (const c of manifest.clips) {
      const b = readFileSync(join(dir, c.file));
      const channels = b.readUInt16LE(22);
      const rate = b.readUInt32LE(24);
      const bits = b.readUInt16LE(34);
      let pos = 12;
      let dataLen = 0;
      while (pos < b.length - 8) {
        const id = b.toString('ascii', pos, pos + 4);
        const len = b.readUInt32LE(pos + 4);
        if (id === 'data') {
          dataLen = len;
          break;
        }
        pos += 8 + len + (len % 2);
      }
      const ms = Math.round((dataLen / (rate * channels * (bits / 8))) * 1000);
      expect(Math.abs(ms - c.durationMs), c.file).toBeLessThanOrEqual(5);
    }
  });
});

describe('every clip fits its chapter', () => {
  const rows = fitReport(manifest, DEMO_STEPS);

  it('has a row for each of the nine chapters', () => {
    expect(rows.map((r) => r.chapter)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it(`each clip ends at least ${FIT_MARGIN_MS} ms before its chapter ends`, () => {
    for (const r of rows) {
      expect(r.fits, `${r.chapterId}: clip ${r.clipMs} ms in a ${r.lengthMs} ms chapter`).toBe(true);
      expect(r.headroomMs).toBeGreaterThanOrEqual(FIT_MARGIN_MS);
    }
  });

  it('the end chapter needed the hold: without it the End clip would not fit', () => {
    const without: DemoStep[] = DEMO_STEPS.map((s) =>
      s.id === 'end' ? { ...s, actions: s.actions.filter((a) => !(a.op === 'wait' && a.ms === END_HOLD_MS)) } : s,
    );
    const end = fitReport(manifest, without).find((r) => r.chapter === 8);
    expect(end?.fits).toBe(false);
  });

  it('the total stays under 2:55 with the hold', () => {
    expect(scriptTotalMs()).toBeLessThan(MAX_TOTAL_MS);
  });

  it('chapters start where the previous one ended, from 0 to the total', () => {
    const w = chapterWindows(DEMO_STEPS);
    expect(w[0].startMs).toBe(0);
    for (let i = 1; i < w.length; i++) expect(w[i].startMs).toBe(w[i - 1].startMs + w[i - 1].lengthMs);
    const last = w[w.length - 1];
    expect(last.startMs + last.lengthMs).toBe(scriptTotalMs());
  });
});

describe('narrationSrc', () => {
  it('is always a same-origin /demo-audio/ path', () => {
    for (let i = 0; i < 9; i++) {
      expect(narrationSrc(i)).toBe(`/demo-audio/chapter-${i + 1}.${NARRATION_EXT}`);
    }
  });

  it('for any input stays one of the nine /demo-audio/chapter-N files and never an external URL', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.double(), fc.constant(NaN)), (n) => {
        const s = narrationSrc(n);
        expect(s).toMatch(/^\/demo-audio\/chapter-[1-9]\.wav$/);
        expect(s).not.toMatch(/https?:|\/\//);
      }),
    );
  });

  it('found by a property test: 1e21 used to give chapter-1e+21.wav; out-of-range input is clamped', () => {
    expect(narrationFile(1e21)).toBe('chapter-9.wav');
    expect(narrationFile(-5)).toBe('chapter-1.wav');
    expect(narrationFile(NaN)).toBe('chapter-1.wav');
    expect(narrationFile(2.9)).toBe('chapter-3.wav');
  });
});

describe('fitReport properties', () => {
  const stepsArb = fc.array(
    fc.record({
      id: fc.constant('s'),
      chapter: fc.integer({ min: 0, max: 8 }),
      caption: fc.constant('c'),
      actions: fc.array(
        fc.record({ op: fc.constant('wait' as const), ms: fc.integer({ min: 0, max: 20_000 }) }),
        { minLength: 1, maxLength: 3 },
      ),
    }),
    { minLength: 1, maxLength: 30 },
  );

  it('headroom is chapter length minus clip, and fits matches the margin rule', () => {
    fc.assert(
      fc.property(stepsArb, fc.integer({ min: 0, max: 30_000 }), fc.integer({ min: 0, max: 2000 }), (steps, clip, margin) => {
        const sorted = [...steps].sort((a, b) => a.chapter - b.chapter) as DemoStep[];
        const m: NarrationManifest = {
          version: 1,
          clips: Array.from({ length: 9 }, (_, i) => ({
            chapterId: CHAPTER_IDS[i],
            chapter: i + 1,
            file: narrationFile(i),
            durationMs: clip,
          })),
        };
        for (const r of fitReport(m, sorted, margin)) {
          expect(r.headroomMs).toBe(r.lengthMs - r.clipMs);
          expect(r.fits).toBe(r.clipMs <= r.lengthMs - margin);
        }
      }),
    );
  });

  it('never throws on an empty manifest', () => {
    const rows = fitReport({ version: 1, clips: [] }, DEMO_STEPS);
    expect(rows).toHaveLength(9);
    for (const r of rows) expect(r.clipMs).toBe(0);
  });
});
