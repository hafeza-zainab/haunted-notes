import { describe, expect, it } from 'vitest';
import type { ReviewEvent } from '../types';
import {
  MS_PER_DAY,
  accuracy7d,
  computeInsights,
  currentStreak,
  dailyBuckets,
  reviewedToday,
  weakestRooms,
} from './insights';

// Wednesday 2024-11-13 12:00 UTC. All tests use tz 0 unless stated.
const NOW = Date.UTC(2024, 10, 13, 12, 0, 0);
const TZ = 0;

/** Event `daysAgo` local days before NOW (same time of day). */
const ev = (daysAgo: number, c: 0 | 1 = 1, r = 'n1'): ReviewEvent => ({
  t: NOW - daysAgo * MS_PER_DAY,
  r,
  c,
});

const card = (noteId: string, weaknessScore: number, banished = false) => ({
  noteId,
  weaknessScore,
  ease: 2.5,
  intervalDays: banished ? 3 : 0,
  reps: banished ? 1 : 0,
  dueAt: banished ? NOW + MS_PER_DAY : NOW,
});

describe('currentStreak', () => {
  it('counts 3 days including today', () => {
    expect(currentStreak([ev(0), ev(1), ev(2)], NOW, TZ)).toBe(3);
  });

  it('continues from yesterday when today has no review', () => {
    expect(currentStreak([ev(1), ev(2), ev(3)], NOW, TZ)).toBe(3);
  });

  it('is 0 after a 2-day gap', () => {
    expect(currentStreak([ev(2), ev(3)], NOW, TZ)).toBe(0);
  });

  it('stops at a gap inside the run', () => {
    expect(currentStreak([ev(0), ev(1), ev(3)], NOW, TZ)).toBe(2);
  });

  it('is 0 for no events', () => {
    expect(currentStreak([], NOW, TZ)).toBe(0);
  });

  it('ignores events later than now', () => {
    const future: ReviewEvent = { t: NOW + 1, r: 'n1', c: 1 };
    expect(currentStreak([future], NOW, TZ)).toBe(0);
  });

  it('uses the timezone offset for the day boundary', () => {
    // 23:30 UTC the day before NOW is already "today" at UTC+2 (offset -120).
    const e: ReviewEvent = { t: Date.UTC(2024, 10, 12, 23, 30), r: 'n1', c: 1 };
    const now = Date.UTC(2024, 10, 13, 0, 30);
    expect(reviewedToday([e], now, 0)).toBe(0);
    expect(reviewedToday([e], now, -120)).toBe(1);
  });
});

describe('reviewedToday', () => {
  it('is 0 with no events today', () => {
    expect(reviewedToday([ev(1), ev(2)], NOW, TZ)).toBe(0);
    expect(reviewedToday([], NOW, TZ)).toBe(0);
  });

  it('counts only today events not later than now', () => {
    const later: ReviewEvent = { t: NOW + 1000, r: 'n1', c: 1 };
    expect(reviewedToday([ev(0), ev(0, 0), ev(1), later], NOW, TZ)).toBe(2);
  });
});

describe('accuracy7d', () => {
  it('is 0.75 for 3 correct of 4', () => {
    expect(accuracy7d([ev(0), ev(1), ev(2), ev(3, 0)], NOW, TZ)).toBe(0.75);
  });

  it('is null (not NaN) for an empty window', () => {
    expect(accuracy7d([], NOW, TZ)).toBeNull();
    expect(accuracy7d([ev(7)], NOW, TZ)).toBeNull();
  });

  it('includes the event 6 days ago and excludes the one 7 days ago', () => {
    expect(accuracy7d([ev(6, 1), ev(7, 0)], NOW, TZ)).toBe(1);
  });

  it('excludes events later than now', () => {
    const later: ReviewEvent = { t: NOW + 1000, r: 'n1', c: 0 };
    expect(accuracy7d([ev(0, 1), later], NOW, TZ)).toBe(1);
  });
});

describe('dailyBuckets', () => {
  it('returns 7 buckets, oldest first, with weekday labels for a fixed now', () => {
    const b = dailyBuckets([], NOW, TZ);
    expect(b).toHaveLength(7);
    expect(b.map((x) => x.label)).toEqual(['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']);
    expect(b.every((x) => x.reviews === 0 && x.correct === 0)).toBe(true);
  });

  it('counts reviews and correct answers per day', () => {
    const b = dailyBuckets([ev(0), ev(0, 0), ev(6), ev(7)], NOW, TZ);
    expect(b[6]).toMatchObject({ reviews: 2, correct: 1 });
    expect(b[0]).toMatchObject({ reviews: 1, correct: 1 });
    expect(b.reduce((s, x) => s + x.reviews, 0)).toBe(3);
  });
});

describe('weakestRooms', () => {
  const notes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];

  it('returns an empty list for no rooms or no cards', () => {
    expect(weakestRooms([], [], NOW)).toEqual([]);
    expect(weakestRooms(notes, [], NOW)).toEqual([]);
  });

  it('orders by mean weakness and breaks ties by note id', () => {
    const cards = [card('b', 0.5), card('a', 0.5), card('c', 0.9), card('d', 0.2), card('d', 0.4)];
    const out = weakestRooms(notes, cards, NOW);
    expect(out.map((r) => r.noteId)).toEqual(['c', 'a', 'b']);
  });

  it('limits to 3 rooms by default', () => {
    const cards = notes.map((n, i) => card(n.id, i / 10));
    expect(weakestRooms(notes, cards, NOW)).toHaveLength(3);
  });

  it('excludes a room whose cards are all banished', () => {
    const cards = [card('a', 0.9, true), card('b', 0.1)];
    expect(weakestRooms(notes, cards, NOW).map((r) => r.noteId)).toEqual(['b']);
  });

  it('averages only unbanished cards', () => {
    const cards = [card('a', 0.8), card('a', 0.2, true)];
    expect(weakestRooms(notes, cards, NOW)).toEqual([{ noteId: 'a', weakness: 0.8 }]);
  });
});

describe('computeInsights', () => {
  it('returns defined results for empty events and empty rooms', () => {
    const r = computeInsights({ events: [], notes: [], cards: [], now: NOW, tzOffsetMinutes: TZ });
    expect(r.streak).toBe(0);
    expect(r.today).toBe(0);
    expect(r.accuracy).toBeNull();
    expect(r.buckets).toHaveLength(7);
    expect(r.weakest).toEqual([]);
  });

  it('combines the individual results', () => {
    const r = computeInsights({
      events: [ev(0), ev(1, 0)],
      notes: [{ id: 'a' }],
      cards: [card('a', 0.5)],
      now: NOW,
      tzOffsetMinutes: TZ,
    });
    expect(r).toMatchObject({ streak: 2, today: 1, accuracy: 0.5 });
    expect(r.weakest).toEqual([{ noteId: 'a', weakness: 0.5 }]);
  });
});
