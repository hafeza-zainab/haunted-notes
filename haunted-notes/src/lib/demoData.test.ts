import { describe, it, expect } from 'vitest';
import { buildDemoData } from './demoData';
import { normalizeBlanks, BLANK } from './blank';
import { ghostTypeFor, GHOST_TYPES } from './haunt';
import { isDue, isBanished } from './srs';

function containsWholeWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
}

describe('buildDemoData', () => {
  const { flashcards } = buildDemoData();

  it('no demo prompt contains its answer (every occurrence is blanked)', () => {
    for (const card of flashcards) {
      expect(containsWholeWord(card.prompt, card.clozeWord)).toBe(false);
    }
  });

  it('every demo prompt has a blank, and the displayed blank is the fixed one', () => {
    for (const card of flashcards) {
      const runs = normalizeBlanks(card.prompt).match(/_+/g) ?? [];
      expect(runs.length).toBeGreaterThan(0);
      for (const run of runs) expect(run).toBe(BLANK);
    }
  });

  it('shows all five ghost types on first load', () => {
    const types = new Set(flashcards.map((c) => ghostTypeFor(c.weaknessScore)));
    for (const type of GHOST_TYPES) expect(types.has(type)).toBe(true);
  });

  it('has exactly two returned (due) ghosts and none banished', () => {
    const now = Date.now();
    expect(flashcards.filter((c) => isDue(c, now)).length).toBe(2);
    expect(flashcards.filter((c) => isBanished(c, now)).length).toBe(0);
  });

  it('every weakness score is within [0, 1]', () => {
    for (const c of flashcards) {
      expect(c.weaknessScore).toBeGreaterThanOrEqual(0);
      expect(c.weaknessScore).toBeLessThanOrEqual(1);
    }
  });
});
