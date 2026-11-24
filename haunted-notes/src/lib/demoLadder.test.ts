import { describe, it, expect } from 'vitest';
import { buildDemoData } from './demoData';
import { DEMO_STEPS } from './demoScript';
import { isDue, isLate, scheduleCorrect, nextReturnInMs, daysFromMs } from './srs';

const DAY = 86_400_000;

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
    const step = DEMO_STEPS.find((s) => s.id === 'srs-travel');
    const jump = step?.actions.find((a) => a.op === 'store' && a.name === 'timeTravelDay');
    expect(jump && jump.op === 'store' ? jump.times : undefined).toBe(2);
    expect(step?.caption).toContain('two days');
  });

  it('the dashboard would say the next ghost returns in 2 days right after the quiz', () => {
    const t0 = Date.now(); // the demo cards are built from the real clock
    const cards = answerAll(t0);
    const ms = nextReturnInMs(cards, t0);
    expect(ms).not.toBeNull();
    expect(daysFromMs(ms as number)).toBe(2);
  });
});
