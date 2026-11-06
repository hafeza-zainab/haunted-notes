export type NoteInputMethod = 'type' | 'mic' | 'photo' | 'audio';

export interface Note {
  id: string;
  rawText: string;
  inputMethod: NoteInputMethod;
  createdAt: number;
}

export interface Flashcard {
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
