export type NoteInputMethod = 'type' | 'mic' | 'photo' | 'audio';

export interface Note {
  id: string;
  rawText: string;
  inputMethod: NoteInputMethod;
  createdAt: number;
  /** User-editable display title. Falls back to first ~40 chars of rawText. */
  title?: string;
}

/**
 * SM-2 lite spaced-repetition scheduling fields.
 * Kept as a separate interface so srs.ts can operate on them purely.
 */
export interface SrsFields {
  /** Ease factor; controls interval growth. Default 2.5, min 1.3. */
  ease: number;
  /** Days until next review. 0 = due immediately. */
  intervalDays: number;
  /** Unix-ms timestamp when the card is next due. */
  dueAt: number;
  /** Consecutive correct reviews since last reset. */
  reps: number;
}

export interface Flashcard extends SrsFields {
  id: string;
  noteId: string;
  /** Full sentence with the cloze term intact */
  sentence: string;
  /** The hidden term */
  clozeWord: string;
  /** Prompt shown to user: sentence with blank */
  prompt: string;
  /** 0 = mastered, 1 = totally unknown */
  weaknessScore: number;
  /** How many times answered correctly in a row */
  streakCorrect: number;
  /** How many times answered incorrectly in a row */
  streakWrong: number;
  lastReviewed: number | null;
}

export type View = 'add' | 'dashboard' | 'quiz';
