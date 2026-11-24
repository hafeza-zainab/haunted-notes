/**
 * src/lib/demoSnapshot.ts
 *
 * Pure helpers that keep the user's real data safe while "Run demo" plays.
 * A snapshot is taken when a run starts (kept in memory and in its own
 * localStorage key) and restored when the run ends, is stopped, fails, or is
 * found on the next app load. No React, Zustand or DOM; the clock and the
 * storage are passed in.
 */

import type { Flashcard, Note, ReviewLog, View } from '../types';
import { sanitizeFlashcards, sanitizeNotes, sanitizeUi } from './persistedState';
import { sanitizeReviewLog } from './reviewLog';

export const SNAPSHOT_KEY = 'haunted-notes-demo-snapshot';
export const SNAPSHOT_VERSION = 1;

/** The part of the store a run may change and must give back. */
export interface DemoSnapshot {
  notes: Note[];
  flashcards: Flashcard[];
  reviewLog: ReviewLog;
  isDemoLoaded: boolean;
  currentView: View;
  quizNoteId: string | null;
  quizDueOnly: boolean;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Copy only the snapshot fields from any wider state, as a deep copy. */
export function takeSnapshot(state: DemoSnapshot): DemoSnapshot {
  return structuredClone({
    notes: state.notes,
    flashcards: state.flashcards,
    reviewLog: state.reviewLog,
    isDemoLoaded: state.isDemoLoaded,
    currentView: state.currentView,
    quizNoteId: state.quizNoteId,
    quizDueOnly: state.quizDueOnly,
  });
}

/** A fresh deep copy to apply to the store, so later edits never touch the snapshot. */
export function snapshotPatch(snapshot: DemoSnapshot): DemoSnapshot {
  return takeSnapshot(snapshot);
}

export function serializeSnapshot(snapshot: DemoSnapshot): string {
  return JSON.stringify({ v: SNAPSHOT_VERSION, data: snapshot });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Read a saved snapshot. Returns null for anything that is not a version 1
 * snapshot with arrays for notes and flashcards. Never throws.
 */
export function parseSnapshot(raw: unknown, now: number = Date.now()): DemoSnapshot | null {
  if (typeof raw !== 'string') return null;
  try {
    const outer: unknown = JSON.parse(raw);
    if (!isRecord(outer) || outer.v !== SNAPSHOT_VERSION || !isRecord(outer.data)) return null;
    const d = outer.data;
    if (!Array.isArray(d.notes) || !Array.isArray(d.flashcards)) return null;
    const ui = sanitizeUi(d);
    return {
      notes: sanitizeNotes(d.notes),
      flashcards: sanitizeFlashcards(d.flashcards, now),
      reviewLog: sanitizeReviewLog(d.reviewLog),
      isDemoLoaded: ui.isDemoLoaded ?? false,
      currentView: ui.currentView ?? 'dashboard',
      quizNoteId: ui.quizNoteId ?? null,
      quizDueOnly: ui.quizDueOnly ?? false,
    };
  } catch {
    return null;
  }
}

/** Save the snapshot under its own key. Returns false when the write fails. */
export function writeSnapshot(storage: StorageLike, snapshot: DemoSnapshot): boolean {
  try {
    storage.setItem(SNAPSHOT_KEY, serializeSnapshot(snapshot));
    return true;
  } catch {
    return false;
  }
}

/** Delete the snapshot key. Never throws. */
export function clearSnapshot(storage: StorageLike): void {
  try {
    storage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* nothing more can be done */
  }
}

export type RecoveryResult = 'none' | 'restored' | 'discarded' | 'failed';

/**
 * Run once on every app load, before the first render. A leftover snapshot
 * (the tab was closed mid-run) is handed to `apply`, then deleted. A corrupt
 * one is deleted without being applied. If `apply` throws, the key is kept so
 * the next load can try again. A second call finds no key and returns 'none'.
 */
export function recoverSnapshot(
  storage: StorageLike,
  apply: (snapshot: DemoSnapshot) => void,
  now: number = Date.now(),
): RecoveryResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SNAPSHOT_KEY);
  } catch {
    return 'none';
  }
  if (raw === null) return 'none';
  const snapshot = parseSnapshot(raw, now);
  if (snapshot === null) {
    clearSnapshot(storage);
    return 'discarded';
  }
  try {
    apply(snapshot);
  } catch {
    return 'failed';
  }
  clearSnapshot(storage);
  return 'restored';
}
