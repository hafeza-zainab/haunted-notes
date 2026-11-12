import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note, Flashcard, View } from '../types';
import { generateFlashcards, updateWeaknessScore } from '../lib/cloze';
import { scheduleCorrect, scheduleWrong, defaultSrsFields } from '../lib/srs';
import { buildDemoData } from '../lib/demoData';

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

  // Actions
  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => number;
  deleteNote: (id: string) => void;
  renameNote: (id: string, title: string) => void;
  answerCard: (cardId: string, correct: boolean) => void;
  setView: (view: View) => void;
  setQuizNoteId: (id: string | null) => void;
  setQuizDueOnly: (dueOnly: boolean) => void;
  toggleSound: () => void;
  resetAll: () => void;
  loadDemoData: () => void;
  clearDemoData: () => void;
  /** Dev-only: shift every card's dueAt back by 24 h so scheduled ghosts return. */
  timeTravelDay: () => void;
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

      answerCard: (cardId, correct) => {
        set((state) => ({
          flashcards: state.flashcards.map((c) => {
            if (c.id !== cardId) return c;
            // Apply both the legacy weakness-score system and SM-2 scheduling
            const withWeakness = updateWeaknessScore(c, correct);
            const srsUpdate = correct
              ? scheduleCorrect(c)
              : scheduleWrong(c);
            return { ...withWeakness, ...srsUpdate };
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
      name: 'haunted-notes-storage',

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
