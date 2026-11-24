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
}

const IDLE: DemoRunState = {
  status: 'idle',
  stepIndex: 0,
  chapter: 0,
  caption: '',
  card: null,
  elapsedMs: 0,
  totalMs: scriptTotalMs(),
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

function runStoreAction(name: DemoStoreAction): void {
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
      s.timeTravelDay();
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
      runStoreAction(action.name);
      return;
  }
}

async function play(): Promise<void> {
  let cursor = 0;
  for (let i = 0; i < DEMO_STEPS.length; i++) {
    const step = DEMO_STEPS[i];
    publish({ stepIndex: i, chapter: step.chapter, caption: step.caption, card: step.card ?? null });
    for (const action of step.actions) {
      await runAction(action, cursor);
      cursor += action.ms;
      await sleepUntil(cursor);
    }
    clearHighlights();
  }
}

// ── Public controls ──────────────────────────────────────────────────────────

export async function startDemo(): Promise<void> {
  if (isRunning()) return;
  aborted = false;
  paused = false;
  active = 0;

  const snapshot = takeSnapshot(useStore.getState());
  if (!writeSnapshot(window.localStorage, snapshot)) {
    // Saves are suspended during the run, so the real data stays in the saved store.
    console.warn('Haunted Notes demo: could not save the recovery snapshot');
  }
  useStore.getState().beginDemoRun();
  publish({ ...IDLE, status: 'running', totalMs: scriptTotalMs() });

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
    try {
      useStore.getState().endDemoRun(snapshot);
    } catch (err) {
      console.warn('Haunted Notes demo: restore failed', err);
    }
    clearSnapshot(window.localStorage);
    publish({ ...IDLE });
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
  publish({ status: paused ? 'paused' : 'running' });
}
