/**
 * src/lib/demoData.ts
 *
 * Hardcoded demo notes and flashcards.
 * No network, no OCR, no audio — pure synchronous data.
 * All IDs are prefixed "demo-" so clearDemoData can remove them cleanly.
 */

import type { Note, Flashcard } from '../types';
import { defaultSrsFields } from './srs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePrompt(sentence: string, word: string): string {
  const blank = '_'.repeat(word.length);
  // Global: every occurrence is blanked, otherwise a repeated word leaks the answer
  return sentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), blank);
}

function card(
  id: string,
  noteId: string,
  sentence: string,
  clozeWord: string,
  overrides: Partial<Flashcard> = {},
): Flashcard {
  return {
    id,
    noteId,
    sentence,
    clozeWord,
    prompt: makePrompt(sentence, clozeWord),
    weaknessScore: 1,
    streakCorrect: 0,
    streakWrong: 0,
    lastReviewed: null,
    ...defaultSrsFields(),
    ...overrides,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns freshly-built demo notes and flashcards.
 * Called as a function (not a constant) so that `Date.now()` is evaluated at
 * load time, keeping "due in the past" timestamps accurate.
 */
export function buildDemoData(): { notes: Note[]; flashcards: Flashcard[] } {
  const now = Date.now();
  const PAST = now - 1; // 1 ms in the past → immediately due

  // ── Notes ──────────────────────────────────────────────────────────────────

  const notes: Note[] = [
    {
      id: 'demo-note-java',
      rawText:
        'Java is a statically typed, object-oriented programming language. ' +
        'A Java class is a blueprint for creating objects. ' +
        'The JVM (Java Virtual Machine) interprets bytecode.',
      inputMethod: 'type',
      createdAt: now - 3 * 86_400_000, // 3 days ago
      title: 'Java Basics',
    },
    {
      id: 'demo-note-marketing',
      rawText:
        'SEO stands for Search Engine Optimization. ' +
        'A conversion rate measures the percentage of visitors who complete a goal. ' +
        'Content marketing focuses on creating valuable content to attract audiences.',
      inputMethod: 'type',
      createdAt: now - 2 * 86_400_000, // 2 days ago
      title: 'Digital Marketing',
    },
    {
      id: 'demo-note-biology',
      rawText:
        'Photosynthesis is the process by which plants convert sunlight into glucose. ' +
        'DNA stands for deoxyribonucleic acid and carries genetic information. ' +
        'Mitosis is the process of cell division that produces two identical daughter cells.',
      inputMethod: 'type',
      createdAt: now - 86_400_000, // 1 day ago
      title: 'Biology',
    },
  ];

  // ── Flashcards ─────────────────────────────────────────────────────────────

  const flashcards: Flashcard[] = [
    // ── Java Basics ──────────────────────────────────────────────────────────
    card(
      'demo-card-java-1',
      'demo-note-java',
      'Java is a statically typed, object-oriented programming language.',
      'statically',
    ),
    card(
      'demo-card-java-2',
      'demo-note-java',
      'A Java class is a blueprint for creating objects.',
      'blueprint',
    ),
    // This card was previously reviewed and is now back (reps: 1, dueAt in past)
    card(
      'demo-card-java-jvm',
      'demo-note-java',
      'The JVM (Java Virtual Machine) interprets bytecode.',
      'JVM',
      {
        weaknessScore: 0.7,
        reps: 1,
        intervalDays: 1,
        ease: 2.5,
        dueAt: PAST,   // ← ghost is back
        lastReviewed: now - 2 * 86_400_000,
      },
    ),

    // ── Digital Marketing ────────────────────────────────────────────────────
    card(
      'demo-card-mktg-1',
      'demo-note-marketing',
      'SEO stands for Search Engine Optimization.',
      'SEO',
    ),
    card(
      'demo-card-mktg-2',
      'demo-note-marketing',
      'A conversion rate measures the percentage of visitors who complete a goal.',
      'conversion',
    ),
    // This card was previously reviewed and is now back (reps: 1, dueAt in past)
    card(
      'demo-card-mktg-content',
      'demo-note-marketing',
      'Content marketing focuses on creating valuable content to attract audiences.',
      'Content',
      {
        weaknessScore: 0.6,
        reps: 1,
        intervalDays: 1,
        ease: 2.5,
        dueAt: PAST,   // ← ghost is back
        lastReviewed: now - 4 * 86_400_000,
      },
    ),

    // ── Biology ──────────────────────────────────────────────────────────────
    card(
      'demo-card-bio-1',
      'demo-note-biology',
      'Photosynthesis is the process by which plants convert sunlight into glucose.',
      'Photosynthesis',
    ),
    card(
      'demo-card-bio-2',
      'demo-note-biology',
      'DNA stands for deoxyribonucleic acid and carries genetic information.',
      'DNA',
    ),
    card(
      'demo-card-bio-3',
      'demo-note-biology',
      'Mitosis is the process of cell division that produces two identical daughter cells.',
      'Mitosis',
    ),
  ];

  return { notes, flashcards };
}
