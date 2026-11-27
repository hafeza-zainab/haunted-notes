import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_STEPS, MAX_CAPTION_WORDS, scriptTotalMs, stepMs, wordCount } from './demoScript';
import type { NarrationManifest } from './demoNarration';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'public', 'demo-audio', 'manifest.json'), 'utf8')) as NarrationManifest;
const runner = readFileSync(join(root, 'src', 'demo', 'runner.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Dashboard elements: chapter 1 may only point at things that are on the dashboard with the demo data. */
const DASHBOARD_TARGETS = new Set([
  'rooms-grid',
  'ladder',
  'start-quiz',
  'haunt-meter',
  'next-return',
  'insights',
  'ghost-wisp',
  'ghost-ghoul',
  'ghost-banshee',
  'ghost-phantom',
  'ghost-poltergeist',
]);

describe('chapter 1: the project works from second 0', () => {
  const pitch = DEMO_STEPS.filter((s) => s.chapter === 0);

  it('has no title card: no step of chapter 1 shows a text card', () => {
    expect(pitch.length).toBeGreaterThan(0);
    for (const s of pitch) expect(s.card, s.id).toBeUndefined();
  });

  it('every chapter 1 step points at something on the dashboard, and none navigates away', () => {
    for (const s of pitch) {
      for (const a of s.actions) {
        expect(a.op === 'highlight', `${s.id} uses ${a.op}`).toBe(true);
        if (a.op === 'highlight') expect(DASHBOARD_TARGETS.has(a.target), `${s.id}: ${a.target}`).toBe(true);
      }
      expect(s.actions.length, s.id).toBeGreaterThan(0);
    }
  });

  it('the very first step already shows the dashboard with ghosts (it highlights the rooms)', () => {
    const first = pitch[0].actions[0];
    expect(first.op === 'highlight' && first.target).toBe('rooms-grid');
  });

  it('the runner loads the built-in demo data before the first sound and before the first caption', () => {
    const begin = runner.indexOf('useStore.getState().beginDemoRun()');
    const load = runner.indexOf("runStoreAction('loadDemoOnly')");
    const firstClip = runner.indexOf('narrator.chapterStarted(0, 0, 0)');
    const wait = runner.indexOf('await waitForFirstSound(');
    const play = runner.indexOf('await play()');
    expect(begin).toBeGreaterThan(-1);
    expect(load).toBeGreaterThan(begin);
    expect(firstClip).toBeGreaterThan(load);
    expect(wait).toBeGreaterThan(firstClip);
    expect(play).toBeGreaterThan(wait);
  });

  it('the story is the narration: the problem, the schedule, the answers', () => {
    const text = pitch.map((s) => s.caption).join(' ');
    expect(text).toBe(
      'Taking notes is easy. Knowing what to revise, and when, across many subjects, is the hard part. ' +
        'Haunted Notes turns your notes into ghosts and remembers the revision schedule for you. ' +
        'You only have to remember the answers.',
    );
  });
});

describe('chapters 5 and 9', () => {
  it('the ladder line is its own caption: "so you never track dates yourself."', () => {
    const s = DEMO_STEPS.find((x) => x.caption === 'so you never track dates yourself.');
    expect(s?.chapter).toBe(4);
  });

  it('keeps every earlier step of chapter 5 as a visual, including the five-day jump', () => {
    const srs = DEMO_STEPS.filter((s) => s.chapter === 4);
    const targets = new Set(srs.flatMap((s) => s.actions.flatMap((a) => ('target' in a ? [a.target] : []))));
    for (const t of ['next-return', 'ladder', 'returned-ghost']) expect(targets.has(t), t).toBe(true);
    const jumps = srs.flatMap((s) => s.actions.flatMap((a) => (a.op === 'store' && a.name === 'timeTravelDay' ? [a.times] : [])));
    expect(jumps).toEqual([2, 5]);
  });

  it('the close says "You remember the answers. Haunted Notes remembers when." and keeps the end card', () => {
    const end = DEMO_STEPS.filter((s) => s.chapter === 8);
    expect(end.slice(0, 2).map((s) => s.caption).join(' ')).toBe('You remember the answers. Haunted Notes remembers when.');
    expect(end.some((s) => s.actions.some((a) => a.op === 'highlight' && a.target === 'try-demo'))).toBe(true);
  });
});

describe('no dead time, no live typing', () => {
  it('no step only waits, unless it shows a text card', () => {
    for (const s of DEMO_STEPS) {
      const onlyWaits = s.actions.every((a) => a.op === 'wait');
      if (onlyWaits) expect(s.card, `${s.id} waits and shows nothing`).toBeDefined();
    }
  });

  it('no wait action sits between other actions: waits are only the card steps', () => {
    for (const s of DEMO_STEPS) {
      if (s.actions.some((a) => a.op === 'wait')) {
        expect(s.actions.length, s.id).toBe(1);
        expect(s.card, s.id).toBeDefined();
      }
    }
  });

  it('the sample texts are put in at once (fill), never typed live', () => {
    const typed = DEMO_STEPS.flatMap((s) => s.actions.filter((a) => a.op === 'type').map((a) => ({ id: s.id, a })));
    for (const { id, a } of typed) {
      expect(a.op === 'type' && a.target, `${id} types into ${a.op === 'type' ? a.target : ''}`).toBe('quiz-input');
    }
    const fills = DEMO_STEPS.flatMap((s) => s.actions.filter((a) => a.op === 'fill'));
    expect(fills.length).toBe(3); // photo, audio and the sample note
    for (const f of fills) expect(f.op === 'fill' && f.target).toBe('note-text');
  });

  it('the tab walk-through is kept: Type, Live mic, Photo and Audio file are all clicked', () => {
    const clicks = new Set(DEMO_STEPS.flatMap((s) => s.actions.flatMap((a) => (a.op === 'click' ? [a.target] : []))));
    for (const t of ['tab-type', 'tab-mic', 'tab-photo', 'tab-audio', 'add-note-submit']) expect(clicks.has(t), t).toBe(true);
  });
});

describe('time budget', () => {
  it('the whole run is 170 s or less, and at least as long as all the narration', () => {
    expect(scriptTotalMs()).toBeLessThanOrEqual(170_000);
    expect(scriptTotalMs()).toBeGreaterThanOrEqual(manifest.clips.reduce((s, c) => s + c.durationMs, 0));
  });

  it('each chapter is at least its clip plus 1.4 s (0.4 s margin, 1 s start-up allowance)', () => {
    const len = new Map<number, number>();
    for (const s of DEMO_STEPS) len.set(s.chapter, (len.get(s.chapter) ?? 0) + stepMs(s));
    manifest.clips.forEach((c, i) => {
      expect(len.get(i) ?? 0, c.chapterId).toBeGreaterThanOrEqual(c.durationMs + 1400);
    });
  });

  it('every caption is 12 words or fewer and there is one for each cue of the manifest', () => {
    for (const s of DEMO_STEPS) expect(wordCount(s.caption), s.id).toBeLessThanOrEqual(MAX_CAPTION_WORDS);
    const perChapter = new Map<number, number>();
    for (const s of DEMO_STEPS) perChapter.set(s.chapter, (perChapter.get(s.chapter) ?? 0) + 1);
    manifest.clips.forEach((c, i) => expect(perChapter.get(i), c.chapterId).toBe(c.cues.length));
  });
});

describe('accuracy: the right method, and no claims about other apps', () => {
  const CLAIMS = /1-3-7|other apps|no other app|unlike (other|most)|only app|nobody else|no app /i;

  it('no caption, card or sample text says "1-3-7" or makes a claim about other apps', () => {
    for (const s of DEMO_STEPS) {
      expect(s.caption, s.id).not.toMatch(CLAIMS);
      for (const line of s.card?.lines ?? []) expect(line, s.id).not.toMatch(CLAIMS);
    }
  });

  it('the narration manifest never says "1-3-7" either', () => {
    for (const c of manifest.clips) for (const cue of c.cues) expect(cue.text).not.toMatch(CLAIMS);
  });

  it('the ladder is described as 2-3-5-7 in README.md, KIRO_WRITEUP.md, docs/*.md and DEMO_SCRIPT.md (never "1-3-7")', () => {
    const repo = join(root, '..');
    const files = ['README.md', 'KIRO_WRITEUP.md', 'DEMO_SCRIPT.md'].map((f) => join(repo, f));
    const docs = join(repo, 'docs');
    if (existsSync(docs)) for (const f of readdirSync(docs)) if (f.endsWith('.md')) files.push(join(docs, f));
    for (const f of files) {
      if (!existsSync(f)) continue;
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/1-3-7/);
    }
  });

  it('README has a "Why Haunted Notes" section near the top, with the 2-3-5-7 ladder', () => {
    const readme = readFileSync(join(root, '..', 'README.md'), 'utf8');
    const why = readme.indexOf('Why Haunted Notes');
    expect(why).toBeGreaterThan(-1);
    expect(why).toBeLessThan(1200); // near the top
    const para = readme.slice(why, why + 700);
    expect(para).toContain('Taking notes is easy.');
    expect(para).toContain('2-3-5-7');
  });
});
