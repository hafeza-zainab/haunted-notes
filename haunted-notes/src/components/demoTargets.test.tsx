import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';
import AddNoteView from './AddNoteView';
import QuizView from './QuizView';
import NavBar from './NavBar';
import { useStore } from '../store/useStore';
import { buildDemoData } from '../lib/demoData';
import { scriptTargets } from '../lib/demoScript';

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

function names(html: string): Set<string> {
  return new Set([...html.matchAll(/data-demo="([^"]+)"/g)].map((m) => m[1]));
}

/**
 * Targets that only exist after a click or a finished round. A static render cannot
 * reach them, so they are checked in the component source instead (and in the browser run).
 */
const STATE_DEPENDENT: Record<string, string> = {
  'mic-hint': 'AddNoteView.tsx',
  'audio-hint': 'AddNoteView.tsx',
  'quiz-results': 'QuizView.tsx',
  'review-missed': 'QuizView.tsx',
  'back-dashboard': 'QuizView.tsx',
};

describe('every data-demo target in the script exists in the views', () => {
  it('is found in a rendered view or, for state-dependent ones, in the source', () => {
    const { notes, flashcards } = buildDemoData();
    // One banished card so "Next ghost returns in N days" shows
    const banished = {
      ...flashcards[0],
      id: 'x-banished',
      reps: 1,
      dueAt: Date.now() + 86_400_000,
    };

    const found = new Set<string>();
    const add = (html: string) => names(html).forEach((n) => found.add(n));

    seed({ notes: [], flashcards: [], isDemoLoaded: false });
    add(renderToStaticMarkup(<DashboardView />)); // empty state: try-demo, backup panel, strip
    add(renderToStaticMarkup(<AddNoteView />));
    add(renderToStaticMarkup(<NavBar />));

    seed({ notes, flashcards: [...flashcards, banished], isDemoLoaded: true });
    add(renderToStaticMarkup(<DashboardView />));
    add(renderToStaticMarkup(<NavBar />));
    add(renderToStaticMarkup(<QuizView />));

    for (const target of scriptTargets()) {
      const file = STATE_DEPENDENT[target];
      if (file) {
        const src = readFileSync(new URL(file, import.meta.url), 'utf8');
        expect(src, target).toContain(`data-demo="${target}"`);
      } else {
        expect(found.has(target), `missing data-demo="${target}"`).toBe(true);
      }
    }
  });

  it('all five ghost types are rendered for the demo data', () => {
    const { notes, flashcards } = buildDemoData();
    seed({ notes, flashcards, isDemoLoaded: true });
    const found = names(renderToStaticMarkup(<DashboardView />));
    for (const t of ['wisp', 'ghoul', 'banshee', 'phantom', 'poltergeist']) {
      expect(found.has(`ghost-${t}`), t).toBe(true);
    }
  });

  it('the quiz page never puts a demo answer in the DOM', () => {
    const { notes, flashcards } = buildDemoData();
    seed({ notes, flashcards, isDemoLoaded: true });
    const html = renderToStaticMarkup(<QuizView />);
    // Only the current card is rendered, and only with its blank: no full sentence appears.
    expect(html).toContain('data-demo="quiz-prompt"');
    for (const c of flashcards) {
      if (html.includes(c.sentence)) throw new Error(`full sentence of ${c.id} is in the DOM`);
    }
  });

  it('the privacy line is rendered with the backup panel', () => {
    seed({ notes: [], flashcards: [], isDemoLoaded: false });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('data-demo="privacy-line"');
    expect(html).toContain('Your notes stay in this browser.');
  });
});
