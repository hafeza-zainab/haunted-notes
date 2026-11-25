/**
 * src/lib/demoScript.ts
 *
 * The "Run demo" script as plain data: nine chapters, each a list of steps, each
 * step a caption plus the actions the runner performs on the real app. No React,
 * Zustand or DOM. Every element is named by its `data-demo` attribute, never by
 * position or text. No quiz answer appears here: `typeAnswer` and `typeAnswerTypo`
 * tell the runner to read the answer from the store at run time.
 *
 * CAPTIONS ARE SUBTITLES. Each caption is a piece of the narration text (see
 * NARRATION_SCRIPT.md and `cues` in public/demo-audio/manifest.json), shown when
 * those words are spoken. A step therefore starts at its cue's time in the clip,
 * plus about 100 ms for the sound to begin. Tests check the words and the times.
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
  /** Like typeAnswer, but with one wrong letter when the answer is long enough to forgive it. */
  | { op: 'typeAnswerTypo'; target: string; ms: number }
  /** Empty a text field. */
  | { op: 'clear'; target: string; ms: number }
  /** Outline the element and scroll it into view until the step ends. */
  | { op: 'highlight'; target: string; ms: number }
  /** Remove all outlines now. */
  | { op: 'clearHighlights'; ms: number }
  /** Call a real store action (`times` repeats it, for example two one-day jumps). */
  | { op: 'store'; name: DemoStoreAction; ms: number; times?: number };

/** A text-only card shown over the app (intro and Built with Kiro). */
export interface DemoCardText {
  title: string;
  lines: string[];
}

export interface DemoStep {
  id: string;
  /** Index into CHAPTER_TITLES. */
  chapter: number;
  /** At most 12 words: the narration spoken while this step is on screen. */
  caption: string;
  /** Set when the screen shows sample data or a simulated clock jump; the bar says so. */
  sample?: string;
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

/** Stable ids for the nine chapters, in order. The narration manifest uses the same ids. */
export const CHAPTER_IDS = [
  'intro',
  'inputs',
  'rooms',
  'quiz',
  'srs',
  'insights',
  'data',
  'kiro',
  'end',
] as const;

/**
 * Extra time the intro is held (the clip is 5.04 s) and the end card is held (7.04 s).
 * The first sound in a page starts up to 0.8 s late (measured), so these two clips
 * need more room than the 0.4 s margin alone.
 */
export const INTRO_HOLD_MS = 1000;
export const END_HOLD_MS = 3000;

export const MAX_CAPTION_WORDS = 12;

/** Labels shown in the bar while the screen holds sample data or a simulated clock jump. */
export const SAMPLE_DATA_LABEL = 'sample data';
export const SAMPLE_TIME_LABEL = 'sample: simulated time jump';

/** Text typed into the real textarea. All of it is labelled as sample data. */
export const SAMPLE_NOTE =
  'Sample note: Mitochondria are the powerhouse of the cell and make most of its energy.';
export const SAMPLE_PHOTO_TEXT =
  '[SAMPLE photo text] Photosynthesis is how plants convert sunlight into glucose.';
export const SAMPLE_AUDIO_TEXT =
  '[SAMPLE audio transcript] DNA stands for deoxyribonucleic acid and carries genetic information.';

const GHOST_TYPES = ['wisp', 'ghoul', 'banshee', 'phantom', 'poltergeist'] as const;

/** The built-in room the quiz chapter uses (three cards, so a round fits the narration). */
export const QUIZ_ROOM_TARGET = 'quiz-room-demo-note-biology';

// ── Building blocks ──────────────────────────────────────────────────────────

/** Lengths of consecutive steps, from their start times and the end of the chapter. */
function lens(starts: readonly number[], end: number): number[] {
  return starts.map((s, i) => (starts[i + 1] ?? end) - s);
}

/** The actions, padded with a wait so that they last exactly `len` ms. Throws if they are too long. */
function fit(len: number, actions: DemoAction[]): DemoAction[] {
  const used = actions.reduce((sum, a) => sum + a.ms, 0);
  if (used > len) throw new Error(`demo step needs ${used} ms but has ${len} ms`);
  return used === len ? actions : [...actions, { op: 'wait', ms: len - used }];
}

/** Highlight each ghost type in turn, weakest memory (wisp) to most menacing (poltergeist). */
function ghostWalk(totalMs: number): DemoAction[] {
  const each = Math.floor(totalMs / GHOST_TYPES.length);
  return GHOST_TYPES.flatMap((type): DemoAction[] => [
    { op: 'clearHighlights', ms: 0 },
    { op: 'highlight', target: `ghost-${type}`, ms: each },
  ]);
}

/**
 * Chapter-relative start of every step, in ms, and the chapter's end. A start is the
 * cue time of its subtitle in the clip plus about 100 ms. Chapter lengths are the clip
 * length plus room for the sound to start and for the last screen to be read.
 */
const T = {
  intro: { starts: [0, 3300], end: 7000 },
  inputs: { starts: [0, 2000, 4300, 8200, 11350, 14600, 17500], end: 23000 },
  rooms: { starts: [0, 2400, 5350, 8550], end: 12600 },
  quiz: { starts: [0, 2850, 6200, 8800, 11300, 15700, 18900], end: 26500 },
  srs: { starts: [0, 2650, 5750, 8600, 12450], end: 17000 },
  insights: { starts: [0, 2600, 5750], end: 8400 },
  data: { starts: [0, 2150, 4500], end: 8800 },
  kiro: { starts: [0, 4950, 8750], end: 12800 },
  end: { starts: [0, 3600], end: 9000 },
} as const;

const L = {
  intro: lens(T.intro.starts, T.intro.end),
  inputs: lens(T.inputs.starts, T.inputs.end),
  rooms: lens(T.rooms.starts, T.rooms.end),
  quiz: lens(T.quiz.starts, T.quiz.end),
  srs: lens(T.srs.starts, T.srs.end),
  insights: lens(T.insights.starts, T.insights.end),
  data: lens(T.data.starts, T.data.end),
  kiro: lens(T.kiro.starts, T.kiro.end),
  end: lens(T.end.starts, T.end.end),
};

const INTRO_CARD: DemoCardText = {
  title: 'Haunted Notes',
  lines: ['Turns your unfinished notes into ghosts that haunt you until you master them.'],
};

const KIRO_CARDS: DemoCardText[] = [
  {
    title: 'Built with Kiro',
    lines: [
      'Specs: requirements, design and tasks, written before code.',
      'Steering files: product, tech, design and testing rules.',
      'Hooks: lint, tests and a reduced-motion check on save.',
    ],
  },
  {
    title: 'Built with Kiro',
    lines: [
      'Custom agent: ghost-ui-reviewer, a report-only UI reviewer.',
      'MCP: the Playwright server runs the browser checks.',
    ],
  },
  {
    title: 'Built with Kiro',
    lines: [
      'Property-based tests (fast-check) found six bugs.',
      'Examples: a number became the blank, and a prompt leaked the answer.',
    ],
  },
];

export const DEMO_STEPS: readonly DemoStep[] = [
  // 0. Intro: "Haunted Notes turns your unfinished notes into ghosts that haunt you until you master them."
  {
    id: 'intro-1',
    chapter: 0,
    caption: 'Haunted Notes turns your unfinished notes into ghosts',
    card: INTRO_CARD,
    actions: fit(L.intro[0], []),
  },
  {
    id: 'intro-2',
    chapter: 0,
    caption: 'that haunt you until you master them.',
    card: INTRO_CARD,
    // The last second is a hold: the first sound in a page starts late, so the clip needs room.
    actions: fit(L.intro[1], [
      { op: 'wait', ms: L.intro[1] - INTRO_HOLD_MS },
      { op: 'wait', ms: INTRO_HOLD_MS },
    ]),
  },

  // 1. Four inputs
  {
    id: 'inputs-1',
    chapter: 1,
    caption: 'Add notes four ways.',
    actions: fit(L.inputs[0], [
      { op: 'click', target: 'nav-add', ms: 700 },
      { op: 'highlight', target: 'stitch-strip', ms: 1300 },
    ]),
  },
  {
    id: 'inputs-2',
    chapter: 1,
    caption: 'Type them, speak with your microphone,',
    actions: fit(L.inputs[1], [
      { op: 'wait', ms: 900 },
      { op: 'click', target: 'tab-mic', ms: 800 },
    ]),
  },
  {
    id: 'inputs-3',
    chapter: 1,
    caption: 'snap a photo of printed text, or upload an audio recording.',
    sample: SAMPLE_DATA_LABEL,
    actions: fit(L.inputs[2], [
      { op: 'click', target: 'tab-photo', ms: 400 },
      { op: 'type', target: 'note-text', text: SAMPLE_PHOTO_TEXT, ms: 1500 },
      { op: 'click', target: 'tab-audio', ms: 600 },
      { op: 'type', target: 'note-text', text: SAMPLE_AUDIO_TEXT, ms: 1400 },
    ]),
  },
  {
    id: 'inputs-4',
    chapter: 1,
    caption: 'Audio files and photos are processed on your own device,',
    sample: SAMPLE_DATA_LABEL,
    actions: fit(L.inputs[3], [{ op: 'highlight', target: 'audio-hint', ms: L.inputs[3] }]),
  },
  {
    id: 'inputs-5',
    chapter: 1,
    caption: "and the live microphone uses your browser's speech service.",
    sample: SAMPLE_DATA_LABEL,
    actions: fit(L.inputs[4], [
      { op: 'click', target: 'tab-mic', ms: 500 },
      { op: 'highlight', target: 'mic-hint', ms: L.inputs[4] - 500 },
    ]),
  },
  {
    id: 'inputs-6',
    chapter: 1,
    caption: 'Each note is split into fill-in-the-blank flashcards,',
    sample: SAMPLE_DATA_LABEL,
    actions: fit(L.inputs[5], [
      { op: 'click', target: 'tab-type', ms: 400 },
      { op: 'type', target: 'note-text', text: SAMPLE_NOTE, ms: 2500 },
    ]),
  },
  {
    id: 'inputs-7',
    chapter: 1,
    caption: 'so even a long lecture becomes a short set of questions.',
    sample: SAMPLE_DATA_LABEL,
    actions: fit(L.inputs[6], [{ op: 'click', target: 'add-note-submit', ms: 600 }]),
  },

  // 2. Ghost rooms
  {
    id: 'rooms-1',
    chapter: 2,
    caption: 'Every note becomes a haunted room.',
    actions: fit(L.rooms[0], [
      { op: 'click', target: 'nav-dashboard', ms: 300 },
      { op: 'store', name: 'loadDemoOnly', ms: 400 },
      { op: 'highlight', target: 'rooms-grid', ms: L.rooms[0] - 700 },
    ]),
  },
  {
    id: 'rooms-2',
    chapter: 2,
    caption: 'Each flashcard you have not mastered is a ghost,',
    actions: fit(L.rooms[1], [{ op: 'highlight', target: 'ghost-banshee', ms: L.rooms[1] }]),
  },
  {
    id: 'rooms-3',
    chapter: 2,
    caption: 'and the weaker your memory of it, the more menacing it looks.',
    actions: fit(L.rooms[2], ghostWalk(L.rooms[2])),
  },
  {
    id: 'rooms-4',
    chapter: 2,
    caption: 'The meter at the top shows how crowded your haunting is.',
    actions: fit(L.rooms[3], [{ op: 'highlight', target: 'haunt-meter', ms: L.rooms[3] }]),
  },

  // 3. The quiz (a three-card room, so the round ends in time for "review only the cards you missed")
  {
    id: 'quiz-1',
    chapter: 3,
    caption: 'Start a quiz and fill in each blank.',
    actions: fit(L.quiz[0], [
      { op: 'highlight', target: QUIZ_ROOM_TARGET, ms: 900 },
      { op: 'click', target: QUIZ_ROOM_TARGET, ms: 600 },
    ]),
  },
  {
    id: 'quiz-2',
    chapter: 3,
    caption: 'Stuck? Ask for a hint, or reveal the answer.',
    actions: fit(L.quiz[1], [
      { op: 'wait', ms: 550 },
      { op: 'click', target: 'quiz-hint', ms: 700 },
      { op: 'click', target: 'quiz-hint', ms: 700 },
      { op: 'click', target: 'quiz-reveal', ms: 800 },
      { op: 'click', target: 'quiz-submit', ms: 600 },
    ]),
  },
  {
    id: 'quiz-3',
    chapter: 3,
    caption: 'A wrong answer breaks your quiz streak and sends the ghost',
    actions: fit(L.quiz[2], [
      { op: 'type', target: 'quiz-input', text: 'not sure', ms: 1200 },
      { op: 'click', target: 'quiz-submit', ms: 600 },
    ]),
  },
  {
    id: 'quiz-4',
    chapter: 3,
    caption: 'back to the start of its review ladder.',
    actions: fit(L.quiz[3], [
      { op: 'wait', ms: 1700 },
      { op: 'click', target: 'quiz-submit', ms: 800 },
    ]),
  },
  {
    id: 'quiz-5',
    chapter: 3,
    caption: 'A right answer banishes it. Small typos on long words are forgiven,',
    actions: fit(L.quiz[4], [
      { op: 'typeAnswerTypo', target: 'quiz-input', ms: 1100 },
      { op: 'click', target: 'quiz-submit', ms: 500 },
    ]),
  },
  {
    id: 'quiz-6',
    chapter: 3,
    caption: 'and the answer is never hidden in the page before you respond.',
    actions: fit(L.quiz[5], [{ op: 'highlight', target: 'quiz-results', ms: L.quiz[5] }]),
  },
  {
    id: 'quiz-7',
    chapter: 3,
    caption: 'When the round ends, review only the cards you missed.',
    actions: fit(L.quiz[6], [
      { op: 'highlight', target: 'review-missed', ms: 1300 },
      { op: 'click', target: 'review-missed', ms: 900 },
      { op: 'typeAnswer', target: 'quiz-input', ms: 1100 },
      { op: 'click', target: 'quiz-submit', ms: 500 },
      { op: 'wait', ms: 1000 },
      { op: 'typeAnswer', target: 'quiz-input', ms: 1100 },
      { op: 'click', target: 'quiz-submit', ms: 500 },
    ]),
  },

  // 4. Spaced repetition
  {
    id: 'srs-1',
    chapter: 4,
    caption: 'Banished ghosts do not stay gone.',
    actions: fit(L.srs[0], [
      { op: 'click', target: 'nav-dashboard', ms: 500 },
      { op: 'highlight', target: 'next-return', ms: L.srs[0] - 500 },
    ]),
  },
  {
    id: 'srs-2',
    chapter: 4,
    caption: 'A review ladder brings each one back after two days,',
    actions: fit(L.srs[1], [{ op: 'highlight', target: 'next-return', ms: L.srs[1] }]),
  },
  {
    id: 'srs-3',
    chapter: 4,
    caption: 'then three, five, and seven.',
    actions: fit(L.srs[2], [{ op: 'highlight', target: 'ladder', ms: L.srs[2] }]),
  },
  {
    id: 'srs-4',
    chapter: 4,
    caption: 'Jump ahead, and the ghosts that are due return, glowing orange.',
    sample: SAMPLE_TIME_LABEL,
    actions: fit(L.srs[3], [
      { op: 'wait', ms: 400 },
      { op: 'store', name: 'timeTravelDay', times: 2, ms: 700 },
      { op: 'highlight', target: 'returned-ghost', ms: L.srs[3] - 1100 },
    ]),
  },
  {
    id: 'srs-5',
    chapter: 4,
    caption: 'Ignore them longer, and they look stronger.',
    sample: SAMPLE_TIME_LABEL,
    actions: fit(L.srs[4], [
      { op: 'store', name: 'timeTravelDay', times: 5, ms: 600 },
      { op: 'highlight', target: 'returned-ghost', ms: L.srs[4] - 600 },
    ]),
  },

  // 5. Study insights
  {
    id: 'insights-1',
    chapter: 5,
    caption: 'Your study insights show your day streak,',
    actions: fit(L.insights[0], [{ op: 'highlight', target: 'insights-stats', ms: L.insights[0] }]),
  },
  {
    id: 'insights-2',
    chapter: 5,
    caption: 'what you reviewed today, your accuracy this week,',
    actions: fit(L.insights[1], [{ op: 'highlight', target: 'insights-stats', ms: L.insights[1] }]),
  },
  {
    id: 'insights-3',
    chapter: 5,
    caption: 'and your weakest rooms.',
    actions: fit(L.insights[2], [{ op: 'highlight', target: 'insights-weak', ms: L.insights[2] }]),
  },

  // 6. Your data stays yours
  {
    id: 'data-1',
    chapter: 6,
    caption: 'Your notes live in your browser.',
    actions: fit(L.data[0], [{ op: 'highlight', target: 'privacy-line', ms: L.data[0] }]),
  },
  {
    id: 'data-2',
    chapter: 6,
    caption: 'Export a backup any time, and import it back',
    actions: fit(L.data[1], [
      { op: 'highlight', target: 'backup-export', ms: 1100 },
      { op: 'highlight', target: 'backup-import', ms: L.data[1] - 1100 },
    ]),
  },
  {
    id: 'data-3',
    chapter: 6,
    caption: 'with a safety check before anything is merged.',
    actions: fit(L.data[2], [{ op: 'highlight', target: 'backup-import', ms: L.data[2] }]),
  },

  // 7. Built with Kiro (facts from docs/KIRO_EVIDENCE.md)
  {
    id: 'kiro-1',
    chapter: 7,
    caption: 'Haunted Notes was built with Kiro, using specs, steering files, hooks,',
    card: KIRO_CARDS[0],
    actions: fit(L.kiro[0], []),
  },
  {
    id: 'kiro-2',
    chapter: 7,
    caption: 'a custom UI reviewer agent, a Playwright MCP server,',
    card: KIRO_CARDS[1],
    actions: fit(L.kiro[1], []),
  },
  {
    id: 'kiro-3',
    chapter: 7,
    caption: 'and property-based tests that caught real bugs.',
    card: KIRO_CARDS[2],
    actions: fit(L.kiro[2], []),
  },

  // 8. End card
  {
    id: 'end-1',
    chapter: 8,
    caption: 'Try it yourself. The live link and the source code are below.',
    actions: fit(L.end[0], [
      { op: 'store', name: 'emptyState', ms: 500 },
      { op: 'highlight', target: 'try-demo', ms: L.end[0] - 500 },
    ]),
  },
  {
    id: 'end-2',
    chapter: 8,
    caption: 'Built for Kiroween 2026, in the Frankenstein category.',
    // The last three seconds are a hold: the clip is longer than the six seconds of content.
    actions: fit(L.end[1], [
      { op: 'highlight', target: 'try-demo', ms: L.end[1] - END_HOLD_MS },
      { op: 'wait', ms: END_HOLD_MS },
    ]),
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
