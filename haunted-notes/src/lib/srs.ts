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
export function scheduleCorrect(card: SrsFields, now = Date.now()): SrsFields {
  let newInterval: number;

  if (card.reps === 0) {
    newInterval = 1;
  } else if (card.reps === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(card.intervalDays * card.ease);
  }

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
 * Returns true when a card was previously scheduled (reps > 0) and has
 * since come back due — i.e. "the ghost is back".
 * Alias of isDue; kept as a named concept for readability at call sites.
 */
export function isReturned(card: SrsFields, now = Date.now()): boolean {
  return isDue(card, now);
}
