/**
 * src/lib/quizRound.ts
 *
 * Small pure helpers for one quiz round. No React, no Zustand, no DOM.
 */

/**
 * Streak of correct answers in a row after one more answer.
 * A correct answer adds one; a wrong answer (or a reveal) resets it to zero.
 * A skip is not an answer, so callers simply do not call this for skips.
 */
export function nextStreak(streak: number, correct: boolean): number {
  return correct ? streak + 1 : 0;
}

/** Add a card id to the missed list once, keeping the order of first misses. */
export function addMissed(missed: readonly string[], id: string): string[] {
  return missed.includes(id) ? [...missed] : [...missed, id];
}
