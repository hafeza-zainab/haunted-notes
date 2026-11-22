import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { Note, Flashcard, View, ReviewLog } from '../types';
import { generateFlashcards, updateWeaknessScore } from '../lib/cloze';
import { scheduleCorrect, scheduleWrong, defaultSrsFields } from '../lib/srs';
import { buildDemoData } from '../lib/demoData';
import { emptyReviewLog, appendReview, sanitizeReviewLog } from '../lib/reviewLog';
import { sanitizeNotes, sanitizeFlashcards, sanitizeUi } from '../lib/persistedState';
import { assessSavedValue, needsBackup, planBackup, BACKUP_KEY, type LoadReport } from '../lib/loadReport';
import { TOUR_STEPS, nextTourStep } from '../lib/tour';
import { mergeBackup, type BackupData, type ImportSummary } from '../lib/backup';

interface HauntedState {
  notes: Note[];
  flashcards: Flashcard[];
  currentView: View;
  soundEnabled: boolean;
  /** When set, QuizView restricts cards to this note's flashcards only. */
  quizNoteId: string | null;
  /** When true, QuizView restricts cards to those currently due. */
  quizDueOnly: boolean;
  /** True while demo notes/cards are loaded in the store. */
  isDemoLoaded: boolean;
  /** Compact review history (time, room, correct) used for study insights. */
  reviewLog: ReviewLog;

  // Actions
  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => number;
  deleteNote: (id: string) => void;
  renameNote: (id: string, title: string) => void;
  /** `hinted`: a correct answer that used a hint returns sooner than an unhinted one. */
  answerCard: (cardId: string, correct: boolean, hinted?: boolean) => void;
  setView: (view: View) => void;
  setQuizNoteId: (id: string | null) => void;
  setQuizDueOnly: (dueOnly: boolean) => void;
  toggleSound: () => void;
  resetAll: () => void;
  loadDemoData: () => void;
  clearDemoData: () => void;
  /** Dev-only: shift every card's dueAt back by 24 h so scheduled ghosts return. */
  timeTravelDay: () => void;
  /** Merges validated backup data into notes, flashcards and reviewLog only; returns the summary. */
  importBackup: (data: BackupData) => ImportSummary;
  /** Set when saved data had to be dropped on load. Never persisted. */
  loadNotice: LoadReport | null;
  dismissLoadNotice: () => void;
  /** Current 60-second tour step, or null when closed. Never persisted. */
  tourStep: number | null;
  /** Load the demo (if needed) and open the first tour step. */
  startTour: () => void;
  advanceTour: () => void;
  endTour: () => void;
}

/**
 * localStorage that never throws: private mode, a full quota or blocked storage
 * must not break store actions. A failed write is dropped (state stays in memory).
 */
const STORAGE_KEY = 'haunted-notes-storage';

/** Report from the last read of the saved value, picked up once by `merge`. */
let pendingLoadReport: LoadReport | null = null;

/**
 * Before anything is cleaned or overwritten: if the saved value would lose items
 * (or cannot be read), copy the raw string to a backup key. An existing backup is
 * never overwritten. Returns the report to show, or null when nothing was lost.
 */
function backupBeforeLoad(raw: string | null): LoadReport | null {
  const report = assessSavedValue(raw);
  if (!needsBackup(report)) return null;
  try {
    const existing = window.localStorage.getItem(BACKUP_KEY);
    const plan = planBackup(raw, report, existing);
    if (plan !== null) window.localStorage.setItem(BACKUP_KEY, plan);
    return { ...report, backedUp: true };
  } catch (err) {
    console.warn('Haunted Notes: could not save a backup copy', err);
    return report;
  }
}

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (name !== STORAGE_KEY) return raw;
      const report = backupBeforeLoad(raw);
      pendingLoadReport = report;
      // An unreadable value is not handed to the parser; the app starts empty
      // and the raw value stays safe in the backup key.
      return report?.unreadable ? null : raw;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch (err) {
      console.warn('Haunted Notes: could not save to localStorage', err);
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

/** View change for a tour step. The quiz step opens an unfiltered quiz. */
function tourPatch(index: number): Partial<HauntedState> {
  const step = TOUR_STEPS[index];
  if (step.view === 'quiz') {
    return { tourStep: index, currentView: 'quiz', quizNoteId: null, quizDueOnly: false };
  }
  return { tourStep: index, currentView: step.view };
}

export const useStore = create<HauntedState>()(
  persist(
    (set, get) => ({
      notes: [],
      flashcards: [],
      currentView: 'dashboard',
      soundEnabled: false, // sound is opt-in
      quizNoteId: null,
      quizDueOnly: false,
      isDemoLoaded: false,
      reviewLog: emptyReviewLog(),

      addNote: (noteData) => {
        const note: Note = {
          ...noteData,
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
        };
        const newCards = generateFlashcards(note);
        set((state) => ({
          notes: [...state.notes, note],
          flashcards: [...state.flashcards, ...newCards],
        }));
        return newCards.length;
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
          flashcards: state.flashcards.filter((c) => c.noteId !== id),
          quizNoteId: state.quizNoteId === id ? null : state.quizNoteId,
        }));
      },

      renameNote: (id, title) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, title: title.trim() || undefined } : n,
          ),
        }));
      },

      answerCard: (cardId, correct, hinted = false) => {
        const card = get().flashcards.find((c) => c.id === cardId);
        if (!card) return;
        set((state) => ({
          flashcards: state.flashcards.map((c) => {
            if (c.id !== cardId) return c;
            // Apply both the legacy weakness-score system and SM-2 scheduling
            const withWeakness = updateWeaknessScore(c, correct);
            const srsUpdate = correct
              ? scheduleCorrect(c, Date.now(), hinted)
              : scheduleWrong(c);
            return { ...withWeakness, ...srsUpdate };
          }),
          reviewLog: appendReview(state.reviewLog, {
            t: Date.now(),
            r: card.noteId,
            c: correct ? 1 : 0,
          }),
        }));
        if (get().soundEnabled) {
          playAnswerSound(correct);
        }
      },

      setView: (view) => set({ currentView: view }),

      setQuizNoteId: (id) => set({ quizNoteId: id }),

      setQuizDueOnly: (dueOnly) => set({ quizDueOnly: dueOnly }),

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      resetAll: () => {
        set({
          notes: [],
          flashcards: [],
          currentView: 'dashboard',
          quizNoteId: null,
          quizDueOnly: false,
          isDemoLoaded: false,
          reviewLog: emptyReviewLog(),
        });
      },

      loadDemoData: () => {
        if (get().isDemoLoaded) return;
        const { notes: demoNotes, flashcards: demoCards } = buildDemoData();
        set((state) => ({
          notes: [...state.notes, ...demoNotes],
          flashcards: [...state.flashcards, ...demoCards],
          isDemoLoaded: true,
        }));
      },

      clearDemoData: () => {
        set((state) => ({
          notes: state.notes.filter((n) => !n.id.startsWith('demo-')),
          flashcards: state.flashcards.filter((c) => !c.id.startsWith('demo-')),
          isDemoLoaded: false,
        }));
      },

      loadNotice: null,
      dismissLoadNotice: () => set({ loadNotice: null }),
      tourStep: null,
      startTour: () => {
        get().loadDemoData();
        set(tourPatch(0));
      },
      advanceTour: () => {
        const next = nextTourStep(get().tourStep);
        set(next === null ? { tourStep: null } : tourPatch(next));
      },
      endTour: () => set({ tourStep: null }),
      importBackup: (data) => {
        const { notes, flashcards, reviewLog } = get();
        const { data: merged, summary } = mergeBackup({ notes, flashcards, reviewLog }, data);
        set({
          notes: merged.notes,
          flashcards: merged.flashcards,
          reviewLog: merged.reviewLog,
        });
        return summary;
      },
      timeTravelDay: () => {
        const MS_PER_DAY = 86_400_000;
        set((state) => ({
          flashcards: state.flashcards.map((c) => ({
            ...c,
            dueAt: c.dueAt - MS_PER_DAY,
          })),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      // loadNotice and tourStep are session-only: never written to localStorage.
      partialize: (state) => {
        const rest: Partial<HauntedState> = { ...state };
        delete rest.loadNotice;
        delete rest.tourStep;
        return rest;
      },
      merge: (persisted, current) => {
        const p = typeof persisted === 'object' && persisted !== null ? (persisted as Record<string, unknown>) : {};
        return {
          ...current,
          ...sanitizeUi(p),
          notes: sanitizeNotes(p.notes),
          flashcards: sanitizeFlashcards(p.flashcards),
          reviewLog: sanitizeReviewLog(p.reviewLog),
          loadNotice: pendingLoadReport,
        };
      },

      // Migrate legacy cards that are missing SRS fields
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const now = Date.now();
        const migrated = state.flashcards.map((c) => {
          if (c.ease !== undefined) return c; // already has SRS fields
          return { ...c, ...defaultSrsFields(now) };
        });
        // Only trigger a set if something actually changed
        if (migrated.some((c, i) => c !== state.flashcards[i])) {
          state.flashcards = migrated;
        }
        // Review log: a missing, corrupt or newer-version log becomes valid;
        // notes and flashcards are untouched.
        state.reviewLog = sanitizeReviewLog(state.reviewLog);
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Minimal Web Audio tone synth
// ---------------------------------------------------------------------------
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // AudioContext unavailable; fail silently
  }
}

function playAnswerSound(correct: boolean) {
  if (correct) {
    // Soft banish shimmer: three quiet, rising sine tones
    playTone(392, 0.35, 'sine', 0.08);
    setTimeout(() => playTone(523, 0.35, 'sine', 0.07), 120);
    setTimeout(() => playTone(784, 0.55, 'sine', 0.06), 240);
  } else {
    playTone(110, 0.4, 'sawtooth');
    setTimeout(() => playTone(103, 0.4, 'sawtooth'), 60);
  }
}
