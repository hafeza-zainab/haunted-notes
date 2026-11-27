import { describe, it, expect } from 'vitest';
import { buildDemoData } from './demoData';
import { DEMO_STEPS } from './demoScript';
import { isDue, isLate, scheduleCorrect, nextReturnInMs, daysFromMs, effectiveWeakness, GROWTH_CAP } from './srs';

const DAY = 86_400_000;

/** The step whose actions jump the clock 
 days (by calling the store's timeTravelDay 
 times). */
function jumpStep(n: number) {
  return DEMO_STEPS.find((s) =>
    s.actions.some((a) => a.op === 'store' && a.name === 'timeTravelDay' && a.times === n),
  );
}

/** What the Run demo does to the cards, on the 2-3-5-7 ladder. */
describe('Run demo on the 2-3-5-7 ladder', () => {
  const answerAll = (t0: number) => {
    const { flashcards } = buildDemoData();
    return flashcards.map((c) => ({ ...c, ...scheduleCorrect(c, t0) }));
  };

  it('the built-in returned cards are on the 2-day rung and are not late', () => {
    const t = Date.now();
    const cards = buildDemoData().flashcards.filter((c) => c.reps > 0);
    expect(cards).toHaveLength(2);
    for (const c of cards) {
      expect(c.intervalDays).toBe(2);
      expect(isLate(c, t)).toBe(false);
    }
  });

  it('after two one-day jumps the cards answered once are due, and the 3-day ones are not', () => {
    const t0 = Date.now(); // the demo cards are built from the real clock
    const cards = answerAll(t0).map((c) => ({ ...c, dueAt: c.dueAt - 2 * DAY }));
    const due = cards.filter((c) => isDue(c, t0));
    expect(due).toHaveLength(7);
    for (const c of cards.filter((x) => x.id === 'demo-card-java-jvm' || x.id === 'demo-card-mktg-content')) {
      expect(isDue(c, t0)).toBe(false);
    }
  });

  it('one day is not enough: the script jumps two days', () => {
    const t0 = Date.now(); // the demo cards are built from the real clock
    const one = answerAll(t0).map((c) => ({ ...c, dueAt: c.dueAt - DAY }));
    expect(one.filter((c) => isDue(c, t0))).toHaveLength(0);
    const step = jumpStep(2);
    expect(step, 'a step jumps the clock two days').toBeDefined();
    expect(step?.caption).toBe('Skip ahead, and the ghosts that are due return, glowing orange.');
    expect(step?.sample?.toLowerCase()).toContain('sample');
  });

  it('the dashboard would say the next ghost returns in 2 days right after the quiz', () => {
    const t0 = Date.now(); // the demo cards are built from the real clock
    const cards = answerAll(t0);
    const ms = nextReturnInMs(cards, t0);
    expect(ms).not.toBeNull();
    expect(daysFromMs(ms as number)).toBe(2);
  });

  it('the ignore step: five more days make every returned ghost stronger, by the capped amount', () => {
    const t0 = Date.now();
    const jump = (days: number) => answerAll(t0).map((c) => ({ ...c, dueAt: c.dueAt - days * DAY }));
    // After the two-day jump nobody is overdue yet, so nothing has grown.
    for (const c of jump(2).filter((x) => isDue(x, t0))) {
      expect(effectiveWeakness(c, t0)).toBe(c.weaknessScore);
    }
    // Five more days: the seven returned ghosts are five days overdue, which hits the cap.
    const grown = jump(7).filter((x) => isDue(x, t0) && x.dueAt <= t0 - 5 * DAY);
    expect(grown.length).toBeGreaterThanOrEqual(7);
    for (const c of grown) {
      const stored = c.weaknessScore;
      expect(effectiveWeakness(c, t0)).toBeCloseTo(Math.min(1, stored + GROWTH_CAP), 10);
    }
    const step = jumpStep(5);
    expect(step, 'a step jumps the clock five more days').toBeDefined();
    // The new narration no longer says "ignore them longer, and they look stronger", so the five-day
    // jump is a silent visual at the end of the "Skip ahead" step, after the two-day jump.
    expect(step?.caption).toBe('Skip ahead, and the ghosts that are due return, glowing orange.');
    expect(step?.sample?.toLowerCase()).toContain('sample');
    const days = (step?.actions ?? []).flatMap((a) => (a.op === 'store' && a.name === 'timeTravelDay' ? [a.times] : []));
    expect(days).toEqual([2, 5]);
  });
});
