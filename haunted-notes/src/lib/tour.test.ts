import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TOUR_STEPS, nextTourStep, tourStepAt } from './tour';
import { buildDemoData } from './demoData';

const whole = (text: string, word: string) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

describe('TOUR_STEPS', () => {
  it('has the five steps in order', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['rooms', 'returned', 'start-quiz', 'hint-reveal', 'insights']);
  });

  it('ids are unique and every step has a short title and sentence', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text.length).toBeLessThanOrEqual(120);
      expect(s.target.length).toBeGreaterThan(0);
    }
  });

  it('only the hint and reveal step opens the quiz', () => {
    expect(TOUR_STEPS.filter((s) => s.view === 'quiz').map((s) => s.id)).toEqual(['hint-reveal']);
  });

  it('never contains a demo answer', () => {
    const answers = buildDemoData().flashcards.map((c) => c.clozeWord);
    for (const s of TOUR_STEPS) {
      for (const a of answers) {
        expect(whole(s.title, a)).toBe(false);
        expect(whole(s.text, a)).toBe(false);
      }
    }
  });
});

describe('nextTourStep and tourStepAt', () => {
  it('walks 0 to 4 and then ends', () => {
    expect([0, 1, 2, 3].map((i) => nextTourStep(i))).toEqual([1, 2, 3, 4]);
    expect(nextTourStep(4)).toBeNull();
  });

  it('invalid input ends the tour', () => {
    for (const v of [null, -1, 1.5, Number.NaN, 99]) expect(nextTourStep(v)).toBeNull();
    for (const v of [null, -1, 1.5, 5]) expect(tourStepAt(v)).toBeNull();
    expect(tourStepAt(0)?.id).toBe('rooms');
  });

  it('Feature: judge-tour, the next step is always the following valid index or null', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: -10, max: 20 }), fc.double(), fc.constant(null)), (i) => {
        const n = nextTourStep(i);
        if (n !== null) {
          expect(n).toBe((i as number) + 1);
          expect(tourStepAt(n)).not.toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });
});
