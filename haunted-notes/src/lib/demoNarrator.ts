/**
 * src/lib/demoNarrator.ts
 *
 * Controls the one audio element that plays the narration of "Run demo". Pure
 * logic over an injected `AudioLike`: no React, Zustand or DOM, and no clock
 * (every time is passed in as script milliseconds).
 *
 * One element is reused for all nine clips, so two clips can never play at once.
 * After every event `reconcile` decides what the element should be doing:
 *   should play  = sound on, run not paused, a chapter is current
 *   not loaded   -> load the clip and start it at the right offset
 *   paused by us -> resume it (a finished clip is never restarted)
 *   should not   -> pause it, and release it when sound is off
 * A clip that cannot load or play reports "unavailable" once and the run goes on.
 */

/** The small part of HTMLAudioElement the narrator uses. */
export interface AudioLike {
  src: string;
  currentTime: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
}

export interface NarratorOptions {
  audio: AudioLike;
  /** Same-origin source of the clip for a chapter index. */
  srcFor: (chapter: number) => string;
  /** Start with sound on. */
  sound: boolean;
  /** Called at most once per narrator when a clip cannot load or play. */
  onUnavailable: () => void;
}

export interface Narrator {
  /** A chapter began; its clip starts now. `startMs` is its scheduled start, `nowMs` the script clock. */
  chapterStarted(chapter: number, startMs: number, nowMs: number): void;
  pause(nowMs: number): void;
  resume(nowMs: number): void;
  setSound(on: boolean, nowMs: number): void;
  /** Stop, reset and release the audio. Later calls do nothing. */
  stop(): void;
}

/** Starting less than this far into a chapter plays the clip from its very beginning. */
export const SEEK_THRESHOLD_MS = 300;

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

export function createNarrator(options: NarratorOptions): Narrator {
  const { audio, srcFor, onUnavailable } = options;
  let sound = options.sound;
  let runPaused = false;
  let current: { chapter: number; startMs: number } | null = null;
  /** Chapter whose clip is in the element, or null. */
  let loaded: number | null = null;
  /** The narrator paused a playing clip because the run paused. */
  let pausedByUs = false;
  let reported = false;
  let stopped = false;
  /** Bumped whenever a clip is replaced or released, so late play() results are ignored. */
  let token = 0;

  function fail(): void {
    if (reported) return;
    reported = true;
    try {
      onUnavailable();
    } catch {
      /* the callback must never break the run */
    }
  }

  function safe(fn: () => void): void {
    try {
      fn();
    } catch {
      /* an audio call must never break the run */
    }
  }

  function unload(): void {
    token++;
    safe(() => audio.pause());
    safe(() => {
      audio.currentTime = 0;
    });
    safe(() => audio.removeAttribute('src'));
    safe(() => audio.load());
    loaded = null;
    pausedByUs = false;
  }

  function playNow(my: number): void {
    let result: Promise<void>;
    try {
      result = audio.play();
    } catch {
      loaded = null;
      fail();
      return;
    }
    result.then(undefined, (err: unknown) => {
      if (my !== token || isAbort(err)) return; // replaced or interrupted: not a failure
      loaded = null;
      fail();
    });
  }

  function startClip(chapter: number, offsetMs: number): void {
    const my = ++token;
    pausedByUs = false;
    try {
      audio.pause(); // never two clips at once
      audio.src = srcFor(chapter);
      if (offsetMs >= SEEK_THRESHOLD_MS) audio.currentTime = offsetMs / 1000;
      loaded = chapter;
    } catch {
      loaded = null;
      fail();
      return;
    }
    playNow(my);
  }

  function reconcile(nowMs: number): void {
    if (stopped) return;
    if (sound && !runPaused && current !== null) {
      if (loaded !== current.chapter) {
        startClip(current.chapter, nowMs - current.startMs);
      } else if (pausedByUs && audio.paused && !audio.ended) {
        pausedByUs = false;
        playNow(token);
      }
      return;
    }
    if (!audio.paused && !audio.ended) {
      safe(() => audio.pause());
      pausedByUs = sound && current !== null;
    }
    if (!sound && (loaded !== null || !audio.paused)) unload();
  }

  return {
    chapterStarted(chapter, startMs, nowMs) {
      if (stopped) return;
      current = { chapter, startMs };
      reconcile(nowMs);
    },
    pause(nowMs) {
      if (stopped) return;
      runPaused = true;
      reconcile(nowMs);
    },
    resume(nowMs) {
      if (stopped) return;
      runPaused = false;
      reconcile(nowMs);
    },
    setSound(on, nowMs) {
      if (stopped) return;
      sound = on;
      reconcile(nowMs);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      current = null;
      unload();
    },
  };
}
