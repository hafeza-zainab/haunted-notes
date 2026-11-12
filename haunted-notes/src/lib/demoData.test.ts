import { describe, it, expect } from 'vitest';
import { buildDemoData } from './demoData';
import { normalizeBlanks, BLANK } from './blank';

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
});
