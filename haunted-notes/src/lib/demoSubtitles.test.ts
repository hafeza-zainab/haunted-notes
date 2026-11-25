import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEMO_STEPS,
  MAX_CAPTION_WORDS,
  SAMPLE_DATA_LABEL,
  SAMPLE_TIME_LABEL,
  stepStartMs,
  wordCount,
} from './demoScript';
import type { NarrationManifest } from './demoNarration';

/**
 * The captions are subtitles: the words of the narration, shown when they are spoken.
 * These tests tie three things together: NARRATION_SCRIPT.md (the words that were turned
 * into audio), the cues in the manifest (when each phrase starts in each clip, measured
 * from the audio), and the captions in the script (when each phrase is shown).
 */

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'public', 'demo-audio', 'manifest.json'), 'utf8')) as NarrationManifest;

const norm = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();

/** The narration text of each chapter, from the table in NARRATION_SCRIPT.md. */
function narrationRows(): Map<number, string> {
  const src = readFileSync(join(root, '..', 'NARRATION_SCRIPT.md'), 'utf8');
  const rows = new Map<number, string>();
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^\|\s*([1-9])\s+[^|]+\|[^|]*\|[^|]*\|\s*(.+?)\s*\|\s*$/);
    if (m) rows.set(Number(m[1]), norm(m[2]));
  }
  return rows;
}

const rows = narrationRows();

/** Chapter-relative start of every step of a chapter, in ms. */
function stepStarts(chapter: number): { caption: string; startMs: number }[] {
  const idx = DEMO_STEPS.map((s, i) => ({ s, i })).filter(({ s }) => s.chapter === chapter);
  const base = stepStartMs(idx[0].i);
  return idx.map(({ s, i }) => ({ caption: s.caption, startMs: stepStartMs(i) - base }));
}

describe('NARRATION_SCRIPT.md is found and complete', () => {
  it('has the text of all nine chapters', () => {
    expect([...rows.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const text of rows.values()) expect(text.length).toBeGreaterThan(20);
  });
});

describe('the captions are the narration, word for word', () => {
  for (let ch = 0; ch < 9; ch++) {
    it(`chapter ${ch + 1}: the captions joined together equal the narration text`, () => {
      const joined = norm(stepStarts(ch).map((s) => s.caption).join(' '));
      expect(joined).toBe(rows.get(ch + 1));
    });

    it(`chapter ${ch + 1}: the manifest cues joined together equal the narration text`, () => {
      const joined = norm(manifest.clips[ch].cues.map((c) => c.text).join(' '));
      expect(joined).toBe(rows.get(ch + 1));
    });

    it(`chapter ${ch + 1}: caption i is cue i, with the same words`, () => {
      const steps = stepStarts(ch);
      const cues = manifest.clips[ch].cues;
      expect(steps.map((s) => s.caption)).toEqual(cues.map((c) => c.text));
    });
  }

  it('every caption is 12 words or fewer', () => {
    for (const step of DEMO_STEPS) {
      expect(wordCount(step.caption), step.id).toBeLessThanOrEqual(MAX_CAPTION_WORDS);
    }
  });
});

describe('each caption appears when its words are spoken', () => {
  const LEAD_MAX_MS = 200; // a caption may come up to 200 ms after the phrase starts (sound start-up)
  const LEAD_MAX_ESTIMATED_MS = 600;

  for (let ch = 0; ch < 9; ch++) {
    it(`chapter ${ch + 1}: every caption starts within ${LEAD_MAX_MS} ms after its cue`, () => {
      const steps = stepStarts(ch);
      const cues = manifest.clips[ch].cues;
      steps.forEach((s, i) => {
        const lead = s.startMs - cues[i].startMs;
        const max = cues[i].estimated ? LEAD_MAX_ESTIMATED_MS : LEAD_MAX_MS;
        expect(lead, `${cues[i].text} (cue ${cues[i].startMs}, step ${s.startMs})`).toBeGreaterThanOrEqual(0);
        expect(lead, `${cues[i].text} (cue ${cues[i].startMs}, step ${s.startMs})`).toBeLessThanOrEqual(max);
      });
    });
  }

  it('cues are in order and inside their clip', () => {
    for (const clip of manifest.clips) {
      expect(clip.cues[0].startMs, clip.chapterId).toBe(0);
      clip.cues.forEach((c, i) => {
        expect(c.startMs, clip.chapterId).toBeLessThan(clip.durationMs);
        if (i > 0) expect(c.startMs, clip.chapterId).toBeGreaterThan(clip.cues[i - 1].startMs);
      });
    }
  });
});

describe('cue times agree with the audio files', () => {
  /** rms of the clip in a window, 0..32767. */
  function rmsAt(file: string, fromMs: number, toMs: number): number {
    const b = readFileSync(join(root, 'public', 'demo-audio', file));
    const rate = b.readUInt32LE(24);
    let pos = 12;
    let off = 0;
    let len = 0;
    while (pos < b.length - 8) {
      const id = b.toString('ascii', pos, pos + 4);
      const l = b.readUInt32LE(pos + 4);
      if (id === 'data') {
        off = pos + 8;
        len = l;
        break;
      }
      pos += 8 + l + (l % 2);
    }
    const a = Math.max(0, Math.floor((fromMs / 1000) * rate));
    const z = Math.min(Math.floor(len / 2), Math.floor((toMs / 1000) * rate));
    let sum = 0;
    for (let i = a; i < z; i++) {
      const v = b.readInt16LE(off + i * 2);
      sum += v * v;
    }
    return z > a ? Math.sqrt(sum / (z - a)) : 0;
  }

  it('a measured cue starts after a quiet gap and before speech', () => {
    for (const clip of manifest.clips) {
      for (const cue of clip.cues) {
        if (cue.startMs === 0 || cue.estimated) continue;
        const before = rmsAt(clip.file, cue.startMs - 200, cue.startMs - 40);
        const after = rmsAt(clip.file, cue.startMs + 40, cue.startMs + 440); // a soft first sound (th, f) needs a longer look
        expect(before, `${clip.chapterId} "${cue.text}" before ${cue.startMs}`).toBeLessThan(350);
        expect(after, `${clip.chapterId} "${cue.text}" after ${cue.startMs}`).toBeGreaterThan(350);
      }
    }
  });

  it('the first cue of every clip is followed by speech', () => {
    for (const clip of manifest.clips) {
      expect(rmsAt(clip.file, 200, 600), clip.chapterId).toBeGreaterThan(350);
    }
  });
});

describe('sample data and simulated time are said so in the bar', () => {
  it('every step that types sample text or jumps the clock carries a sample label', () => {
    for (const step of DEMO_STEPS) {
      const typesSample = step.actions.some((a) => a.op === 'type' && a.target === 'note-text');
      const jumps = step.actions.some((a) => a.op === 'store' && a.name === 'timeTravelDay');
      if (typesSample) expect(step.sample, step.id).toBe(SAMPLE_DATA_LABEL);
      if (jumps) expect(step.sample, step.id).toBe(SAMPLE_TIME_LABEL);
    }
  });

  it('the labels say "sample"', () => {
    expect(SAMPLE_DATA_LABEL.toLowerCase()).toContain('sample');
    expect(SAMPLE_TIME_LABEL.toLowerCase()).toContain('sample');
  });
});
