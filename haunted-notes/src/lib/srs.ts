/**
 * src/lib/srs.ts
 *
 * Spaced-repetition scheduling on the 2-3-5-7 ladder: pure functions only.
 * No React, no Zustand, no DOM. Safe to unit-test in isolation.
 *
 * A correct answer returns the ghost after 2 days, then 3, then 5, then 7 days
 * (and stays at 7). A wrong answer sends it back to the start of the ladder.
 * `ease` is kept on every card so saved data and backups stay valid, but the
 * ladder does not use it and nothing changes it.
 */

import type { SrsFields } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Days to wait after the 1st, 2nd, 3rd and later correct answers. */
export const LADDER_DAYS = [2, 3, 5, 7] as const;

const DEFAULT_EASE = 2.5;
const MS_PER_DAY   = 86_400_000;

/** A hinted correct answer gets this share of the normal next interval. */
const HINT_INTERVAL_FACTOR = 0.5;

/** An ignored ghost grows after this many full days overdue, by this much per day, up to the cap (0.2 is one ghost type). */
export const GRACE_DAYS = 1;
export const GROWTH_PER_DAY = 0.05;
export const GROWTH_CAP = 0.2;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the default SRS fields for a freshly-created card.
 * dueAt is set to now so the card is immediately available for review.
 */
export function defaultSrsFields(now = Date.now()): SrsFields {
  return {
    ease: DEFAULT_EASE,
    intervalDays: 0,
    dueAt: now,
    reps: 0,
  };
}

/** Days to wait on ladder step `index` (0 is the first correct answer). Steps past the end stay at 7. */
export function ladderDays(index: number): number {
  const i = Number.isFinite(index) ? Math.min(LADDER_DAYS.length - 1, Math.max(0, Math.floor(index))) : 0;
  return LADDER_DAYS[i];
}

/**
 * True when a scheduled card (reps > 0) is answered later than its own wait
 * past its due time, for example a 3-day wait answered more than 3 days late.
 * Early, on-time and new cards are never overdue.
 */
export function isLate(card: SrsFields, now = Date.now()): boolean {
  return card.reps > 0 && now - card.dueAt > card.intervalDays * MS_PER_DAY;
}

/**
 * Advance scheduling after a correct answer.
 *
 *   reps 0 → 2 days, reps 1 → 3 days, reps 2 → 5 days, reps 3 or more → 7 days
 *
 * A card answered later than its own wait stays on the rung it was on (reps and
 * wait do not move up), so a long absence does not earn a longer gap.
 * A hinted answer still banishes the ghost, but it returns in half the time.
 * `ease` is not touched.
 */
export function scheduleCorrect(
  card: SrsFields,
  now = Date.now(),
  hinted = false,
): SrsFields {
  const late = isLate(card, now);
  const reps = late ? card.reps : card.reps + 1;
  let newInterval = ladderDays(reps - 1);
  if (hinted) newInterval = newInterval * HINT_INTERVAL_FACTOR;

  return {
    ease: card.ease,
    intervalDays: newInterval,
    dueAt: now + newInterval * MS_PER_DAY,
    reps,
  };
}

/**
 * Reset scheduling after a wrong answer or Reveal: back to the start of the
 * ladder, due immediately. `ease` is not touched.
 */
export function scheduleWrong(card: SrsFields, now = Date.now()): SrsFields {
  return {
    ease: card.ease,
    intervalDays: 0,
    dueAt: now,
    reps: 0,
  };
}

/**
 * The weakness to draw: the stored score plus growth for a ghost that has been
 * ignored. After GRACE_DAYS full days overdue it gains GROWTH_PER_DAY for each
 * further day, up to GROWTH_CAP (exactly one ghost type wide, so at most one type up), and never above 1.
 * Derived on the fly and never saved; answering the card clears it.
 */
export function effectiveWeakness(
  card: { weaknessScore: number; dueAt: number },
  now = Date.now(),
): number {
  const base = Number.isFinite(card.weaknessScore) ? Math.min(1, Math.max(0, card.weaknessScore)) : 0;
  if (!Number.isFinite(card.dueAt) || !Number.isFinite(now)) return base;
  const daysOverdue = Math.floor((now - card.dueAt) / MS_PER_DAY);
  const growth = Math.min(GROWTH_CAP, GROWTH_PER_DAY * Math.max(0, daysOverdue - GRACE_DAYS));
  return Math.min(1, base + growth);
}
/**
 * Returns true when the card is due for review AND has been reviewed at
 * least once before (reps > 0).
 *
 * New cards (reps === 0) are simply "haunting" — they haven't been
 * scheduled yet, so they are never considered "due/returned".
 */
export function isDue(card: SrsFields, now = Date.now()): boolean {
  return card.reps > 0 && now >= card.dueAt;
}

/**
 * Returns true when a ghost is banished: it has been answered correctly at
 * least once (reps > 0) and its next review is still in the future.
 * Everything else (new, wrong, or returned) is haunting.
 */
export function isBanished(card: SrsFields, now = Date.now()): boolean {
  return card.reps > 0 && card.dueAt > now;
}

/**
 * Milliseconds until the soonest banished ghost returns, or null when no
 * ghost is banished. Always > 0 when a value is returned.
 */
export function nextReturnInMs(cards: SrsFields[], now = Date.now()): number | null {
  let soonest: number | null = null;
  for (const c of cards) {
    if (isBanished(c, now) && (soonest === null || c.dueAt < soonest)) {
      soonest = c.dueAt;
    }
  }
  return soonest === null ? null : soonest - now;
}

/** Whole days to show for a wait in ms, rounded up (so never "0 days"). */
export function daysFromMs(ms: number): number {
  return Math.max(1, Math.ceil(ms / MS_PER_DAY));
}

export type CardStatus = 'new' | 'haunting' | 'due' | 'banished';

/**
 * Classifies a card into exactly one status:
 *   new       never answered (reps 0, never reviewed)
 *   haunting  answered wrong, still haunting (reps 0, has been reviewed)
 *   due       returned: reps > 0 and dueAt has passed
 *   banished  reps > 0 and dueAt is in the future
 */
export function cardStatus(
  card: SrsFields & { lastReviewed: number | null },
  now = Date.now(),
): CardStatus {
  if (card.reps === 0) return card.lastReviewed === null ? 'new' : 'haunting';
  return isBanished(card, now) ? 'banished' : 'due';
}

/**
 * Returns true when a card was previously scheduled (reps > 0) and has
 * since come back due — i.e. "the ghost is back".
 * Alias of isDue; kept as a named concept for readability at call sites.
 */
export function isReturned(card: SrsFields, now = Date.now()): boolean {
  return isDue(card, now);
}
