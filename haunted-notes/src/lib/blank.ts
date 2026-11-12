/** Fixed-length blank, so the number of underscores never hints at the answer length. */
export const BLANK = '_____';

/**
 * Replace every run of 2 or more underscores with the fixed blank.
 * Used wherever a prompt is shown (text, aria-labels, titles), so cards saved with
 * length-matched blanks are normalised at display time without a store migration.
 */
export function normalizeBlanks(prompt: string): string {
  return prompt.replace(/_{2,}/g, BLANK);
}
