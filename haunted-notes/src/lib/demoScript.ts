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
  /** Put `text` into the field at once (an instant paste), then hold for the rest of `ms`. */
  | { op: 'fill'; target: string; text: string; ms: number }
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

/**
 * The actions, made to last exactly `len` ms. Throws if they are too long.
 *
 * There is no silent padding: a step that has time left makes its last highlight, click or
 * fill last longer, so the screen keeps showing what it shows. A wait is added only to a
 * step that has no actions at all, and such a step shows a text card.
 */
function fit(len: number, actions: DemoAction[]): DemoAction[] {
  const used = actions.reduce((sum, a) => sum + a.ms, 0);
  if (used > len) throw new Error(`demo step needs ${used} ms but has ${len} ms`);
  if (used === len) return actions;
  const rest = len - used;
  const last = actions[actions.length - 1];
  if (last && (last.op === 'highlight' || last.op === 'click' || last.op === 'fill')) {
    return [...actions.slice(0, -1), { ...last, ms: last.ms + rest }];
  }
  return [...actions, { op: 'wait', ms: rest }];
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
 * Chapter-relative start of every step, in ms, and the chapter's end. A start is the cue time
 * of its subtitle in the clip plus about 100 ms (the first step starts at 0). A chapter ends
 * 1.4 s after its clip does (0.4 s margin plus 1 s for the sound to start), unless its actions
 * need longer (the quiz and the spaced repetition chapters). Cues: public/demo-audio/manifest.json.
 */
const T = {
  intro: { starts: [0, 1950, 3550, 7350, 9600, 12250], end: 15300 },
  inputs: { starts: [0, 2000, 4300, 8200, 11350, 14600, 17500], end: 21700 },
  rooms: { starts: [0, 2400, 5350, 8550], end: 12500 },
  quiz: { starts: [0, 2850, 6200, 8800, 11300, 15700, 18900], end: 25400 },
  srs: { starts: [0, 2500, 5000, 8750, 10800], end: 17600 },
  insights: { starts: [0, 2600, 5750], end: 8200 },
  data: { starts: [0, 2150, 4500], end: 8600 },
  kiro: { starts: [0, 4950, 8750], end: 12600 },
  end: { starts: [0, 1700, 3450, 5500], end: 9400 },
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
  // 0. The problem. No title card: the run starts on the real dashboard, already loaded with the
  // built-in demo data (the runner loads it before the first sound), so the project works from second 0.
  {
    id: 'pitch-1',
    chapter: 0,
    caption: 'Taking notes is easy.',
    actions: fit(L.intro[0], [{ op: 'highlight', target: 'rooms-grid', ms: L.intro[0] }]),
  },
  {
    id: 'pitch-2',
    chapter: 0,
    caption: 'Knowing what to revise,',
    actions: fit(L.intro[1], [{ op: 'highlight', target: 'rooms-grid', ms: L.intro[1] }]),
  },
  {
    id: 'pitch-3',
    chapter: 0,
    caption: 'and when, across many subjects, is the hard part.',
    actions: fit(L.intro[2], [{ op: 'highlight', target: 'rooms-grid', ms: L.intro[2] }]),
  },
  {
    id: 'pitch-4',
    chapter: 0,
    caption: 'Haunted Notes turns your notes into ghosts',
    actions: fit(L.intro[3], [{ op: 'highlight', target: 'ghost-banshee', ms: L.intro[3] }]),
  },
  {
    id: 'pitch-5',
    chapter: 0,
    caption: 'and remembers the revision schedule for you.',
    actions: fit(L.intro[4], [{ op: 'highlight', target: 'ladder', ms: L.intro[4] }]),
  },
  {
    id: 'pitch-6',
    chapter: 0,
    caption: 'You only have to remember the answers.',
    actions: fit(L.intro[5], [{ op: 'highlight', target: 'start-quiz', ms: L.intro[5] }]),
  },

  // 1. Four inputs. The sample texts are filled in at once (not typed live).
  {
    id: 'inputs-1',
    chapter: 1,
    caption: 'Add notes four ways.',
    actions: fit(L.inputs[0], [
      { op: 'click', target: 'nav-add', ms: 700 },
      { op: 'highlight', target: 'stitch-strip', ms: L.inputs[0] - 700 },
    ]),
  },
  {
    id: 'inputs-2',
    chapter: 1,
    caption: 'Type them, speak with your microphone,',
    actions: fit(L.inputs[1], [
      { op: 'highlight', target: 'stitch-strip', ms: 1200 },
      { op: 'click', target: 'tab-mic', ms: L.inputs[1] - 1200 },
    ]),
  },
  {
    id: 'inputs-3',
    chapter: 1,
    caption: 'snap a photo of printed text, or upload an audio recording.',
    sample: SAMPLE_DATA_LABEL,
    actions: fit(L.inputs[2], [
      { op: 'click', target: 'tab-photo', ms: 500 },
      { op: 'fill', target: 'note-text', text: SAMPLE_PHOTO_TEXT, ms: 1300 },
      { op: 'click', target: 'tab-audio', ms: 600 },
      { op: 'fill', target: 'note-text', text: SAMPLE_AUDIO_TEXT, ms: 1500 },
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
      { op: 'fill', target: 'note-text', text: SAMPLE_NOTE, ms: L.inputs[5] - 400 },
    ]),
  },
  {
    id: 'inputs-7',
    chapter: 1,
    caption: 'so even a long lecture becomes a short set of questions.',
    sample: SAMPLE_DATA_LABEL,
    actions: fit(L.inputs[6], [
      { op: 'click', target: 'add-note-submit', ms: 1300 },
      { op: 'highlight', target: 'rooms-grid', ms: L.inputs[6] - 1300 },
    ]),
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
      { op: 'click', target: QUIZ_ROOM_TARGET, ms: L.quiz[0] - 900 },
    ]),
  },
  {
    id: 'quiz-2',
    chapter: 3,
    caption: 'Stuck? Ask for a hint, or reveal the answer.',
    actions: fit(L.quiz[1], [
      { op: 'highlight', target: 'quiz-prompt', ms: 550 },
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
      { op: 'highlight', target: 'quiz-feedback', ms: 1700 },
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
      { op: 'highlight', target: 'quiz-feedback', ms: 1000 },
      { op: 'typeAnswer', target: 'quiz-input', ms: 1100 },
      { op: 'click', target: 'quiz-submit', ms: 600 },
    ]),
  },

  // 4. Spaced repetition. The new narration no longer says "ignore them longer, and they look
  // stronger", so the five-day jump stays as a silent visual at the end of the last step.
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
    caption: 'A fixed ladder brings each one back after',
    actions: fit(L.srs[1], [{ op: 'highlight', target: 'next-return', ms: L.srs[1] }]),
  },
  {
    id: 'srs-3',
    chapter: 4,
    caption: 'two, three, five, then seven days,',
    actions: fit(L.srs[2], [{ op: 'highlight', target: 'ladder', ms: L.srs[2] }]),
  },
  {
    id: 'srs-4',
    chapter: 4,
    caption: 'so you never track dates yourself.',
    actions: fit(L.srs[3], [{ op: 'highlight', target: 'next-return', ms: L.srs[3] }]),
  },
  {
    id: 'srs-5',
    chapter: 4,
    caption: 'Skip ahead, and the ghosts that are due return, glowing orange.',
    sample: SAMPLE_TIME_LABEL,
    actions: fit(L.srs[4], [
      { op: 'highlight', target: 'next-return', ms: 400 },
      { op: 'store', name: 'timeTravelDay', times: 2, ms: 700 },
      { op: 'highlight', target: 'returned-ghost', ms: 2500 },
      { op: 'store', name: 'timeTravelDay', times: 5, ms: 600 },
      { op: 'highlight', target: 'returned-ghost', ms: 2600 },
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

  // 7. Built with Kiro (facts from docs/KIRO_EVIDENCE.md). Text cards: the wait shows a card.
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

  // 8. The close, over the home screen with the Try demo button.
  {
    id: 'end-1',
    chapter: 8,
    caption: 'You remember the answers.',
    actions: fit(L.end[0], [
      { op: 'store', name: 'emptyState', ms: 500 },
      { op: 'highlight', target: 'try-demo', ms: L.end[0] - 500 },
    ]),
  },
  {
    id: 'end-2',
    chapter: 8,
    caption: 'Haunted Notes remembers when.',
    actions: fit(L.end[1], [{ op: 'highlight', target: 'try-demo', ms: L.end[1] }]),
  },
  {
    id: 'end-3',
    chapter: 8,
    caption: 'The link and source code are below.',
    actions: fit(L.end[2], [{ op: 'highlight', target: 'try-demo', ms: L.end[2] }]),
  },
  {
    id: 'end-4',
    chapter: 8,
    caption: 'Kiroween 2026, Frankenstein.',
    actions: fit(L.end[3], [{ op: 'highlight', target: 'try-demo', ms: L.end[3] }]),
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
