import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  GROWTH_CAP,
  LADDER_DAYS,
  defaultSrsFields,
  effectiveWeakness,
  isLate,
  ladderDays,
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
import { GHOST_TYPES, ghostTypeFor } from './haunt';

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

  it('follows the 2-3-5-7 ladder when answered on time, and stays at 7', () => {
    let card = defaultSrsFields(0);
    let t = 0;
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      card = scheduleCorrect(card, t);
      waits.push(card.intervalDays);
      t = card.dueAt; // answered exactly when it returns
    }
    expect(waits).toEqual([2, 3, 5, 7, 7, 7, 7]);
  });

  it('day numbers on the ladder: 0, 2, 5, 10, 17', () => {
    let card = defaultSrsFields(0);
    const days: number[] = [0];
    for (let i = 0; i < 4; i++) {
      card = scheduleCorrect(card, card.dueAt);
      days.push(card.dueAt / MS_PER_DAY);
    }
    expect(days).toEqual([0, 2, 5, 10, 17]);
  });

  it('on any reachable card the wait is one of 2, 3, 5, 7 (or half of one after a hint)', () => {
    fc.assert(
      fc.property(reachableArb, fc.boolean(), ({ card, now }, hinted) => {
        const next = scheduleCorrect(card, now, hinted);
        const allowed = hinted ? LADDER_DAYS.map((d) => d / 2) : [...LADDER_DAYS];
        expect(allowed).toContain(next.intervalDays);
      }),
    );
  });
});

describe('late answers stay on their rung', () => {
  const t0 = 1_000_000_000_000;
  const onRung2 = (): SrsFields => ({ ease: 2.5, intervalDays: 3, dueAt: t0, reps: 2 });

  it('a card answered more than its own wait late keeps reps and its wait', () => {
    const next = scheduleCorrect(onRung2(), t0 + 3 * MS_PER_DAY + 1);
    expect(next.reps).toBe(2);
    expect(next.intervalDays).toBe(3);
    expect(next.dueAt).toBe(t0 + 3 * MS_PER_DAY + 1 + 3 * MS_PER_DAY);
  });

  it('exactly one wait late still counts as on time and moves up', () => {
    const next = scheduleCorrect(onRung2(), t0 + 3 * MS_PER_DAY);
    expect(next.reps).toBe(3);
    expect(next.intervalDays).toBe(5);
  });

  it('answering early or on time moves up', () => {
    expect(scheduleCorrect(onRung2(), t0 - MS_PER_DAY).reps).toBe(3);
    expect(scheduleCorrect(onRung2(), t0).reps).toBe(3);
  });

  it('a new or wrong card is never late', () => {
    expect(isLate(defaultSrsFields(0), 10 * 365 * MS_PER_DAY)).toBe(false);
    expect(isLate(scheduleWrong(onRung2(), t0), t0 + 400 * MS_PER_DAY)).toBe(false);
  });

  it('a late answer never moves a card up and always returns it later than now', () => {
    fc.assert(
      fc.property(reachableArb, fc.integer({ min: 0, max: 400 }), ({ card, now }, extraDays) => {
        fc.pre(card.reps > 0);
        const t = card.dueAt + (card.intervalDays + extraDays) * MS_PER_DAY + 1;
        const next = scheduleCorrect(card, t);
        expect(next.reps).toBe(card.reps);
        expect(next.dueAt).toBeGreaterThan(t);
        expect(now).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('ladderDays', () => {
  it('maps steps to 2, 3, 5, 7 and clamps outside the ladder', () => {
    expect([0, 1, 2, 3, 4, 99].map(ladderDays)).toEqual([2, 3, 5, 7, 7, 7]);
    expect(ladderDays(-5)).toBe(2);
    expect(ladderDays(NaN)).toBe(2);
    expect(ladderDays(Infinity)).toBe(2);
  });

  it('is non-decreasing and always on the ladder', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10, max: 1000 }), (i) => {
        expect(LADDER_DAYS).toContain(ladderDays(i));
        expect(ladderDays(i + 1)).toBeGreaterThanOrEqual(ladderDays(i));
      }),
    );
  });
});

describe('effectiveWeakness', () => {
  const due = 5_000_000_000;
  const card = (w: number) => ({ weaknessScore: w, dueAt: due });

  it('adds nothing before the due time, on the due day and after one full day', () => {
    expect(effectiveWeakness(card(0.4), due - 5 * MS_PER_DAY)).toBe(0.4);
    expect(effectiveWeakness(card(0.4), due)).toBe(0.4);
    expect(effectiveWeakness(card(0.4), due + 2 * MS_PER_DAY - 1)).toBe(0.4);
  });

  it('adds 0.05 per further full day, capped at 0.2', () => {
    expect(effectiveWeakness(card(0.4), due + 2 * MS_PER_DAY)).toBeCloseTo(0.45, 10);
    expect(effectiveWeakness(card(0.4), due + 4 * MS_PER_DAY)).toBeCloseTo(0.55, 10);
    expect(effectiveWeakness(card(0.4), due + 5 * MS_PER_DAY)).toBeCloseTo(0.6, 10);
    expect(effectiveWeakness(card(0.4), due + 400 * MS_PER_DAY)).toBeCloseTo(0.6, 10);
  });

  it('never goes above 1 and handles bad numbers', () => {
    expect(effectiveWeakness(card(0.95), due + 50 * MS_PER_DAY)).toBe(1);
    expect(effectiveWeakness(card(NaN), due + 50 * MS_PER_DAY)).toBeCloseTo(0.2, 10);
    expect(effectiveWeakness({ weaknessScore: 0.3, dueAt: NaN }, 1)).toBe(0.3);
    expect(effectiveWeakness(card(0.3), NaN)).toBe(0.3);
  });

  it('is between the stored score and stored + 0.2, within [0, 1], and never falls as time passes', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1, max: 2, noNaN: true }),
        fc.integer({ min: 0, max: 8_000_000_000_000 }),
        fc.integer({ min: 0, max: 8_000_000_000_000 }),
        fc.integer({ min: 0, max: 100 * MS_PER_DAY }),
        (w, dueAt, now, later) => {
          const stored = Math.min(1, Math.max(0, w));
          const a = effectiveWeakness({ weaknessScore: w, dueAt }, now);
          const b = effectiveWeakness({ weaknessScore: w, dueAt }, now + later);
          expect(a).toBeGreaterThanOrEqual(stored);
          expect(a).toBeLessThanOrEqual(Math.min(1, stored + GROWTH_CAP) + 1e-12);
          expect(a).toBeGreaterThanOrEqual(0);
          expect(a).toBeLessThanOrEqual(1);
          expect(b).toBeGreaterThanOrEqual(a - 1e-12);
        },
      ),
    );
  });

  it('an ignored ghost grows at most one ghost type', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.integer({ min: 0, max: 1000 }), (w, days) => {
        const grown = effectiveWeakness({ weaknessScore: w, dueAt: 0 }, days * MS_PER_DAY);
        const up = GHOST_TYPES.indexOf(ghostTypeFor(grown)) - GHOST_TYPES.indexOf(ghostTypeFor(w));
        expect(up).toBeGreaterThanOrEqual(0);
        expect(up).toBeLessThanOrEqual(1);
        expect(grown - w).toBeLessThanOrEqual(GROWTH_CAP + 1e-12);
      }),
    );
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

  it('leaves ease unchanged, however many wrong answers', () => {
    fc.assert(
      fc.property(reachableArb, fc.integer({ min: 1, max: 30 }), ({ card, now }, n) => {
        let c = card;
        for (let i = 0; i < n; i++) c = scheduleWrong(c, now);
        expect(c.ease).toBeGreaterThanOrEqual(1.3);
      }),
    );
  });

  it('ease stays at its default over any answer history', () => {
    fc.assert(
      fc.property(reachableArb, ({ card }) => {
        expect(card.ease).toBe(2.5);
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

// ── Hinted correct answers ────────────────────────────────────────────────────

describe('scheduleCorrect with a hint', () => {
  it('returns sooner than an unhinted correct answer from the same state', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        const plain = scheduleCorrect(card, now, false);
        const hinted = scheduleCorrect(card, now, true);
        expect(hinted.intervalDays).toBeLessThan(plain.intervalDays);
        expect(hinted.dueAt).toBeLessThan(plain.dueAt);
      }),
    );
  });

  it('still banishes the ghost: reps up by one, due in the future, ease unchanged', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        const hinted = scheduleCorrect(card, now, true);
        expect(hinted.reps).toBe(card.reps + 1);
        expect(hinted.dueAt).toBeGreaterThan(now);
        expect(hinted.ease).toBe(card.ease);
        expect(isBanished(hinted, now)).toBe(true);
      }),
    );
  });

  it('an unhinted call is unchanged by the new parameter', () => {
    fc.assert(
      fc.property(reachableArb, ({ card, now }) => {
        expect(scheduleCorrect(card, now, false)).toEqual(scheduleCorrect(card, now));
      }),
    );
  });
});
