import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MS_PER_DAY, currentStreak } from './insights';
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
