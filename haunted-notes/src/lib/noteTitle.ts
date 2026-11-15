import type { Note } from '../types';

export const TITLE_MAX_LEN = 40;

export function noteTitle(note: Note): string {
  if (note.title) return note.title;
  const t = note.rawText.trim().replace(/\s+/g, ' ');
  return t.length > TITLE_MAX_LEN ? t.slice(0, TITLE_MAX_LEN - 1) + '…' : t;
}
