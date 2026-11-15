import { describe, expect, it } from 'vitest';
import {
  REVIEW_EVENT_CAP,
  REVIEW_LOG_VERSION,
  appendReview,
  emptyReviewLog,
  sanitizeReviewLog,
} from './reviewLog';
import type { ReviewEvent, ReviewLog } from '../types';

const ev = (t: number, r = 'room', c: 0 | 1 = 1): ReviewEvent => ({ t, r, c });

describe('emptyReviewLog', () => {
  it('has the current version and no events', () => {
    expect(emptyReviewLog()).toEqual({ v: REVIEW_LOG_VERSION, events: [] });
  });

  it('returns a fresh object each call', () => {
    expect(emptyReviewLog()).not.toBe(emptyReviewLog());
  });
});

describe('appendReview', () => {
  it('appends to an empty log without mutating the input', () => {
    const log = emptyReviewLog();
    const next = appendReview(log, ev(10, 'a', 0));
    expect(next.events).toEqual([{ t: 10, r: 'a', c: 0 }]);
    expect(log.events).toEqual([]);
  });

  it('copies only the keys t, r and c', () => {
    const extra = { t: 1, r: 'a', c: 1, answer: 'secret' } as ReviewEvent;
    const next = appendReview(emptyReviewLog(), extra);
    expect(Object.keys(next.events[0]).sort()).toEqual(['c', 'r', 't']);
  });

  it('keeps all events at exactly the cap', () => {
    const events = Array.from({ length: REVIEW_EVENT_CAP - 1 }, (_, i) => ev(i));
    const next = appendReview({ v: 1, events }, ev(9999));
    expect(next.events).toHaveLength(REVIEW_EVENT_CAP);
    expect(next.events[0].t).toBe(0);
  });

  it('drops the oldest event when appending at the cap', () => {
    const events = Array.from({ length: REVIEW_EVENT_CAP }, (_, i) => ev(i));
    const log: ReviewLog = { v: 1, events };
    const next = appendReview(log, ev(9999));
    expect(next.events).toHaveLength(REVIEW_EVENT_CAP);
    expect(next.events[0].t).toBe(1);
    expect(next.events[REVIEW_EVENT_CAP - 1].t).toBe(9999);
    expect(log.events).toHaveLength(REVIEW_EVENT_CAP);
    expect(log.events[0].t).toBe(0);
  });
});

describe('sanitizeReviewLog', () => {
  it('keeps a valid log unchanged', () => {
    const log: ReviewLog = { v: 1, events: [ev(1), ev(2, 'b', 0)] };
    expect(sanitizeReviewLog(log)).toEqual(log);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
    ['a number', 42],
    ['an array', []],
    ['an array of events', [ev(1)]],
  ])('returns an empty log for %s', (_name, raw) => {
    expect(sanitizeReviewLog(raw)).toEqual(emptyReviewLog());
  });

  it('resets a log with a newer version (v: 2)', () => {
    expect(sanitizeReviewLog({ v: 2, events: [ev(1)] })).toEqual(emptyReviewLog());
  });

  it('upgrades a v: 0 log and keeps its events', () => {
    expect(sanitizeReviewLog({ v: 0, events: [ev(1), ev(2)] })).toEqual({
      v: REVIEW_LOG_VERSION,
      events: [ev(1), ev(2)],
    });
  });

  it.each([
    ['missing', { events: [] }],
    ['a string', { v: '1', events: [] }],
    ['a fraction', { v: 0.5, events: [] }],
    ['NaN', { v: NaN, events: [] }],
  ])('returns an empty log when v is %s', (_name, raw) => {
    expect(sanitizeReviewLog(raw)).toEqual(emptyReviewLog());
  });

  it('returns an empty log when events is not an array', () => {
    expect(sanitizeReviewLog({ v: 1, events: 'x' })).toEqual(emptyReviewLog());
    expect(sanitizeReviewLog({ v: 1 })).toEqual(emptyReviewLog());
  });

  it('drops a bad item among good ones and keeps the rest', () => {
    const raw = {
      v: 1,
      events: [
        ev(1, 'a'),
        { t: 2, r: 'a', c: 2 },
        ev(3, 'b', 0),
        null,
        { t: -1, r: 'a', c: 1 },
        { t: Infinity, r: 'a', c: 1 },
        { t: 4, r: '', c: 1 },
        { t: '5', r: 'a', c: 1 },
        ev(6, 'c'),
      ],
    };
    expect(sanitizeReviewLog(raw).events).toEqual([ev(1, 'a'), ev(3, 'b', 0), ev(6, 'c')]);
  });

  it('strips extra keys from events', () => {
    const out = sanitizeReviewLog({ v: 1, events: [{ t: 1, r: 'a', c: 1, x: 'y' }] });
    expect(Object.keys(out.events[0]).sort()).toEqual(['c', 'r', 't']);
  });

  it('sorts by time and keeps input order for equal times', () => {
    const out = sanitizeReviewLog({
      v: 1,
      events: [ev(5, 'late'), ev(1, 'first'), ev(1, 'second')],
    });
    expect(out.events.map((e) => e.r)).toEqual(['first', 'second', 'late']);
  });

  it('keeps only the newest 500 events', () => {
    const events = Array.from({ length: REVIEW_EVENT_CAP + 5 }, (_, i) => ev(i));
    const out = sanitizeReviewLog({ v: 1, events });
    expect(out.events).toHaveLength(REVIEW_EVENT_CAP);
    expect(out.events[0].t).toBe(5);
  });
});
