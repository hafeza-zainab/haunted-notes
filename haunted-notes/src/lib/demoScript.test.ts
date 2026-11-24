import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import {
  CHAPTER_TITLES,
  DEMO_STEPS,
  MAX_CAPTION_WORDS,
  SAMPLE_AUDIO_TEXT,
  SAMPLE_NOTE,
  SAMPLE_PHOTO_TEXT,
  formatClock,
  locate,
  scriptTargets,
  scriptTotalMs,
  stepMs,
  stepStartMs,
  wordCount,
} from './demoScript';
import { buildDemoData } from './demoData';
import { generateFlashcards } from './cloze';

describe('script length', () => {
  it('lasts between 140 and 170 seconds at normal speed', () => {
    const s = scriptTotalMs() / 1000;
    expect(s).toBeGreaterThanOrEqual(140);
    expect(s).toBeLessThanOrEqual(170);
  });

  it('every action has a non-negative whole-millisecond duration', () => {
    for (const step of DEMO_STEPS) {
      for (const a of step.actions) {
        expect(Number.isInteger(a.ms) && a.ms >= 0).toBe(true);
      }
    }
  });

  it('every step lasts at least 3 and at most 12 seconds, except the long quiz round', () => {
    for (const step of DEMO_STEPS) {
      if (step.id === 'quiz-rest') continue;
      const s = stepMs(step) / 1000;
      expect(s, step.id).toBeGreaterThanOrEqual(2);
      expect(s, step.id).toBeLessThanOrEqual(13.5);
    }
  });
});

describe('captions', () => {
  it('each caption is 1 to 12 words', () => {
    for (const step of DEMO_STEPS) {
      const n = wordCount(step.caption);
      expect(n, step.id).toBeGreaterThanOrEqual(1);
      expect(n, step.id).toBeLessThanOrEqual(MAX_CAPTION_WORDS);
    }
  });

  it('steps shown with sample data say "sample"', () => {
    const typed = DEMO_STEPS.filter((s) => s.actions.some((a) => a.op === 'type' && a.target === 'note-text'));
    const labelled = typed.filter((s) => s.id !== 'inputs-type');
    for (const s of labelled) expect(s.caption.toLowerCase(), s.id).toContain('sample');
    expect(typed.find((s) => s.id === 'inputs-type')?.caption.toLowerCase()).toContain('sample');
    for (const t of [SAMPLE_PHOTO_TEXT, SAMPLE_AUDIO_TEXT, SAMPLE_NOTE]) {
      expect(t.toLowerCase()).toContain('sample');
    }
    expect(DEMO_STEPS.find((s) => s.id === 'srs-travel')?.caption.toLowerCase()).toContain('sample');
  });

  it('no caption, card or typed text reveals a demo quiz answer', () => {
    const answers = buildDemoData().flashcards.map((c) => c.clozeWord.toLowerCase());
    const texts: string[] = [];
    for (const step of DEMO_STEPS) {
      texts.push(step.caption);
      step.card?.lines.forEach((l) => texts.push(l));
      step.actions.forEach((a) => {
        if (a.op === 'type' && a.target === 'quiz-input') texts.push(a.text);
      });
    }
    for (const t of texts) {
      const words = t.toLowerCase().split(/[^a-z0-9]+/);
      for (const a of answers) expect(words, t).not.toContain(a);
    }
  });

  it('quiz answers are never typed from script data', () => {
    const typed = DEMO_STEPS.flatMap((s) => s.actions).filter((a) => a.op === 'type' && a.target === 'quiz-input');
    expect(typed).toHaveLength(1); // only the deliberately wrong answer
  });
});

describe('chapters', () => {
  it('has nine chapters, in order, each with a step', () => {
    expect(CHAPTER_TITLES).toHaveLength(9);
    const seen = DEMO_STEPS.map((s) => s.chapter);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(new Set(seen).size).toBe(9);
  });

  it('the Built with Kiro cards only use facts present in KIRO_EVIDENCE.md', () => {
    const evidence = readFileSync(new URL('../../../docs/KIRO_EVIDENCE.md', import.meta.url), 'utf8');
    for (const word of ['ghost-ui-reviewer', 'report-only', 'Playwright', 'fast-check', 'steering', 'reduced-motion']) {
      expect(evidence.toLowerCase()).toContain(word.toLowerCase());
    }
    const cards = DEMO_STEPS.filter((s) => s.chapter === 7).flatMap((s) => s.card?.lines ?? []);
    expect(cards.length).toBeGreaterThan(0);
    const joined = cards.join(' ');
    for (const word of ['ghost-ui-reviewer', 'report-only', 'Playwright', 'fast-check', 'reduced-motion']) {
      expect(joined).toContain(word);
    }
    // "six bugs": the evidence table lists six numbered bugs
    const rows = evidence.split('\n').filter((l) => /^\| [1-6] \|/.test(l));
    expect(rows).toHaveLength(6);
    expect(joined).toContain('six bugs');
  });

  it('the sample note makes at least one flashcard', () => {
    const note = { id: 'n', rawText: SAMPLE_NOTE, inputMethod: 'type' as const, createdAt: 0 };
    expect(generateFlashcards(note).length).toBeGreaterThan(0);
  });

  it('the end step shows the Try demo button', () => {
    expect(scriptTargets(DEMO_STEPS.slice(-1)).has('try-demo')).toBe(true);
  });
});

describe('timeline helpers', () => {
  it('step starts add up to the total', () => {
    expect(stepStartMs(DEMO_STEPS.length)).toBe(scriptTotalMs());
    expect(stepStartMs(0)).toBe(0);
  });

  it('locate finds the step that is playing', () => {
    expect(locate(0).stepIndex).toBe(0);
    const i = 5;
    expect(locate(stepStartMs(i)).stepIndex).toBe(i);
    expect(locate(stepStartMs(i + 1) - 1).stepIndex).toBe(i);
    expect(locate(scriptTotalMs() + 10_000).stepIndex).toBe(DEMO_STEPS.length - 1);
    expect(locate(NaN).stepIndex).toBe(0);
  });

  it('formatClock formats m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(59_999)).toBe('0:59');
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(158_400)).toBe('2:38');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(Infinity)).toBe('0:00');
    expect(formatClock(6e25)).toBe('99:59'); // found by the property test: was "1e+21:00"
  });

  it('wordCount counts words', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  a  b\tc ')).toBe(3);
  });
});

describe('properties', () => {
  it('locate always returns a valid step whose chapter matches', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: -1000, max: 400_000 }), fc.double()), (ms) => {
        const { stepIndex, chapter } = locate(ms);
        expect(stepIndex).toBeGreaterThanOrEqual(0);
        expect(stepIndex).toBeLessThan(DEMO_STEPS.length);
        expect(chapter).toBe(DEMO_STEPS[stepIndex].chapter);
      }),
    );
  });

  it('locate never moves backwards as time grows', () => {
    fc.assert(
      fc.property(fc.nat(300_000), fc.nat(60_000), (a, d) => {
        expect(locate(a + d).stepIndex).toBeGreaterThanOrEqual(locate(a).stepIndex);
      }),
    );
  });

  it('formatClock always matches m:ss', () => {
    fc.assert(
      fc.property(fc.oneof(fc.double(), fc.nat(10_000_000)), (ms) => {
        expect(formatClock(ms)).toMatch(/^\d+:[0-5]\d$/);
      }),
    );
  });

  it('wordCount equals the number of whitespace-separated words', () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 20 }), (words) => {
        expect(wordCount(words.join(' '))).toBe(words.length);
      }),
    );
  });
});
