import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';
import NavBar from './NavBar';
import { useStore } from '../store/useStore';
import { buildDemoData } from '../lib/demoData';
import { defaultSrsFields } from '../lib/srs';

// renderToStaticMarkup reads the store's initial state
function seed(patch: Record<string, unknown>) {
  Object.assign(useStore.getInitialState(), patch);
}

let saved: Record<string, unknown>;
beforeEach(() => {
  saved = { ...useStore.getInitialState() };
  vi.stubGlobal('window', { location: { search: '' } });
});
afterEach(() => {
  Object.assign(useStore.getInitialState(), saved);
  vi.unstubAllGlobals();
});

describe('Dashboard Run demo button', () => {
  it('is shown when the demo is loaded, reads exactly "Run demo" and has no aria-label', () => {
    const { notes, flashcards } = buildDemoData();
    seed({ notes, flashcards, isDemoLoaded: true });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('<span aria-hidden="true">▶ </span>Run demo</button>');
    expect(html).not.toMatch(/<button[^>]*aria-label="[^"]*"[^>]*>[^<]*<span aria-hidden="true">▶/);
    expect(html).not.toContain('60-second tour');
  });

  it('is also shown for your own notes without the demo', () => {
    const note = { id: 'n1', rawText: 'The heart pumps blood around the body.', inputMethod: 'type' as const, createdAt: 1 };
    seed({ notes: [note], flashcards: [], isDemoLoaded: false });
    expect(renderToStaticMarkup(<DashboardView />)).toContain('Run demo</button>');
  });
});

describe('NavBar haunting count', () => {
  const card = (id: string) => ({
    id, noteId: 'n1', sentence: 's', clozeWord: 'w', prompt: 'p', weaknessScore: 1,
    streakCorrect: 0, streakWrong: 0, lastReviewed: null, ...defaultSrsFields(0),
  });

  it('says "1 ghost haunting" for one ghost', () => {
    seed({ flashcards: [card('a')] });
    expect(renderToStaticMarkup(<NavBar />)).toContain('<span class="sr-only">1 ghost haunting</span>');
  });

  it('says "2 ghosts haunting" for two ghosts', () => {
    seed({ flashcards: [card('a'), card('b')] });
    expect(renderToStaticMarkup(<NavBar />)).toContain('<span class="sr-only">2 ghosts haunting</span>');
  });
});
