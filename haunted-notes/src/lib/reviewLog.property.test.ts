import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { REVIEW_EVENT_CAP, REVIEW_LOG_VERSION, appendReview, sanitizeReviewLog } from './reviewLog';
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

describe('sanitizeReviewLog properties', () => {
  const expectValidLog = (raw: unknown) => {
    let out: ReviewLog | undefined;
    expect(() => {
      out = sanitizeReviewLog(raw);
    }).not.toThrow();
    const log = out as ReviewLog;
    expect(log.v).toBe(REVIEW_LOG_VERSION);
    expect(Array.isArray(log.events)).toBe(true);
    expect(log.events.length).toBeLessThanOrEqual(REVIEW_EVENT_CAP);
    for (const e of log.events) {
      expect(Object.keys(e).sort()).toEqual(['c', 'r', 't']);
      expect(typeof e.t === 'number' && Number.isFinite(e.t) && e.t >= 0).toBe(true);
      expect(typeof e.r === 'string' && e.r.length > 0).toBe(true);
      expect(e.c === 0 || e.c === 1).toBe(true);
    }
    for (let i = 1; i < log.events.length; i += 1) {
      expect(log.events[i].t).toBeGreaterThanOrEqual(log.events[i - 1].t);
    }
  };

  // Feature: study-insights, Property 2: Sanitizing any input yields a valid log
  // **Validates: Requirements 2.2, 4.1, 4.2, 4.4, 4.6, 4.7**
  it('Property 2: Sanitizing any input yields a valid log (fc.anything)', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        expectValidLog(raw);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: study-insights, Property 2: Sanitizing any input yields a valid log
  // **Validates: Requirements 2.2, 4.1, 4.2, 4.4, 4.6, 4.7**
  it('Property 2: Sanitizing any input yields a valid log (fc.jsonValue)', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (raw) => {
        expectValidLog(raw);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: study-insights, Property 2: Sanitizing any input yields a valid log
  // **Validates: Requirements 2.2, 4.1, 4.2, 4.4, 4.6, 4.7**
  it('Property 2: container with arbitrary events and version yields a valid log', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(0), fc.constant(1), fc.integer(), fc.anything()),
        fc.oneof(fc.array(fc.oneof(eventArb, fc.anything()), { maxLength: 600 }), fc.anything()),
        (v, events) => {
          expectValidLog({ v, events });
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe('sanitizeReviewLog keeps valid events', () => {
  // Small t range so ties are common and stability is exercised.
  const tiedEventArb: fc.Arbitrary<ReviewEvent> = fc.record({
    t: fc.integer({ min: 0, max: 20 }),
    r: fc.string({ minLength: 1, maxLength: 6 }),
    c: fc.constantFrom<0 | 1>(0, 1),
  });
  const validEventArb = fc.oneof(eventArb, tiedEventArb);

  const goodBase = { t: 5, r: 'room', c: 1 as const };
  const invalidItemArb: fc.Arbitrary<unknown> = fc.oneof(
    // Non-record items.
    fc.constantFrom<unknown>(null, undefined, 0, 1, 'x', '', true, false, [], [1, 2]),
    fc.array(fc.integer(), { maxLength: 3 }),
    // Records with exactly one invalid field.
    fc
      .oneof(
        fc.constantFrom<unknown>(-1, -0.5, Number.NaN, Infinity, -Infinity, '5', null, undefined, true, {}),
        fc.double({ max: -1e-9, noNaN: true, noDefaultInfinity: true }),
      )
      .map((t) => ({ ...goodBase, t })),
    fc
      .constantFrom<unknown>('', 0, 1, null, undefined, true, [], {})
      .map((r) => ({ ...goodBase, r })),
    fc
      .oneof(
        fc.constantFrom<unknown>(2, -1, 0.5, '0', '1', true, false, null, undefined, []),
        fc.integer().filter((n) => n !== 0 && n !== 1),
      )
      .map((c) => ({ ...goodBase, c })),
    // Missing fields.
    fc.constantFrom<unknown>({}, { t: 1, r: 'a' }, { t: 1, c: 0 }, { r: 'a', c: 0 }),
  );

  type Tagged = { valid: true; item: ReviewEvent } | { valid: false; item: unknown };
  const taggedArb: fc.Arbitrary<Tagged> = fc.oneof(
    { weight: 3, arbitrary: validEventArb.map((item): Tagged => ({ valid: true, item })) },
    { weight: 2, arbitrary: invalidItemArb.map((item): Tagged => ({ valid: false, item })) },
  );

  const expectedFrom = (tagged: Tagged[]): ReviewEvent[] => {
    const valid = tagged
      .filter((x): x is { valid: true; item: ReviewEvent } => x.valid)
      .map((x, i) => ({ e: x.item, i }));
    valid.sort((a, b) => a.e.t - b.e.t || a.i - b.i);
    return valid.map((x) => x.e).slice(-REVIEW_EVENT_CAP);
  };

  // Feature: study-insights, Property 3: Sanitizing keeps valid events and drops invalid ones
  // **Validates: Requirements 2.4, 4.3**
  it('Property 3: Sanitizing keeps valid events and drops invalid ones', () => {
    fc.assert(
      fc.property(fc.array(taggedArb, { maxLength: 60 }), (tagged) => {
        const events = tagged.map((x) => x.item);
        const out = sanitizeReviewLog({ v: REVIEW_LOG_VERSION, events });
        expect(out.v).toBe(REVIEW_LOG_VERSION);
        expect(out.events).toEqual(expectedFrom(tagged));
      }),
      { numRuns: 200 },
    );
  });

  // Feature: study-insights, Property 3: Sanitizing keeps valid events and drops invalid ones
  // **Validates: Requirements 2.4, 4.3**
  it('Property 3: only the newest 500 valid events survive when the list is long', () => {
    fc.assert(
      fc.property(
        fc.array(taggedArb, { minLength: 450, maxLength: 700 }),
        (tagged) => {
          const events = tagged.map((x) => x.item);
          const out = sanitizeReviewLog({ v: REVIEW_LOG_VERSION, events });
          const expected = expectedFrom(tagged);
          expect(out.events.length).toBeLessThanOrEqual(REVIEW_EVENT_CAP);
          expect(out.events).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: study-insights, Property 3: Sanitizing keeps valid events and drops invalid ones
  // **Validates: Requirements 2.4, 4.3**
  it('Property 3: extra keys on valid events are stripped', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 30 }), (list) => {
        const decorated = list.map((e) => ({ ...e, extra: 'x', n: 1 }));
        const out = sanitizeReviewLog({ v: REVIEW_LOG_VERSION, events: decorated });
        for (const e of out.events) {
          expect(Object.keys(e).sort()).toEqual(['c', 'r', 't']);
        }
        expect(out.events).toHaveLength(list.length);
      }),
      { numRuns: 100 },
    );
  });
});
