/**
 * src/demo/runner.ts
 *
 * Plays the "Run demo" script on the real app and keeps the user's data safe.
 *
 * Time: the script keeps an absolute schedule. Action n ends at the sum of the
 * durations before it, so a slow lookup shortens the next wait instead of
 * delaying the run. The clock stops while paused.
 *
 * Data: the snapshot is held in memory and in its own localStorage key. Whatever
 * happens (finish, Stop, Escape, a missing element, a thrown error) the `finally`
 * block puts it back and deletes the key.
 */

import { useStore } from '../store/useStore';
import { clearSnapshot, takeSnapshot, writeSnapshot } from '../lib/demoSnapshot';
import { emptyReviewLog } from '../lib/reviewLog';
import { createNarrator, type Narrator } from '../lib/demoNarrator';
import { narrationSrc } from '../lib/demoNarration';
import { typoOf } from '../lib/demoTypo';
import { normalizeBlanks } from '../lib/blank';
import {
  DEMO_STEPS,
  scriptTotalMs,
  type DemoAction,
  type DemoCardText,
  type DemoStoreAction,
} from '../lib/demoScript';
import {
  DemoAbort,
  DemoMissingTarget,
  clearHighlights,
  findTarget,
  focusMain,
  highlight,
  isField,
  reveal,
  setFieldValue,
} from './domActions';

// ── Observable state for the UI ──────────────────────────────────────────────

export type DemoStatus = 'idle' | 'running' | 'paused';

export interface DemoRunState {
  status: DemoStatus;
  stepIndex: number;
  chapter: number;
  caption: string;
  card: DemoCardText | null;
  /** Script time played so far, in ms (stops while paused). */
  elapsedMs: number;
  /** Length of the script at normal speed, in ms. */
  totalMs: number;
  /** Narration sound on (kept in memory only; it survives from one run to the next). */
  sound: boolean;
  /** A narration clip could not load or play; the run goes on with captions only. */
  narration: 'ok' | 'unavailable';
  /** Set while the screen holds sample data or a simulated clock jump; the bar says so. */
  sample: string | null;
}

const IDLE: DemoRunState = {
  status: 'idle',
  stepIndex: 0,
  chapter: 0,
  caption: '',
  card: null,
  elapsedMs: 0,
  totalMs: scriptTotalMs(),
  sound: true,
  narration: 'ok',
  sample: null,
};

let state: DemoRunState = IDLE;
const listeners = new Set<() => void>();

function publish(patch: Partial<DemoRunState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function getRunState(): DemoRunState {
  return state;
}

export function isRunning(): boolean {
  return state.status !== 'idle';
}

// ── Narration ────────────────────────────────────────────────────────────────

/** `?demo=1` starts a run; `?sound=0` asks for it to be silent. Safe where there is no window. */
export function demoUrlParams(): { demo: boolean; silent: boolean } {
  try {
    const p = new URLSearchParams(window.location.search);
    return { demo: p.get('demo') === '1', silent: p.get('sound') === '0' };
  } catch {
    return { demo: false, silent: false };
  }
}

/** Sound preference. Null until the first run, then kept in memory only (never stored). */
let soundOn: boolean | null = null;
/** The narrator for the run in progress. */
let narrator: Narrator | null = null;
/** The one audio element of the run in progress, kept so the run can wait for the first sound. */
let narrationAudio: HTMLAudioElement | null = null;

/** The longest the run waits for the first clip to start making sound. */
export const FIRST_SOUND_WAIT_MS = 1500;

function currentSound(): boolean {
  if (soundOn === null) soundOn = !demoUrlParams().silent;
  return soundOn;
}

/** Create the one audio element for this run. A failure here only means no narration. */
function createRunNarrator(sound: boolean): Narrator | null {
  try {
    const audio = new Audio();
    audio.preload = 'auto';
    narrationAudio = audio;
    return createNarrator({
      audio,
      srcFor: narrationSrc,
      sound,
      onUnavailable: () => publish({ narration: 'unavailable' }),
    });
  } catch {
    publish({ narration: 'unavailable' });
    return null;
  }
}

/**
 * Resolve when the narration audio is playing, or when it fails, or after ms.
 * The first sound in a page can start a second after play() is called, because the
 * browser has to open the audio output. Waiting for it keeps the first captions in step
 * with the speech whatever the device. Resolves at once if there is nothing to wait for.
 */
function waitForFirstSound(ms: number): Promise<void> {
  const audio = narrationAudio;
  if (!audio || (!audio.paused && audio.currentTime > 0)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      audio.removeEventListener('playing', done);
      audio.removeEventListener('error', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    audio.addEventListener('playing', done);
    audio.addEventListener('error', done);
  });
}

// ── Clock and waiting ────────────────────────────────────────────────────────

const TICK_MS = 25;
const PUBLISH_EVERY_MS = 100;

let active = 0; // script ms played
let aborted = false;
let paused = false;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkAbort(): void {
  if (aborted) throw new DemoAbort();
}

/** Resolve once the script clock reaches `target`. Throws DemoAbort on Stop. */
async function sleepUntil(target: number): Promise<void> {
  while (active < target) {
    checkAbort();
    await wait(TICK_MS);
  }
  checkAbort();
}

/** Wait (real time, up to `timeoutMs`) for an element to appear. */
async function waitForTarget(name: string, timeoutMs = 4000): Promise<HTMLElement> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    checkAbort();
    const el = findTarget(name);
    if (el) return el;
    if (performance.now() > deadline) throw new DemoMissingTarget(name);
    await wait(30);
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** Share of an action's time spent typing; the rest is a pause to read. */
const TYPING_SHARE = 0.85;

function runStoreAction(name: DemoStoreAction, times = 1): void {
  const s = useStore.getState();
  switch (name) {
    case 'emptyState':
      useStore.setState({
        notes: [],
        flashcards: [],
        reviewLog: emptyReviewLog(),
        isDemoLoaded: false,
        currentView: 'dashboard',
        quizNoteId: null,
        quizDueOnly: false,
      });
      return;
    case 'loadDemoOnly':
      // Replace the sample note with exactly the built-in demo data.
      useStore.setState({
        notes: [],
        flashcards: [],
        reviewLog: emptyReviewLog(),
        isDemoLoaded: false,
        currentView: 'dashboard',
        quizNoteId: null,
        quizDueOnly: false,
      });
      useStore.getState().loadDemoData();
      return;
    case 'timeTravelDay':
      for (let i = 0; i < times; i++) s.timeTravelDay();
      return;
  }
}

/** The answer of the card on screen, found by its prompt. Read from the store only. */
function currentAnswer(): string {
  const prompt = findTarget('quiz-prompt')?.textContent ?? '';
  const card = useStore
    .getState()
    .flashcards.find((c) => prompt.endsWith(normalizeBlanks(c.prompt)));
  if (!card) throw new DemoMissingTarget('quiz card (no card matches the prompt on screen)');
  return card.clozeWord;
}

async function typeInto(name: string, text: string, start: number, ms: number): Promise<void> {
  const el = await waitForTarget(name);
  reveal(el);
  if (!isField(el)) throw new DemoMissingTarget(`${name} (not a text field)`);
  const n = text.length;
  for (let i = 1; i <= n; i++) {
    await sleepUntil(start + (i / n) * ms * TYPING_SHARE);
    // The field may have been re-rendered; look it up again each character.
    const field = findTarget(name);
    if (!field || !isField(field)) throw new DemoMissingTarget(name);
    setFieldValue(field, text.slice(0, i));
  }
}

async function runAction(action: DemoAction, start: number): Promise<void> {
  switch (action.op) {
    case 'wait':
      return;
    case 'click':
      {
        const el = await waitForTarget(action.target);
        reveal(el);
        el.click();
      }
      return;
    case 'type':
      await typeInto(action.target, action.text, start, action.ms);
      return;
    case 'typeAnswer':
      await typeInto(action.target, currentAnswer(), start, action.ms);
      return;
    case 'typeAnswerTypo':
      // One wrong letter, but only on an answer long enough for the quiz to forgive it.
      await typeInto(action.target, typoOf(currentAnswer()), start, action.ms);
      return;
    case 'clear': {
      const el = await waitForTarget(action.target);
      if (isField(el)) setFieldValue(el, '');
      return;
    }
    case 'highlight':
      highlight(await waitForTarget(action.target));
      return;
    case 'clearHighlights':
      clearHighlights();
      return;
    case 'store':
      runStoreAction(action.name, action.times);
      return;
  }
}

async function play(): Promise<void> {
  let cursor = 0;
  let chapter = -1;
  for (let i = 0; i < DEMO_STEPS.length; i++) {
    const step = DEMO_STEPS[i];
    publish({
      stepIndex: i,
      chapter: step.chapter,
      caption: step.caption,
      card: step.card ?? null,
      sample: step.sample ?? null,
    });
    if (step.chapter !== chapter) {
      // The clip starts at the chapter's scheduled start. For the first chapter this runs
      // before any await, so the first play() is still inside the user's click.
      chapter = step.chapter;
      narrator?.chapterStarted(chapter, cursor, active);
    }
    for (const action of step.actions) {
      await runAction(action, cursor);
      cursor += action.ms;
      await sleepUntil(cursor);
    }
    clearHighlights();
  }
}

// ── Public controls ──────────────────────────────────────────────────────────

/** Start a run. options.sound overrides the remembered preference (used by the Start with sound button). */
export async function startDemo(options: { sound?: boolean } = {}): Promise<void> {
  if (isRunning()) return;
  aborted = false;
  paused = false;
  active = 0;
  if (options.sound !== undefined) soundOn = options.sound;

  const snapshot = takeSnapshot(useStore.getState());
  if (!writeSnapshot(window.localStorage, snapshot)) {
    // Saves are suspended during the run, so the real data stays in the saved store.
    console.warn('Haunted Notes demo: could not save the recovery snapshot');
  }
  useStore.getState().beginDemoRun();
  publish({ ...IDLE, status: 'running', totalMs: scriptTotalMs(), sound: currentSound() });
  narrator = createRunNarrator(currentSound());
  // The right and wrong answer sounds follow the same Sound button as the narration.
  useStore.getState().setDemoSound(currentSound());

  // Start the first clip now, inside the click, and hold the script clock until its sound
  // really starts. Chapters 2 to 9 start their clips on the clock and are only ~0.1 s late.
  if (narrator && currentSound()) {
    narrator.chapterStarted(0, 0, 0);
    await waitForFirstSound(FIRST_SOUND_WAIT_MS);
  }

  let lastTick = performance.now();
  let lastPublish = 0;
  const clock = setInterval(() => {
    const now = performance.now();
    if (!paused) active += now - lastTick;
    lastTick = now;
    if (active - lastPublish >= PUBLISH_EVERY_MS) {
      lastPublish = active;
      publish({ elapsedMs: Math.min(active, state.totalMs) });
    }
  }, TICK_MS);

  try {
    await play();
  } catch (err) {
    if (!(err instanceof DemoAbort)) {
      console.warn('Haunted Notes demo stopped early:', err);
    }
  } finally {
    clearInterval(clock);
    clearHighlights();
    // Stop, reset and release the audio first, then give the user's data back.
    try {
      narrator?.stop();
    } catch (err) {
      console.warn('Haunted Notes demo: could not stop the narration', err);
    }
    narrator = null;
    narrationAudio = null;
    try {
      useStore.getState().endDemoRun(snapshot);
    } catch (err) {
      console.warn('Haunted Notes demo: restore failed', err);
    }
    clearSnapshot(window.localStorage);
    publish({ ...IDLE, sound: currentSound() });
    requestAnimationFrame(focusMain);
  }
}

export function stopDemo(): void {
  if (!isRunning()) return;
  aborted = true;
}

export function togglePause(): void {
  if (!isRunning()) return;
  paused = !paused;
  if (paused) narrator?.pause(active);
  else narrator?.resume(active);
  publish({ status: paused ? 'paused' : 'running' });
}

/** Sound on or off. Turning it on mid-run starts the current clip at the right second. */
export function toggleSound(): void {
  soundOn = !currentSound();
  narrator?.setSound(soundOn, active);
  useStore.getState().setDemoSound(soundOn);
  publish({ sound: soundOn });
}
