import type { ReviewEvent, SrsFields } from '../types';
import { isBanished } from './srs';

export const MS_PER_DAY = 86_400_000;
export const WINDOW_DAYS = 7;
export const WEAKEST_ROOM_COUNT = 3;

/** Local calendar day number. tzOffsetMinutes is the value of Date#getTimezoneOffset(). */
export function dayIndex(t: number, tzOffsetMinutes: number): number {
  return Math.floor((t - tzOffsetMinutes * 60_000) / MS_PER_DAY);
}

/** Set of local day indexes that have at least one event not later than now. */
function reviewedDays(events: ReviewEvent[], now: number, tz: number): Set<number> {
  const days = new Set<number>();
  for (const e of events) {
    if (e.t <= now) days.add(dayIndex(e.t, tz));
  }
  return days;
}

/** Consecutive reviewed days ending today, or yesterday if today has none. */
export function currentStreak(
  events: ReviewEvent[],
  now: number = Date.now(),
  tzOffsetMinutes = 0,
): number {
  const days = reviewedDays(events, now, tzOffsetMinutes);
  const today = dayIndex(now, tzOffsetMinutes);
  let day: number;
  if (days.has(today)) day = today;
  else if (days.has(today - 1)) day = today - 1;
  else return 0;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

/** Number of events on today's local day, ignoring events later than now. */
export function reviewedToday(
  events: ReviewEvent[],
  now: number = Date.now(),
  tzOffsetMinutes = 0,
): number {
  const today = dayIndex(now, tzOffsetMinutes);
  let count = 0;
  for (const e of events) {
    if (e.t <= now && dayIndex(e.t, tzOffsetMinutes) === today) count += 1;
  }
  return count;
}

/** Correct share (0..1) of events in the 7 local days ending today, or null when none. */
export function accuracy7d(
  events: ReviewEvent[],
  now: number = Date.now(),
  tzOffsetMinutes = 0,
): number | null {
  const today = dayIndex(now, tzOffsetMinutes);
  const first = today - (WINDOW_DAYS - 1);
  let total = 0;
  let correct = 0;
  for (const e of events) {
    if (e.t > now) continue;
    const d = dayIndex(e.t, tzOffsetMinutes);
    if (d < first || d > today) continue;
    total += 1;
    correct += e.c;
  }
  return total === 0 ? null : correct / total;
}

export interface DayBucket {
  dayKey: number;
  label: string;
  reviews: number;
  correct: number;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Exactly 7 buckets, oldest first; the last one is today. */
export function dailyBuckets(
  events: ReviewEvent[],
  now: number = Date.now(),
  tzOffsetMinutes = 0,
): DayBucket[] {
  const today = dayIndex(now, tzOffsetMinutes);
  const buckets: DayBucket[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const dayKey = today - i;
    // dayKey is already a local day number, so the UTC weekday of its midnight is the local weekday.
    const weekday = new Date(dayKey * MS_PER_DAY).getUTCDay();
    buckets.push({ dayKey, label: WEEKDAY_LABELS[weekday], reviews: 0, correct: 0 });
  }
  const first = today - (WINDOW_DAYS - 1);
  for (const e of events) {
    if (e.t > now) continue;
    const d = dayIndex(e.t, tzOffsetMinutes);
    if (d < first || d > today) continue;
    const bucket = buckets[d - first];
    bucket.reviews += 1;
    bucket.correct += e.c;
  }
  return buckets;
}

/** Bar heights in [0, plotHeight]; the largest count gets plotHeight, zero gets 0. */
export function barHeights(counts: number[], plotHeight: number): number[] {
  const max = Math.max(0, ...counts);
  if (max === 0) return counts.map(() => 0);
  return counts.map((c) => (Math.max(0, c) / max) * plotHeight);
}

export interface WeakRoom {
  noteId: string;
  /** Mean weaknessScore of the room's unbanished cards, 0..1. */
  weakness: number;
}

type RoomCard = SrsFields & { noteId: string; weaknessScore: number };

/** Up to `limit` rooms by mean weakness of unbanished cards, highest first, noteId breaks ties. */
export function weakestRooms(
  notes: { id: string }[],
  cards: RoomCard[],
  now: number = Date.now(),
  limit = WEAKEST_ROOM_COUNT,
): WeakRoom[] {
  const rooms: WeakRoom[] = [];
  for (const note of notes) {
    let sum = 0;
    let count = 0;
    for (const card of cards) {
      if (card.noteId !== note.id || isBanished(card, now)) continue;
      sum += card.weaknessScore;
      count += 1;
    }
    if (count > 0) rooms.push({ noteId: note.id, weakness: sum / count });
  }
  rooms.sort((a, b) =>
    b.weakness !== a.weakness ? b.weakness - a.weakness : a.noteId < b.noteId ? -1 : a.noteId > b.noteId ? 1 : 0,
  );
  return rooms.slice(0, Math.max(0, limit));
}

export interface Insights {
  streak: number;
  today: number;
  accuracy: number | null;
  buckets: DayBucket[];
  weakest: WeakRoom[];
}

export function computeInsights(input: {
  events: ReviewEvent[];
  notes: { id: string }[];
  cards: RoomCard[];
  now?: number;
  tzOffsetMinutes?: number;
}): Insights {
  const now = input.now ?? Date.now();
  const tz = input.tzOffsetMinutes ?? 0;
  return {
    streak: currentStreak(input.events, now, tz),
    today: reviewedToday(input.events, now, tz),
    accuracy: accuracy7d(input.events, now, tz),
    buckets: dailyBuckets(input.events, now, tz),
    weakest: weakestRooms(input.notes, input.cards, now),
  };
}
