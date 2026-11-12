/**
 * src/lib/srs.ts
 *
 * SM-2 lite spaced-repetition scheduling — pure functions only.
 * No React, no Zustand, no DOM. Safe to unit-test in isolation.
 */

import type { SrsFields } from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_EASE = 2.5;
const MIN_EASE     = 1.3;
const EASE_PENALTY = 0.2;
const MS_PER_DAY   = 86_400_000;
/** A hinted correct answer gets this share of the normal next interval. */
const HINT_INTERVAL_FACTOR = 0.5;

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

/**
 * Advance scheduling after a correct answer.
 *
 * Interval ramp:
 *   reps === 0  →  1 day
 *   reps === 1  →  3 days
 *   reps ≥  2  →  round(intervalDays × ease)
 *
 * ease is unchanged on correct answers.
 */
export function scheduleCorrect(
  card: SrsFields,
  now = Date.now(),
  hinted = false,
): SrsFields {
  let newInterval: number;

  if (card.reps === 0) {
    newInterval = 1;
  } else if (card.reps === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(card.intervalDays * card.ease);
  }

  // A hinted correct answer still banishes the ghost, but it returns sooner
  if (hinted) newInterval = newInterval * HINT_INTERVAL_FACTOR;

  return {
    ease: card.ease,
    intervalDays: newInterval,
    dueAt: now + newInterval * MS_PER_DAY,
    reps: card.reps + 1,
  };
}

/**
 * Reset scheduling after a wrong answer.
 *
 * - interval resets to 0 (due immediately)
 * - reps resets to 0
 * - ease decreases by EASE_PENALTY, floored at MIN_EASE
 */
export function scheduleWrong(card: SrsFields, now = Date.now()): SrsFields {
  return {
    ease: Math.max(MIN_EASE, card.ease - EASE_PENALTY),
    intervalDays: 0,
    dueAt: now,
    reps: 0,
  };
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
