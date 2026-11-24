/**
 * src/lib/demoScript.ts
 *
 * The "Run demo" script as plain data: nine chapters, each a list of steps, each
 * step a caption plus the actions the runner performs on the real app. No React,
 * Zustand or DOM. Every element is named by its `data-demo` attribute, never by
 * position or text. No quiz answer appears here: `typeAnswer` tells the runner to
 * read the answer from the store at run time.
 */

export type DemoStoreAction = 'emptyState' | 'loadDemoOnly' | 'timeTravelDay';

export type DemoAction =
  /** Do nothing for `ms`. */
  | { op: 'wait'; ms: number }
  /** Click the element, then hold for the rest of `ms`. */
  | { op: 'click'; target: string; ms: number }
  /** Type `text` one character at a time, spread over `ms`. */
  | { op: 'type'; target: string; text: string; ms: number }
  /** Type the current quiz card's answer (read from the store) into the input. */
  | { op: 'typeAnswer'; target: string; ms: number }
  /** Empty a text field. */
  | { op: 'clear'; target: string; ms: number }
  /** Outline the element and scroll it into view until the step ends. */
  | { op: 'highlight'; target: string; ms: number }
  /** Remove all outlines now. */
  | { op: 'clearHighlights'; ms: number }
  /** Call a real store action. */
  | { op: 'store'; name: DemoStoreAction; ms: number };

/** A text-only card shown over the app (intro and Built with Kiro). */
export interface DemoCardText {
  title: string;
  lines: string[];
}

export interface DemoStep {
  id: string;
  /** Index into CHAPTER_TITLES. */
  chapter: number;
  /** At most 12 words; describes only what is on screen during the step. */
  caption: string;
  card?: DemoCardText;
  actions: DemoAction[];
}

export const CHAPTER_TITLES = [
  'Intro',
  'Four inputs',
  'Ghost rooms',
  'The quiz',
  'Spaced repetition',
  'Study insights',
  'Your data stays yours',
  'Built with Kiro',
  'Try it yourself',
] as const;

export const MAX_CAPTION_WORDS = 12;

/** Text typed into the real textarea. All of it is labelled as sample data. */
export const SAMPLE_NOTE =
  'Sample note: Mitochondria are the powerhouse of the cell and make most of its energy.';
export const SAMPLE_PHOTO_TEXT =
  '[SAMPLE photo text] Photosynthesis is how plants convert sunlight into glucose.';
export const SAMPLE_AUDIO_TEXT =
  '[SAMPLE audio transcript] DNA stands for deoxyribonucleic acid and carries genetic information.';

const GHOST_TYPES = ['wisp', 'ghoul', 'banshee', 'phantom', 'poltergeist'] as const;

const ghostTour: DemoAction[] = GHOST_TYPES.flatMap((type): DemoAction[] => [
  { op: 'clearHighlights', ms: 0 },
  { op: 'highlight', target: `ghost-${type}`, ms: 1000 },
]);

/** Answer the current card correctly: type the answer, press Submit, wait out the banish. */
const answerRight: DemoAction[] = [
  { op: 'typeAnswer', target: 'quiz-input', ms: 700 },
  { op: 'click', target: 'quiz-submit', ms: 1100 },
];

export const DEMO_STEPS: readonly DemoStep[] = [
  // 0. Intro
  {
    id: 'intro',
    chapter: 0,
    caption: 'Haunted Notes: your unfinished notes come back to haunt you',
    card: { title: 'Haunted Notes', lines: ['Your unfinished notes come back to haunt you.'] },
    actions: [{ op: 'wait', ms: 6000 }],
  },

  // 1. Four inputs
  {
    id: 'inputs-strip',
    chapter: 1,
    caption: 'Four inputs feed one ghost pipeline.',
    actions: [
      { op: 'click', target: 'nav-add', ms: 700 },
      { op: 'highlight', target: 'stitch-strip', ms: 2800 },
    ],
  },
  {
    id: 'inputs-type',
    chapter: 1,
    caption: 'Type: a sample note, one character at a time.',
    actions: [
      { op: 'type', target: 'note-text', text: SAMPLE_NOTE, ms: 4300 },
      { op: 'wait', ms: 900 },
    ],
  },
  {
    id: 'inputs-add',
    chapter: 1,
    caption: 'Add Note turns the sample note into a room of ghosts.',
    actions: [
      { op: 'click', target: 'add-note-submit', ms: 600 },
      { op: 'wait', ms: 3400 },
    ],
  },
  {
    id: 'inputs-mic',
    chapter: 1,
    caption: "Live mic uses your browser's speech service.",
    actions: [
      { op: 'click', target: 'nav-add', ms: 700 },
      { op: 'click', target: 'tab-mic', ms: 700 },
      { op: 'highlight', target: 'mic-hint', ms: 4100 },
    ],
  },
  {
    id: 'inputs-photo',
    chapter: 1,
    caption: 'Photo: text recognition runs on your device. Sample text shown.',
    actions: [
      { op: 'click', target: 'tab-photo', ms: 600 },
      { op: 'type', target: 'note-text', text: SAMPLE_PHOTO_TEXT, ms: 2800 },
      { op: 'wait', ms: 2800 },
    ],
  },
  {
    id: 'inputs-audio',
    chapter: 1,
    caption: 'Audio file: Whisper runs on your device. Sample transcript shown.',
    actions: [
      { op: 'click', target: 'tab-audio', ms: 600 },
      { op: 'clear', target: 'note-text', ms: 300 },
      { op: 'type', target: 'note-text', text: SAMPLE_AUDIO_TEXT, ms: 2800 },
      { op: 'highlight', target: 'audio-hint', ms: 2800 },
    ],
  },

  // 2. Ghost rooms
  {
    id: 'rooms-load',
    chapter: 2,
    caption: 'Now the built-in sample notes: each note becomes a room.',
    actions: [
      { op: 'click', target: 'nav-dashboard', ms: 500 },
      { op: 'store', name: 'loadDemoOnly', ms: 500 },
      { op: 'highlight', target: 'rooms-grid', ms: 4000 },
    ],
  },
  {
    id: 'rooms-ghosts',
    chapter: 2,
    caption: 'Five ghost types show how weak each fact is.',
    actions: [...ghostTour, { op: 'clearHighlights', ms: 500 }],
  },
  {
    id: 'rooms-meter',
    chapter: 2,
    caption: 'The haunt meter shows how haunted all your notes are.',
    actions: [{ op: 'highlight', target: 'haunt-meter', ms: 5000 }],
  },

  // 3. The quiz
  {
    id: 'quiz-start',
    chapter: 3,
    caption: 'Start Quiz turns each ghost into a fill-in-the-blank question.',
    actions: [
      { op: 'highlight', target: 'start-quiz', ms: 1500 },
      { op: 'click', target: 'start-quiz', ms: 2000 },
    ],
  },
  {
    id: 'quiz-hint',
    chapter: 3,
    caption: 'Hint shows the first letter, then the length.',
    actions: [
      { op: 'click', target: 'quiz-hint', ms: 2300 },
      { op: 'click', target: 'quiz-hint', ms: 2700 },
    ],
  },
  {
    id: 'quiz-wrong',
    chapter: 3,
    caption: 'A wrong answer shakes the ghost and shows the answer.',
    actions: [
      { op: 'type', target: 'quiz-input', text: 'not sure', ms: 1200 },
      { op: 'click', target: 'quiz-submit', ms: 4300 },
    ],
  },
  {
    id: 'quiz-next',
    chapter: 3,
    caption: 'Next card: type the right answer.',
    actions: [
      { op: 'click', target: 'quiz-submit', ms: 800 },
      { op: 'typeAnswer', target: 'quiz-input', ms: 1500 },
      { op: 'wait', ms: 700 },
    ],
  },
  {
    id: 'quiz-banish',
    chapter: 3,
    caption: 'Right answer: the ghost fades away. Banished!',
    actions: [{ op: 'click', target: 'quiz-submit', ms: 2000 }],
  },
  {
    id: 'quiz-reveal',
    chapter: 3,
    caption: 'Reveal shows the answer, but counts as wrong.',
    actions: [
      { op: 'click', target: 'quiz-reveal', ms: 2800 },
      { op: 'click', target: 'quiz-submit', ms: 1000 },
    ],
  },
  {
    id: 'quiz-skip',
    chapter: 3,
    caption: 'Skip moves on without scoring.',
    actions: [{ op: 'click', target: 'quiz-skip', ms: 2500 }],
  },
  {
    id: 'quiz-rest',
    chapter: 3,
    caption: 'Answering the remaining ghosts.',
    actions: [...answerRight, ...answerRight, ...answerRight, ...answerRight, ...answerRight],
  },
  {
    id: 'quiz-results',
    chapter: 3,
    caption: 'Results show your score, streak and missed cards.',
    actions: [{ op: 'highlight', target: 'quiz-results', ms: 5000 }],
  },
  {
    id: 'quiz-review',
    chapter: 3,
    caption: 'Review missed replays only the cards you missed.',
    actions: [
      { op: 'highlight', target: 'review-missed', ms: 1300 },
      { op: 'click', target: 'review-missed', ms: 1700 },
    ],
  },
  {
    id: 'quiz-review-answers',
    chapter: 3,
    caption: 'Answering the two missed ghosts again.',
    actions: [...answerRight, ...answerRight],
  },
  {
    id: 'quiz-done',
    chapter: 3,
    caption: 'Review complete: the missed ghosts are answered.',
    actions: [{ op: 'highlight', target: 'quiz-results', ms: 3500 }],
  },

  // 4. Spaced repetition
  {
    id: 'srs-next',
    chapter: 4,
    caption: 'Banished ghosts return later. The dashboard says when.',
    actions: [
      { op: 'click', target: 'back-dashboard', ms: 700 },
      { op: 'highlight', target: 'next-return', ms: 3800 },
    ],
  },
  {
    id: 'srs-travel',
    chapter: 4,
    caption: 'Sample time travel: the store jumps one day ahead.',
    actions: [
      { op: 'highlight', target: 'next-return', ms: 1500 },
      { op: 'store', name: 'timeTravelDay', ms: 2500 },
    ],
  },
  {
    id: 'srs-returned',
    chapter: 4,
    caption: 'Orange ghosts have returned and are due for review.',
    actions: [{ op: 'highlight', target: 'returned-ghost', ms: 6500 }],
  },

  // 5. Study insights
  {
    id: 'insights-stats',
    chapter: 5,
    caption: 'Study insights: streak, reviews today and accuracy.',
    actions: [{ op: 'highlight', target: 'insights', ms: 5500 }],
  },
  {
    id: 'insights-chart',
    chapter: 5,
    caption: 'The bar chart counts reviews per day.',
    actions: [{ op: 'highlight', target: 'insights-chart', ms: 5500 }],
  },

  // 6. Your data stays yours
  {
    id: 'data-backup',
    chapter: 6,
    caption: 'Export and Import save or load your own backup file.',
    actions: [
      { op: 'highlight', target: 'backup-export', ms: 2800 },
      { op: 'highlight', target: 'backup-import', ms: 2800 },
    ],
  },
  {
    id: 'data-privacy',
    chapter: 6,
    caption: 'Your notes stay in this browser.',
    actions: [{ op: 'highlight', target: 'privacy-line', ms: 5400 }],
  },

  // 7. Built with Kiro (facts from docs/KIRO_EVIDENCE.md)
  {
    id: 'kiro-specs',
    chapter: 7,
    caption: 'Built with Kiro: specs and steering files.',
    card: {
      title: 'Built with Kiro',
      lines: [
        'Specs: requirements, design and tasks, written before code.',
        'Steering files: product, tech, design and testing rules.',
      ],
    },
    actions: [{ op: 'wait', ms: 4500 }],
  },
  {
    id: 'kiro-agent',
    chapter: 7,
    caption: 'A custom agent and agent hooks.',
    card: {
      title: 'Built with Kiro',
      lines: [
        'Custom agent: ghost-ui-reviewer, a report-only UI reviewer.',
        'Hooks run lint, tests and a reduced-motion check on save.',
      ],
    },
    actions: [{ op: 'wait', ms: 4500 }],
  },
  {
    id: 'kiro-mcp',
    chapter: 7,
    caption: 'Playwright MCP and property-based tests.',
    card: {
      title: 'Built with Kiro',
      lines: [
        'MCP: the Playwright server runs the browser checks.',
        'Property-based tests (fast-check) found six bugs.',
      ],
    },
    actions: [{ op: 'wait', ms: 4500 }],
  },

  // 8. End card
  {
    id: 'end',
    chapter: 8,
    caption: 'Try it yourself.',
    actions: [
      { op: 'store', name: 'emptyState', ms: 500 },
      { op: 'highlight', target: 'try-demo', ms: 5500 },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function stepMs(step: DemoStep): number {
  return step.actions.reduce((sum, a) => sum + a.ms, 0);
}

/** Total length of the script at normal speed, in milliseconds. */
export function scriptTotalMs(steps: readonly DemoStep[] = DEMO_STEPS): number {
  return steps.reduce((sum, s) => sum + stepMs(s), 0);
}

/** Time at which step `index` starts. */
export function stepStartMs(index: number, steps: readonly DemoStep[] = DEMO_STEPS): number {
  let t = 0;
  for (let i = 0; i < index && i < steps.length; i++) t += stepMs(steps[i]);
  return t;
}

/** The step playing at `elapsedMs`; clamps to the first and last step. */
export function locate(
  elapsedMs: number,
  steps: readonly DemoStep[] = DEMO_STEPS,
): { stepIndex: number; chapter: number } {
  let t = 0;
  const e = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  for (let i = 0; i < steps.length; i++) {
    t += stepMs(steps[i]);
    if (e < t) return { stepIndex: i, chapter: steps[i].chapter };
  }
  const last = steps.length - 1;
  return { stepIndex: last, chapter: steps[last].chapter };
}

/** m:ss, rounding down. Negative or non-finite input shows 0:00; the display stops at 99:59. */
export function formatClock(ms: number): string {
  const total = Number.isFinite(ms) ? Math.min(5999, Math.max(0, Math.floor(ms / 1000))) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

/** Every `data-demo` name the script touches. */
export function scriptTargets(steps: readonly DemoStep[] = DEMO_STEPS): Set<string> {
  const out = new Set<string>();
  for (const step of steps) {
    for (const a of step.actions) {
      if ('target' in a) out.add(a.target);
    }
  }
  return out;
}
