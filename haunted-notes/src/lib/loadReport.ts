/**
 * Pure helpers that tell, from the raw saved string, whether loading will drop
 * anything, and what to back up first. No DOM, no clock, no storage access.
 */
import { sanitizeFlashcards, sanitizeNotes } from './persistedState';

export const BACKUP_KEY = 'haunted-notes-storage-backup';

export interface LoadReport {
  /** Saved notes and cards that were removed because they were malformed. */
  dropped: number;
  /** The saved value could not be read at all (not JSON, or the wrong overall shape). */
  unreadable: boolean;
  /** True once a backup copy exists (written now or kept from earlier). */
  backedUp: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Items removed from one saved list. Absent (null/undefined) is normal and counts 0. */
function droppedFrom(raw: unknown, sanitize: (v: unknown) => unknown[]): number {
  if (raw === undefined || raw === null) return 0;
  if (!Array.isArray(raw)) return 1;
  return Math.max(0, raw.length - sanitize(raw).length);
}

/** Look at the raw saved string. Never throws. */
export function assessSavedValue(raw: string | null | undefined): LoadReport {
  const none: LoadReport = { dropped: 0, unreadable: false, backedUp: false };
  if (typeof raw !== 'string' || raw === '') return none;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...none, unreadable: true };
  }
  if (parsed === null) return none;
  if (!isRecord(parsed)) return { ...none, unreadable: true };
  const state = parsed.state;
  if (state === undefined || state === null) return none;
  if (!isRecord(state)) return { ...none, unreadable: true };
  try {
    const dropped =
      droppedFrom(state.notes, (v) => sanitizeNotes(v)) +
      droppedFrom(state.flashcards, (v) => sanitizeFlashcards(v));
    return { ...none, dropped };
  } catch {
    return { ...none, unreadable: true };
  }
}

/** Anything lost or unreadable means the raw value must be kept first. */
export function needsBackup(report: LoadReport): boolean {
  return report.dropped > 0 || report.unreadable;
}

/**
 * The exact string to write to the backup key, or null when nothing should be
 * written: nothing was lost, or a backup already exists (never overwritten).
 */
export function planBackup(
  raw: string | null | undefined,
  report: LoadReport,
  existingBackup: string | null,
): string | null {
  if (typeof raw !== 'string' || !needsBackup(report)) return null;
  if (existingBackup !== null) return null;
  return raw;
}

/** One-line notice. Contains counts only, never note or card text. */
export function noticeText(report: LoadReport): string {
  if (report.unreadable) {
    return report.backedUp
      ? 'Saved data could not be read; a backup copy was kept.'
      : 'Saved data could not be read, and a backup copy could not be saved.';
  }
  const n = report.dropped;
  const items = `${n} saved item${n === 1 ? '' : 's'}`;
  return report.backedUp
    ? `${items} could not be loaded; a backup copy was kept.`
    : `${items} could not be loaded, and a backup copy could not be saved.`;
}
