import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { REVIEW_EVENT_CAP, REVIEW_LOG_VERSION, appendReview } from './reviewLog';
import type { ReviewEvent, ReviewLog } from '../types';

const eventArb: fc.Arbitrary<ReviewEvent> = fc.record({
  t: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  r: fc.string({ minLength: 1, maxLength: 12 }),
  c: fc.constantFrom<0 | 1>(0, 1),
});

// Lengths straddle the cap (499, 500, 501 and beyond).
const logArb: fc.Arbitrary<ReviewLog> = fc
  .oneof(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: REVIEW_EVENT_CAP - 2, max: REVIEW_EVENT_CAP }),
  )
  .chain((n) =>
    fc.array(eventArb, { minLength: n, maxLength: n }).map((events) => ({
      v: REVIEW_LOG_VERSION,
      events,
    })),
  );

describe('appendReview properties', () => {
  // Feature: study-insights, Property 1: Append keeps the cap, order and event shape
  // **Validates: Requirements 1.6, 2.1, 2.2, 2.3, 2.5, 3.3**
  it('Property 1: Append keeps the cap, order and event shape', () => {
    fc.assert(
      fc.property(logArb, eventArb, (log, event) => {
        const before = JSON.stringify(log);
        const oldEvents = log.events;
        const oldLength = oldEvents.length;

        const next = appendReview(log, event);

        expect(next).not.toBe(log);
        expect(next.v).toBe(REVIEW_LOG_VERSION);
        expect(next.events).toHaveLength(Math.min(oldLength + 1, REVIEW_EVENT_CAP));
        expect(next.events).toEqual([...oldEvents, event].slice(-REVIEW_EVENT_CAP));
        expect(next.events[next.events.length - 1]).toEqual(event);
        for (const e of next.events) {
          expect(Object.keys(e).sort()).toEqual(['c', 'r', 't']);
        }

        // Input is unchanged (same array, same contents).
        expect(log.events).toBe(oldEvents);
        expect(log.events).toHaveLength(oldLength);
        expect(JSON.stringify(log)).toBe(before);
      }),
      { numRuns: 150 },
    );
  });
});
