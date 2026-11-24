/**
 * src/lib/demoNarration.ts
 *
 * Pure helpers for the narration clips of "Run demo": where each clip lives, when
 * each chapter starts, and whether each clip fits its chapter. No React, Zustand
 * or DOM. The only source a clip can have is a same-origin /demo-audio/ path.
 */

import { CHAPTER_IDS, stepMs, type DemoStep } from './demoScript';

/** Extension of the clip files in public/demo-audio. All nine use the same one. */
export const NARRATION_EXT = 'wav';

/** A clip must end at least this long before its chapter ends. */
export const FIT_MARGIN_MS = 400;

/**
 * Room a clip needs on top of FIT_MARGIN_MS for the browser to start its audio output.
 * Measured in Chromium: the first clip started sound 0.80 s after play(), a clip after a
 * 27 s silence 0.54 s, the rest 0.10 to 0.16 s. The data test uses this for every clip.
 */
export const START_ALLOWANCE_MS = 1000;

/** The whole run, with narration, must stay under this length (2:55). */
export const MAX_TOTAL_MS = 175_000;

/** File name of the clip for a chapter index (0 based): chapter-1.wav for index 0. */
export function narrationFile(chapter: number): string {
  // Clamp to the nine real chapters: any other input (NaN, negative, 1e21) still gives a real file name.
  const i = Number.isFinite(chapter) ? Math.min(CHAPTER_IDS.length - 1, Math.max(0, Math.floor(chapter))) : 0;
  return `chapter-${i + 1}.${NARRATION_EXT}`;
}

/** Same-origin URL path of the clip for a chapter index. Never an absolute or external URL. */
export function narrationSrc(chapter: number): string {
  return `/demo-audio/${narrationFile(chapter)}`;
}

export interface ManifestClip {
  chapterId: string;
  chapter: number;
  file: string;
  durationMs: number;
}

export interface NarrationManifest {
  version: number;
  clips: ManifestClip[];
}

export interface ChapterWindow {
  chapter: number;
  /** Scheduled start of the chapter in script time. */
  startMs: number;
  /** Length of the chapter: the sum of its steps. */
  lengthMs: number;
}

/** Start and length of every chapter that has steps, in order. */
export function chapterWindows(steps: readonly DemoStep[]): ChapterWindow[] {
  const out: ChapterWindow[] = [];
  let t = 0;
  for (const step of steps) {
    const d = stepMs(step);
    const last = out[out.length - 1];
    if (last && last.chapter === step.chapter) {
      last.lengthMs += d;
    } else {
      out.push({ chapter: step.chapter, startMs: t, lengthMs: d });
    }
    t += d;
  }
  return out;
}

export interface FitRow {
  chapter: number;
  chapterId: string;
  startMs: number;
  lengthMs: number;
  clipMs: number;
  /** lengthMs - clipMs. */
  headroomMs: number;
  /** clipMs <= lengthMs - marginMs. */
  fits: boolean;
}

/**
 * One row per chapter: does the clip end `marginMs` before the chapter does?
 * A chapter with no clip in the manifest reports a clip of 0 ms. Never throws.
 */
export function fitReport(
  manifest: NarrationManifest,
  steps: readonly DemoStep[],
  marginMs: number = FIT_MARGIN_MS,
): FitRow[] {
  const byChapter = new Map(manifest.clips.map((c) => [c.chapter - 1, c]));
  return chapterWindows(steps).map((w) => {
    const clipMs = byChapter.get(w.chapter)?.durationMs ?? 0;
    return {
      chapter: w.chapter,
      chapterId: CHAPTER_IDS[w.chapter] ?? `chapter-${w.chapter + 1}`,
      startMs: w.startMs,
      lengthMs: w.lengthMs,
      clipMs,
      headroomMs: w.lengthMs - clipMs,
      fits: clipMs <= w.lengthMs - marginMs,
    };
  });
}
