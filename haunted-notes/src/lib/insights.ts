import type { ReviewEvent } from '../types';

export const MS_PER_DAY = 86_400_000;
export const WINDOW_DAYS = 7;

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
