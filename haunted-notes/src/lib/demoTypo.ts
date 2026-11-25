/**
 * src/lib/demoTypo.ts
 *
 * Makes a one-letter typo of a quiz answer for "Run demo", so the demo can show that
 * small typos on long words are forgiven. Pure: no React, Zustand or DOM.
 */

import { TYPO_MIN_LENGTH, normaliseAnswer } from './answer';

/**
 * The answer with one letter in the middle replaced by a different letter.
 * Answers shorter than the typo limit are returned unchanged, because the quiz
 * would mark a typo on a short word wrong. For a long answer the result is
 * always exactly one edit away, so `judgeAnswer` accepts it as "close".
 */
export function typoOf(answer: string): string {
  if (normaliseAnswer(answer).length < TYPO_MIN_LENGTH) return answer;
  const i = Math.floor(answer.length / 2);
  const original = answer[i];
  const swap = original.toLowerCase() === 'x' ? 'z' : 'x';
  return answer.slice(0, i) + swap + answer.slice(i + 1);
}
