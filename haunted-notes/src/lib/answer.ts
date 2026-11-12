/**
 * src/lib/answer.ts
 *
 * Pure answer checking and hints for the quiz. No React, no Zustand, no DOM.
 */

/** Answers with at least this many letters (after normalising) allow one typo. */
export const TYPO_MIN_LENGTH = 6;

/**
 * Strip leading/trailing whitespace and punctuation, then lowercase.
 * Allows "JVM." or " photosynthesis! " to match the stored cloze word.
 */
export function normaliseAnswer(s: string): string {
  return s.trim().replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
}

/** True when a and b differ by at most one insertion, deletion or substitution. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (a.length > b.length) i++;        // delete from a
    else if (a.length < b.length) j++;   // insert into a
    else { i++; j++; }                   // substitute
  }
  // Whatever is left over in either string is one more edit
  edits += (a.length - i) + (b.length - j);
  return edits <= 1;
}

export type AnswerVerdict = 'exact' | 'close' | 'wrong';

/**
 * Judge a typed answer against the stored cloze word.
 *   exact  matches after normalising
 *   close  answer has 6+ letters and the input is within one edit (accepted)
 *   wrong  anything else
 */
export function judgeAnswer(input: string, answer: string): AnswerVerdict {
  const a = normaliseAnswer(input);
  const b = normaliseAnswer(answer);
  if (a === b) return 'exact';
  if (b.length >= TYPO_MIN_LENGTH && withinOneEdit(a, b)) return 'close';
  return 'wrong';
}

export type HintLevel = 0 | 1 | 2;

function containsWholeWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w])${escaped}($|[^\\w])`, 'i').test(text);
}

/**
 * Hint text for an answer.
 *   level 0  nothing
 *   level 1  the first letter
 *   level 2  the first letter and the length
 * The result never contains the whole answer: if the wording happens to contain it
 * (an answer like "letters"), a symbolic form such as "J · 7" is used instead.
 */
export function hintFor(answer: string, level: HintLevel): string {
  const text = answer.trim();
  if (level === 0 || text.length === 0) return '';

  const first = text[0];
  const natural =
    level === 1
      ? `Starts with “${first}”`
      : `Starts with “${first}”, ${text.length} letters`;
  if (!containsWholeWord(natural, text)) return natural;

  return level === 1 ? first : `${first} · ${text.length}`;
}
