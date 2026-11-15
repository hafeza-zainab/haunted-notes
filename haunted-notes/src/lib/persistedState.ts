/**
 * Pure checks for state read back from localStorage. The stored JSON may be
 * hand-edited, truncated or from an older build, so nothing here trusts its shape.
 */
import type { Flashcard, Note, View } from '../types';
import { defaultSrsFields } from './srs';

const VIEWS: readonly View[] = ['add', 'dashboard', 'quiz'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Keep only well-formed notes. Valid notes are returned as the same object. */
export function sanitizeNotes(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Note[] = [];
  for (const item of raw) {
    if (!isRecord(item) || !isStr(item.id) || !isStr(item.rawText) || seen.has(item.id)) continue;
    seen.add(item.id);
    const okMethod = item.inputMethod === 'type' || item.inputMethod === 'mic' || item.inputMethod === 'photo' || item.inputMethod === 'audio';
    if (okMethod && isNum(item.createdAt) && (item.title === undefined || isStr(item.title))) {
      out.push(item as unknown as Note);
    } else {
      out.push({
        ...(item as unknown as Note),
        inputMethod: okMethod ? (item.inputMethod as Note['inputMethod']) : 'type',
        createdAt: isNum(item.createdAt) ? item.createdAt : 0,
        title: isStr(item.title) ? item.title : undefined,
      });
    }
  }
  return out;
}

/** Keep only well-formed flashcards and fill missing SRS or counter fields. */
export function sanitizeFlashcards(raw: unknown, now: number = Date.now()): Flashcard[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Flashcard[] = [];
  for (const item of raw) {
    if (
      !isRecord(item) || !isStr(item.id) || !isStr(item.noteId) || !isStr(item.sentence) ||
      !isStr(item.clozeWord) || !isStr(item.prompt) || seen.has(item.id)
    ) continue;
    seen.add(item.id);
    const srsOk = isNum(item.ease) && isNum(item.intervalDays) && isNum(item.dueAt) && isNum(item.reps);
    const fine =
      srsOk && isNum(item.weaknessScore) && isNum(item.streakCorrect) && isNum(item.streakWrong) &&
      (item.lastReviewed === null || isNum(item.lastReviewed));
    if (fine) {
      out.push(item as unknown as Flashcard);
      continue;
    }
    const base = defaultSrsFields(now);
    out.push({
      id: item.id,
      noteId: item.noteId,
      sentence: item.sentence,
      clozeWord: item.clozeWord,
      prompt: item.prompt,
      weaknessScore: isNum(item.weaknessScore) ? Math.min(1, Math.max(0, item.weaknessScore)) : 1,
      streakCorrect: isNum(item.streakCorrect) ? item.streakCorrect : 0,
      streakWrong: isNum(item.streakWrong) ? item.streakWrong : 0,
      lastReviewed: isNum(item.lastReviewed) ? item.lastReviewed : null,
      ease: isNum(item.ease) ? item.ease : base.ease,
      intervalDays: isNum(item.intervalDays) ? item.intervalDays : base.intervalDays,
      dueAt: isNum(item.dueAt) ? item.dueAt : base.dueAt,
      reps: isNum(item.reps) ? item.reps : base.reps,
    });
  }
  return out;
}

export interface PersistedUi {
  currentView?: View;
  soundEnabled?: boolean;
  quizNoteId?: string | null;
  quizDueOnly?: boolean;
  isDemoLoaded?: boolean;
}

/** Pick only well-typed UI settings from stored state; wrong types are left out. */
export function sanitizeUi(raw: unknown): PersistedUi {
  if (!isRecord(raw)) return {};
  const out: PersistedUi = {};
  if (VIEWS.includes(raw.currentView as View)) out.currentView = raw.currentView as View;
  if (typeof raw.soundEnabled === 'boolean') out.soundEnabled = raw.soundEnabled;
  if (raw.quizNoteId === null || isStr(raw.quizNoteId)) out.quizNoteId = raw.quizNoteId as string | null;
  if (typeof raw.quizDueOnly === 'boolean') out.quizDueOnly = raw.quizDueOnly;
  if (typeof raw.isDemoLoaded === 'boolean') out.isDemoLoaded = raw.isDemoLoaded;
  return out;
}
