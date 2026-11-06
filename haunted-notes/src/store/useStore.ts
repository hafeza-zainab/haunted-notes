import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note, Flashcard, View } from '../types';
import { generateFlashcards, updateWeaknessScore } from '../lib/cloze';

interface HauntedState {
  notes: Note[];
  flashcards: Flashcard[];
  currentView: View;
  soundEnabled: boolean;
  /** When set, QuizView restricts cards to this note's flashcards only. */
  quizNoteId: string | null;

  // Actions
  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => void;
  deleteNote: (id: string) => void;
  renameNote: (id: string, title: string) => void;
  answerCard: (cardId: string, correct: boolean) => void;
  setView: (view: View) => void;
  setQuizNoteId: (id: string | null) => void;
  toggleSound: () => void;
  resetAll: () => void;
}

export const useStore = create<HauntedState>()(
  persist(
    (set, get) => ({
      notes: [],
      flashcards: [],
      currentView: 'dashboard',
      soundEnabled: true,
      quizNoteId: null,

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
          flashcards: state.flashcards.map((c) =>
            c.id === cardId ? updateWeaknessScore(c, correct) : c,
          ),
        }));
        if (get().soundEnabled) {
          playAnswerSound(correct);
        }
      },

      setView: (view) => set({ currentView: view }),

      setQuizNoteId: (id) => set({ quizNoteId: id }),

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      resetAll: () => {
        set({
          notes: [],
          flashcards: [],
          currentView: 'dashboard',
          quizNoteId: null,
        });
      },
    }),
    {
      name: 'haunted-notes-storage',
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

function playTone(freq: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // AudioContext unavailable; fail silently
  }
}

function playAnswerSound(correct: boolean) {
  if (correct) {
    playTone(523, 0.15, 'triangle');
    setTimeout(() => playTone(659, 0.15, 'triangle'), 100);
    setTimeout(() => playTone(784, 0.25, 'triangle'), 200);
  } else {
    playTone(110, 0.4, 'sawtooth');
    setTimeout(() => playTone(103, 0.4, 'sawtooth'), 60);
  }
}
