/**
 * The 60-second judge tour: a fixed list of coach-mark steps. Pure data and
 * helpers only (no React, no DOM). Step text never contains an answer.
 */
import type { View } from '../types';

export interface TourStep {
  id: string;
  /** View the app switches to for this step. */
  view: View;
  /** CSS selector of the element the step points at. */
  target: string;
  /** Optional ancestor selector to outline instead of the target itself. */
  box?: string;
  title: string;
  text: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'rooms',
    view: 'dashboard',
    target: '.room-card',
    title: 'Haunted rooms',
    text: 'Each note becomes a room. Its ghosts are the flashcards made from that note.',
  },
  {
    id: 'returned',
    view: 'dashboard',
    target: '.ghost--returned',
    box: '.ghost-card',
    title: 'A returned ghost',
    text: 'Orange ghosts have come back: their review is due, so answer them first.',
  },
  {
    id: 'start-quiz',
    view: 'dashboard',
    target: '[data-tour="start-quiz"]',
    title: 'Start Quiz',
    text: 'Start Quiz turns every haunting ghost into a fill-in-the-blank question.',
  },
  {
    id: 'hint-reveal',
    view: 'quiz',
    target: '.quiz-actions',
    title: 'Hint and Reveal',
    text: 'Stuck? Hint shows the first letter, then the length. Reveal shows the answer but counts as wrong.',
  },
  {
    id: 'insights',
    view: 'dashboard',
    target: '.insights',
    title: 'Study insights',
    text: 'Your streak, reviews today, 7-day accuracy and weakest rooms are tracked here.',
  },
];

/** Index of the step after `current`, or null when the tour is over or `current` is invalid. */
export function nextTourStep(current: number | null, total: number = TOUR_STEPS.length): number | null {
  if (current === null || !Number.isInteger(current) || current < 0) return null;
  return current + 1 < total ? current + 1 : null;
}

/** The step at `index`, or null for null or out-of-range values. */
export function tourStepAt(index: number | null): TourStep | null {
  if (index === null || !Number.isInteger(index)) return null;
  return TOUR_STEPS[index] ?? null;
}
