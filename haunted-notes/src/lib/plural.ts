/**
 * "1 note", "2 notes", "0 notes". Pure; English only.
 * `plural` defaults to `singular + "s"`; pass it for irregular words.
 */
export function countLabel(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
