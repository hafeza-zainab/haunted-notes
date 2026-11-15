import type { Flashcard, Note, ReviewLog } from '../types';

export const BACKUP_APP = 'haunted-notes';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  notes: 500,
  flashcards: 5000,
  events: 5000,
  id: 100,
  rawText: 20000,
  title: 200,
  sentence: 1000,
  prompt: 1000,
  clozeWord: 100,
} as const;

export interface BackupData {
  notes: Note[];
  flashcards: Flashcard[];
  reviewLog: ReviewLog;
}

export interface ExportFile extends BackupData {
  app: string;
  schemaVersion: number;
  exportedAt: number;
}

/** Builds the export envelope. Copies exactly the three data fields; UI settings are never included. */
export function buildExport(data: BackupData, now: number): ExportFile {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    notes: data.notes,
    flashcards: data.flashcards,
    reviewLog: data.reviewLog,
  };
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * File name `haunted-notes-backup-YYYY-MM-DD.json` using the local date.
 * `tzOffsetMinutes` follows `Date.prototype.getTimezoneOffset` (UTC minus local, in minutes).
 */
export function backupFileName(now: number, tzOffsetMinutes = 0): string {
  const local = new Date(now - tzOffsetMinutes * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  return `haunted-notes-backup-${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}.json`;
}

/** True when `bytes` is a finite number from 0 to the file size limit, inclusive. */
export function isFileSizeAllowed(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes >= 0 && bytes <= BACKUP_LIMITS.fileBytes;
}
