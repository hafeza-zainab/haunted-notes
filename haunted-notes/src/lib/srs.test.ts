import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  defaultSrsFields,
  scheduleCorrect,
  scheduleWrong,
  isDue,
  isBanished,
  isReturned,
  cardStatus,
  nextReturnInMs,
  daysFromMs,
} from './srs';
import type { SrsFields } from '../types';

const MS_PER_DAY = 86_400_000;

// ── Generators ────────────────────────────────────────────────────────────────

const nowArb = fc.integer({ min: 0, max: 4_000_000_000_000 });

/** Any SrsFields at all, including states the app can never reach. */
const anySrsArb: fc.Arbitrary<SrsFields> = fc.record({
  ease: fc.double({ min: 0, max: 10, noNaN: true }),
  intervalDays: fc.integer({ min: 0, max: 10_000 }),
  dueAt: fc.integer({ min: 0, max: 8_000_000_000_000 }),
  reps: fc.integer({ min: 0, max: 50 }),
});

/**
 * A card reached by really answering: start from the defaults and apply a
 * random history of correct (true) / wrong (false) answers, one per day.
 */
const reachableArb: fc.Arbitrary<{ card: SrsFields; now: number }> = fc
  .tuple(nowArb, fc.array(fc.boolean(), { maxLength: 25 }))
  .map(([start, history]) => {
    let card = defaultSrsFields(start);
    let now = start;
    for (const correct of history) {
      now += MS_PER_DAY;
      card = correct ? scheduleCorrect(card, now) : scheduleWrong(card, now);
    }
    return { card, now };
  });

const lastReviewedArb = fc.option(fc.integer({ min: 0, max: 4_000_000_000_000 }), {
  nil: null,
});

// ── Scheduling properties ─────────────────────────────────────────────────────

describe('scheduleCorrect', () => {
  it('interval never decreases over consecutive correct answers', () => {
    fc.assert(
      fc.property(reachableArb, fc.integer({ min: 1, max: 15 }), ({ card, now }, n) => {
        let c = card;
        let t = now;
        for (let i = 0; i < n; i++) {
          t += MS_PER_DAY;
          const next = scheduleCorrect(c, t);
          // The first correct after a wrong (interval 0) goes up to 1; never down.
          expect(next.intervalDays).toBeGreaterThanOrEqual(c.intervalDays);
          c = next;
        }
      }),
    );
  });

  it('dueAt moves forward: always strictly after the answer time', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        expect(scheduleCorrect(card, now).dueAt).toBeGreaterThan(now);
      }),
    );
  });

  it('increments reps and leaves ease unchanged', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        const next = scheduleCorrect(card, now);
        expect(next.reps).toBe(card.reps + 1);
        expect(next.ease).toBe(card.ease);
      }),
    );
  });

  it('follows the 1 day, 3 days, interval x ease ramp', () => {
    const t = 1_000_000;
    const first = scheduleCorrect(defaultSrsFields(t), t);
    const second = scheduleCorrect(first, t);
    const third = scheduleCorrect(second, t);
    expect(first.intervalDays).toBe(1);
    expect(second.intervalDays).toBe(3);
    expect(third.intervalDays).toBe(Math.round(3 * 2.5));
  });
});

describe('scheduleWrong', () => {
  it('always sets reps to 0, interval to 0 and dueAt to now (any starting state)', () => {
    fc.assert(
      fc.property(anySrsArb, nowArb, (card, now) => {
        const next = scheduleWrong(card, now);
        expect(next.reps).toBe(0);
        expect(next.intervalDays).toBe(0);
        expect(next.dueAt).toBe(now);
      }),
    );
  });

  it('ease never drops below 1.3, even after many wrong answers', () => {
    fc.assert(
      fc.property(reachableArb, fc.integer({ min: 1, max: 30 }), ({ card, now }, n) => {
        let c = card;
        for (let i = 0; i < n; i++) c = scheduleWrong(c, now);
        expect(c.ease).toBeGreaterThanOrEqual(1.3);
      }),
    );
  });

  it('ease stays at or above 1.3 over any answer history', () => {
    fc.assert(
      fc.property(reachableArb, ({ card }) => {
        expect(card.ease).toBeGreaterThanOrEqual(1.3);
      }),
    );
  });
});

// ── isDue / isBanished / cardStatus properties ───────────────────────────────

describe('isDue', () => {
  it('is false whenever reps is 0', () => {
    fc.assert(
      fc.property(anySrsArb, nowArb, (card, now) => {
        expect(isDue({ ...card, reps: 0 }, now)).toBe(false);
      }),
    );
  });

  it('isReturned is the same as isDue', () => {
    fc.assert(
      fc.property(anySrsArb, nowArb, (card, now) => {
        expect(isReturned(card, now)).toBe(isDue(card, now));
      }),
    );
  });
});

describe('isBanished', () => {
  it('is always false when reps is 0', () => {
    fc.assert(
      fc.property(anySrsArb, nowArb, (card, now) => {
        expect(isBanished({ ...card, reps: 0 }, now)).toBe(false);
      }),
    );
  });

  it('is never true when isDue is true', () => {
    fc.assert(
      fc.property(anySrsArb, nowArb, (card, now) => {
        if (isDue(card, now)) expect(isBanished(card, now)).toBe(false);
      }),
    );
  });

  it('for a scheduled card (reps > 0) exactly one of isDue / isBanished holds', () => {
    fc.assert(
      fc.property(anySrsArb, nowArb, (card, now) => {
        fc.pre(card.reps > 0);
        expect(isDue(card, now) !== isBanished(card, now)).toBe(true);
      }),
    );
  });

  it('a correct answer banishes the ghost until dueAt, then it returns', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        const next = scheduleCorrect(card, now);
        expect(isBanished(next, now)).toBe(true);
        expect(isDue(next, now)).toBe(false);
        expect(isDue(next, next.dueAt)).toBe(true);
        expect(isBanished(next, next.dueAt)).toBe(false);
      }),
    );
  });

  it('a wrong answer keeps the ghost haunting', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        const next = scheduleWrong(card, now);
        expect(isBanished(next, now)).toBe(false);
        expect(isDue(next, now)).toBe(false); // reps is 0, so it is haunting, not "returned"
      }),
    );
  });
});

describe('cardStatus', () => {
  it('exactly one of new / haunting / due / banished holds for any card', () => {
    fc.assert(
      fc.property(anySrsArb, lastReviewedArb, nowArb, (srs, lastReviewed, now) => {
        const card = { ...srs, lastReviewed };
        const flags = {
          new: card.reps === 0 && card.lastReviewed === null,
          haunting: card.reps === 0 && card.lastReviewed !== null,
          due: isDue(card, now),
          banished: isBanished(card, now),
        };
        const holding = Object.entries(flags).filter(([, v]) => v);
        expect(holding).toHaveLength(1);
        expect(cardStatus(card, now)).toBe(holding[0][0]);
      }),
    );
  });

  it('a brand-new card is new, never due', () => {
    fc.assert(
      fc.property(nowArb, (now) => {
        const card = { ...defaultSrsFields(now), lastReviewed: null };
        expect(cardStatus(card, now)).toBe('new');
        expect(isDue(card, now)).toBe(false);
      }),
    );
  });
});

describe('nextReturnInMs', () => {
  it('is null when nothing is banished', () => {
    fc.assert(
      fc.property(fc.array(anySrsArb, { maxLength: 20 }), nowArb, (cards, now) => {
        fc.pre(!cards.some((c) => isBanished(c, now)));
        expect(nextReturnInMs(cards, now)).toBeNull();
      }),
    );
  });

  it('is positive and equals the soonest banished dueAt minus now', () => {
    fc.assert(
      fc.property(fc.array(anySrsArb, { minLength: 1, maxLength: 20 }), nowArb, (cards, now) => {
        const banished = cards.filter((c) => isBanished(c, now));
        fc.pre(banished.length > 0);
        const result = nextReturnInMs(cards, now);
        expect(result).toBe(Math.min(...banished.map((c) => c.dueAt)) - now);
        expect(result).toBeGreaterThan(0);
      }),
    );
  });

  it('ignores new and returned cards', () => {
    const now = 10 * MS_PER_DAY;
    const fresh = defaultSrsFields(now);
    const returned = { ...defaultSrsFields(now), reps: 1, dueAt: now - 1 };
    const banished = { ...defaultSrsFields(now), reps: 1, dueAt: now + 3 * MS_PER_DAY };
    expect(nextReturnInMs([fresh, returned, banished], now)).toBe(3 * MS_PER_DAY);
    expect(nextReturnInMs([fresh, returned], now)).toBeNull();
  });

  it('a correct answer returns the ghost after exactly the new interval', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        const next = scheduleCorrect(card, now);
        expect(nextReturnInMs([next], now)).toBe(next.intervalDays * MS_PER_DAY);
      }),
    );
  });
});

describe('daysFromMs', () => {
  it('rounds up and is never below 1', () => {
    expect(daysFromMs(1)).toBe(1);
    expect(daysFromMs(MS_PER_DAY)).toBe(1);
    expect(daysFromMs(MS_PER_DAY + 1)).toBe(2);
    expect(daysFromMs(3 * MS_PER_DAY)).toBe(3);
  });

  it('always covers the wait: days x 86 400 000 >= ms, and is the smallest such whole number', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000 * MS_PER_DAY }), (ms) => {
        const d = daysFromMs(ms);
        expect(d * MS_PER_DAY).toBeGreaterThanOrEqual(ms);
        expect((d - 1) * MS_PER_DAY).toBeLessThan(ms);
      }),
    );
  });
});
