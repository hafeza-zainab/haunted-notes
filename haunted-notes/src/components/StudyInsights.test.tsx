import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import StudyInsights from './StudyInsights';
import { useStore } from '../store/useStore';
import { emptyReviewLog } from '../lib/reviewLog';
import { defaultSrsFields } from '../lib/srs';
import type { Flashcard, Note } from '../types';

// Local noon, so events seconds before "now" always fall on the same local day.
const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();

function makeNote(id: string, rawText: string): Note {
  return { id, rawText, inputMethod: 'type', createdAt: NOW };
}

function makeCard(id: string, noteId: string, weaknessScore: number): Flashcard {
  return {
    ...defaultSrsFields(NOW),
    id,
    noteId,
    sentence: `SENTENCE_MARKER_${id} full text`,
    clozeWord: `CLOZE_MARKER_${id}`,
    prompt: `PROMPT_MARKER_${id} ____`,
    weaknessScore,
    streakCorrect: 0,
    streakWrong: 0,
    lastReviewed: null,
  };
}

/**
 * renderToString reads the store through zustand's server snapshot, which is
 * getInitialState(), not the live state. Seed both so the render sees the data.
 */
function seed(partial: Partial<ReturnType<typeof useStore.getState>>): void {
  useStore.setState(partial);
  Object.assign(useStore.getInitialState(), partial);
}

function render(): string {
  // Drop React's text-node separators (<!-- -->) so adjacent text reads as one string.
  return renderToString(<StudyInsights />).replace(/<!-- -->/g, '');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  seed({ notes: [], flashcards: [], reviewLog: emptyReviewLog() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StudyInsights', () => {
  it('shows zero streak, zero today and "No reviews yet" for an empty log', () => {
    const html = render();
    expect(html).toContain('<dd>0</dd>');
    expect(html.match(/<dd>0<\/dd>/g)).toHaveLength(2);
    expect(html).toContain('No reviews yet');
    expect(html).toContain('No reviews in the last 7 days');
  });

  it('shows the expected numbers for a populated log', () => {
    seed({
      notes: [makeNote('n1', 'Alpha room')],
      flashcards: [makeCard('c1', 'n1', 0.5)],
      reviewLog: {
        v: 1,
        events: [
          { t: NOW - 3000, r: 'n1', c: 1 },
          { t: NOW - 2000, r: 'n1', c: 1 },
          { t: NOW - 1000, r: 'n1', c: 0 },
        ],
      },
    });
    const html = render();
    expect(html).toContain('<dt>day streak</dt><dd>1</dd>');
    expect(html).toContain('<dt>reviewed today</dt><dd>3</dd>');
    expect(html).toContain('<dd>67%</dd>');
    expect(html).not.toContain('No reviews yet');
    expect(html).toContain('Alpha room');
    expect(html).toContain('weakness 50%');
  });

  it('lists at most 3 weakest rooms, weakest first', () => {
    const ids = ['n1', 'n2', 'n3', 'n4', 'n5'];
    seed({
      notes: ids.map((id, i) => makeNote(id, `Room title ${i + 1}`)),
      flashcards: ids.map((id, i) => makeCard(`c${i + 1}`, id, 0.1 + i * 0.2)),
    });
    const html = render();
    expect(html.match(/<li/g)).toHaveLength(3);
    const p5 = html.indexOf('Room title 5');
    const p4 = html.indexOf('Room title 4');
    const p3 = html.indexOf('Room title 3');
    expect(p5).toBeGreaterThan(-1);
    expect(p5).toBeLessThan(p4);
    expect(p4).toBeLessThan(p3);
    expect(html).not.toContain('Room title 2');
    expect(html).not.toContain('Room title 1');
  });

  it('shows the empty weak-rooms message when there are no rooms', () => {
    expect(render()).toContain('No weak rooms');
  });

  it('never renders card sentence, prompt or cloze word text', () => {
    seed({
      notes: [makeNote('n1', 'Alpha room'), makeNote('n2', 'Beta room')],
      flashcards: [makeCard('c1', 'n1', 0.9), makeCard('c2', 'n2', 0.4)],
      reviewLog: { v: 1, events: [{ t: NOW - 1000, r: 'n1', c: 0 }] },
    });
    const html = render();
    expect(html).not.toContain('CLOZE_MARKER');
    expect(html).not.toContain('SENTENCE_MARKER');
    expect(html).not.toContain('PROMPT_MARKER');
  });

  it('has no aria-live region', () => {
    seed({
      notes: [makeNote('n1', 'Alpha room')],
      flashcards: [makeCard('c1', 'n1', 0.9)],
      reviewLog: { v: 1, events: [{ t: NOW - 1000, r: 'n1', c: 1 }] },
    });
    expect(render()).not.toContain('aria-live');
    seed({ notes: [], flashcards: [], reviewLog: emptyReviewLog() });
    expect(render()).not.toContain('aria-live');
  });

  it('is a section named by its "Study insights" heading', () => {
    const html = render();
    const section = /<section[^>]*aria-labelledby="([^"]+)"/.exec(html);
    expect(section).not.toBeNull();
    const id = section![1];
    expect(html).toMatch(new RegExp(`<h2 id="${id}">Study insights</h2>`));
  });
});
