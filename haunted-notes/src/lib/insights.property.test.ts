import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MS_PER_DAY, accuracy7d, barHeights, currentStreak, dailyBuckets, reviewedToday, weakestRooms } from './insights';
import type { ReviewEvent } from '../types';

const MINUTE = 60_000;

const nowArb = fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 });
const tzArb = fc.integer({ min: -840, max: 840 });

/** Offset of an event relative to now: k days back plus a position inside the day. */
const eventAtArb = (now: number): fc.Arbitrary<ReviewEvent> =>
  fc.record({
    t: fc
      .tuple(fc.integer({ min: -2, max: 12 }), fc.integer({ min: 0, max: MS_PER_DAY - 1 }))
      .map(([k, off]) => Math.max(0, now - k * MS_PER_DAY - off)),
    r: fc.constantFrom('a', 'b', 'c'),
    c: fc.constantFrom<0 | 1>(0, 1),
  });

/** Events clustered around now (including some after now) so runs, gaps and edges all occur. */
const scenarioArb = nowArb.chain((now) =>
  fc.record({
    now: fc.constant(now),
    tz: tzArb,
    events: fc.array(eventAtArb(now), { maxLength: 40 }),
  }),
);

/** Calendar-day streak by direct scan: no Set, no shared helper. */
function referenceStreak(events: ReviewEvent[], now: number, tz: number): number {
  const dayOf = (t: number): number => {
    const local = t - tz * MINUTE;
    return (local - ((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY) / MS_PER_DAY;
  };
  const past = events.filter((e) => e.t <= now);
  const has = (day: number): boolean => past.some((e) => dayOf(e.t) === day);
  const today = dayOf(now);
  let day = has(today) ? today : today - 1;
  let streak = 0;
  while (has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

describe('currentStreak properties', () => {
  // Feature: study-insights, Property 5: Streak matches the reference model and is never negative
  // **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**
  it('matches the reference model and is a non-negative integer', () => {
    fc.assert(
      fc.property(scenarioArb, ({ now, tz, events }) => {
        const streak = currentStreak(events, now, tz);
        expect(Number.isInteger(streak)).toBe(true);
        expect(streak).toBeGreaterThanOrEqual(0);
        expect(streak).toBe(referenceStreak(events, now, tz));
      }),
      { numRuns: 300 },
    );
  });

  // Feature: study-insights, Property 5: Streak matches the reference model and is never negative
  // **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**
  it('is 0 for an empty list and counts every day of a consecutive run ending today or yesterday', () => {
    fc.assert(
      fc.property(
        nowArb,
        tzArb,
        fc.integer({ min: 0, max: 1 }),
        fc.integer({ min: 1, max: 10 }),
        (now, tz, startBack, len) => {
          expect(currentStreak([], now, tz)).toBe(0);
          // Place one event mid-day on each of `len` consecutive local days.
          const local = now - tz * MINUTE;
          const todayStart = local - (((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY) + tz * MINUTE;
          const events: ReviewEvent[] = [];
          for (let i = 0; i < len; i += 1) {
            const t = todayStart - (startBack + i) * MS_PER_DAY + 1;
            if (t <= now) events.push({ t, r: 'a', c: 1 });
          }
          expect(currentStreak(events, now, tz)).toBe(referenceStreak(events, now, tz));
          expect(currentStreak(events, now, tz)).toBe(events.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('currentStreak future events and today', () => {
  // Feature: study-insights, Property 6: Streak ignores future events and never drops when today is added
  // **Validates: Requirements 5.7, 5.4**
  it('ignores events later than now', () => {
    fc.assert(
      fc.property(
        scenarioArb,
        fc.array(
          fc.record({
            dt: fc.integer({ min: 1, max: 30 * MS_PER_DAY }),
            r: fc.constantFrom('a', 'b'),
            c: fc.constantFrom<0 | 1>(0, 1),
          }),
          { maxLength: 20 },
        ),
        ({ now, tz, events }, future) => {
          const added: ReviewEvent[] = future.map((f) => ({ t: now + f.dt, r: f.r, c: f.c }));
          expect(currentStreak([...events, ...added], now, tz)).toBe(currentStreak(events, now, tz));
        },
      ),
      { numRuns: 200 },
    );
  });

  // Feature: study-insights, Property 6: Streak ignores future events and never drops when today is added
  // **Validates: Requirements 5.7, 5.4**
  it('never decreases when an event at now is added', () => {
    fc.assert(
      fc.property(scenarioArb, ({ now, tz, events }) => {
        const before = currentStreak(events, now, tz);
        const after = currentStreak([...events, { t: now, r: 'a', c: 1 }], now, tz);
        expect(after).toBeGreaterThanOrEqual(before);
        expect(after).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });
});

describe('reviewedToday properties', () => {
  /** Local day number by floor-mod arithmetic, independent of the module under test. */
  const refDay = (t: number, tz: number): number => {
    const local = t - tz * MINUTE;
    return (local - (((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY)) / MS_PER_DAY;
  };

  // Feature: study-insights, Property 7: Reviewed-today count matches the reference
  // **Validates: Requirements 6.1, 6.2**
  it('equals the count of non-future events on today\'s local day and is at most the event count', () => {
    fc.assert(
      fc.property(scenarioArb, ({ now, tz, events }) => {
        let expected = 0;
        for (const e of events) {
          if (e.t <= now && refDay(e.t, tz) === refDay(now, tz)) expected += 1;
        }
        const count = reviewedToday(events, now, tz);
        expect(count).toBe(expected);
        expect(count).toBeLessThanOrEqual(events.length);
      }),
      { numRuns: 300 },
    );
  });
});

describe('accuracy7d properties', () => {
  /** Local day number by floor-mod arithmetic, independent of the module under test. */
  const refDay = (t: number, tz: number): number => {
    const local = t - tz * MINUTE;
    return (local - (((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY)) / MS_PER_DAY;
  };

  // Feature: study-insights, Property 8: Accuracy is null or between 0 and 1
  // **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 10.3**
  it('is null exactly for an empty window, else correct/total within [0,1] and never NaN', () => {
    fc.assert(
      fc.property(scenarioArb, ({ now, tz, events }) => {
        const today = refDay(now, tz);
        let total = 0;
        let correct = 0;
        for (const e of events) {
          if (e.t > now) continue;
          const d = refDay(e.t, tz);
          if (d >= today - 6 && d <= today) {
            total += 1;
            correct += e.c;
          }
        }
        const acc = accuracy7d(events, now, tz);
        if (total === 0) {
          expect(acc).toBeNull();
        } else {
          expect(acc).not.toBeNull();
          expect(Number.isNaN(acc)).toBe(false);
          expect(acc as number).toBeGreaterThanOrEqual(0);
          expect(acc as number).toBeLessThanOrEqual(1);
          expect(acc as number).toBeCloseTo(correct / total, 12);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('dailyBuckets properties', () => {
  /** Local day number by floor-mod arithmetic, independent of the module under test. */
  const refDay = (t: number, tz: number): number => {
    const local = t - tz * MINUTE;
    return (local - (((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY)) / MS_PER_DAY;
  };

  // Feature: study-insights, Property 9: Daily buckets cover seven days and agree with accuracy
  // **Validates: Requirements 9.1, 7.4**
  it('returns 7 consecutive days ending today, correct <= reviews, and totals match the accuracy window', () => {
    fc.assert(
      fc.property(scenarioArb, ({ now, tz, events }) => {
        const buckets = dailyBuckets(events, now, tz);
        const today = refDay(now, tz);
        expect(buckets).toHaveLength(7);
        buckets.forEach((b, i) => {
          expect(b.dayKey).toBe(today - 6 + i);
          expect(b.correct).toBeLessThanOrEqual(b.reviews);
        });

        let windowTotal = 0;
        let windowCorrect = 0;
        for (const e of events) {
          if (e.t > now) continue;
          const d = refDay(e.t, tz);
          if (d >= today - 6 && d <= today) {
            windowTotal += 1;
            windowCorrect += e.c;
          }
        }
        const sumReviews = buckets.reduce((s, b) => s + b.reviews, 0);
        const sumCorrect = buckets.reduce((s, b) => s + b.correct, 0);
        expect(sumReviews).toBe(windowTotal);
        expect(sumCorrect).toBe(windowCorrect);

        const acc = accuracy7d(events, now, tz);
        if (sumReviews === 0) expect(acc).toBeNull();
        else expect(acc as number).toBeCloseTo(sumCorrect / sumReviews, 12);
      }),
      { numRuns: 300 },
    );
  });
});

describe('barHeights properties', () => {
  // Feature: study-insights, Property 10: Bar heights are bounded and proportional
  // **Validates: Requirements 9.3, 9.7**
  it('keeps heights within [0, plotHeight], maps 0 to 0 and the max count to plotHeight', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 14 }),
        fc.integer({ min: 1, max: 1000 }),
        (counts, plotHeight) => {
          const heights = barHeights(counts, plotHeight);
          expect(heights).toHaveLength(counts.length);
          const max = Math.max(...counts);
          counts.forEach((c, i) => {
            expect(heights[i]).toBeGreaterThanOrEqual(0);
            expect(heights[i]).toBeLessThanOrEqual(plotHeight);
            if (c === 0) expect(heights[i]).toBe(0);
            if (max > 0 && c === max) expect(heights[i]).toBe(plotHeight);
            if (max > 0) expect(heights[i]).toBeCloseTo((c / max) * plotHeight, 9);
          });
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('weakestRooms properties', () => {
  const noteIdsArb = fc.uniqueArray(fc.constantFrom('n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'), { maxLength: 7 });

  const cardArb = (now: number) =>
    fc.record({
      noteId: fc.constantFrom('n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'orphan'),
      weaknessScore: fc.double({ min: 0, max: 1 }),
      ease: fc.constant(2.5),
      intervalDays: fc.integer({ min: 0, max: 30 }),
      reps: fc.integer({ min: 0, max: 5 }),
      dueAt: fc.integer({ min: -10, max: 10 }).map((d) => now + d * MS_PER_DAY),
    });

  const scenario = nowArb.chain((now) =>
    fc.record({
      now: fc.constant(now),
      ids: noteIdsArb,
      cards: fc.array(cardArb(now), { maxLength: 30 }),
    }),
  );

  // Feature: study-insights, Property 11: Weakest rooms are bounded, ordered and non-empty
  // **Validates: Requirements 8.1, 8.2, 8.3, 8.6**
  it('returns at most 3 ordered rooms, each with an unbanished card, weakness in [0,1], from known notes', () => {
    fc.assert(
      fc.property(scenario, ({ now, ids, cards }) => {
        const notes = ids.map((id) => ({ id }));
        const result = weakestRooms(notes, cards, now);
        expect(result.length).toBeLessThanOrEqual(3);
        for (let i = 0; i < result.length; i += 1) {
          const room = result[i];
          expect(ids).toContain(room.noteId);
          expect(room.weakness).toBeGreaterThanOrEqual(0);
          expect(room.weakness).toBeLessThanOrEqual(1);
          if (i > 0) expect(result[i - 1].weakness).toBeGreaterThanOrEqual(room.weakness);
          const live = cards.filter((c) => c.noteId === room.noteId && !(c.reps > 0 && c.dueAt > now));
          expect(live.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 300 },
    );
  });
});
