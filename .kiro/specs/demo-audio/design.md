# Design: narration inside "Run demo"

## Modules
| File | Kind | Role |
|---|---|---|
| `public/demo-audio/manifest.json` | data | `{ version, clips: [{ chapterId, chapter, file, durationMs }] }`, durations measured in Chromium. |
| `src/lib/demoNarration.ts` | pure | `NARRATION_EXT`, `narrationFile(chapter)`, `narrationSrc(chapter)` (always `/demo-audio/chapter-N.wav`), `chapterWindows(steps)`, `fitReport(manifest, steps, marginMs)`. |
| `src/lib/demoNarrator.ts` | pure | `createNarrator({ audio, srcFor, sound, onUnavailable })` over an injected `AudioLike`. All times are passed in. |
| `src/demo/runner.ts` | DOM | Owns the one `Audio` element, the sound flag (memory only), the `narration` state, and calls the narrator at chapter starts, Pause, Resume, Stop and the end. |
| `DemoBar`, `DemoPlayer`, `DemoStartPrompt` | view | Sound button, "Narration unavailable" status, "Start with sound" prompt. |

## Narrator
State: `sound`, `runPaused`, `current` (chapter and its scheduled start), `loaded` (chapter whose clip is in the element), `failedOnce`. One function, `reconcile(nowMs)`, decides what the element should do after every event:
- should play = sound on, run not paused, a chapter is current;
- should play and the current clip is not loaded: set `src`, set `currentTime = (nowMs - chapterStart) / 1000`, `play()`;
- should play, loaded, element paused but not ended: `play()` (resume);
- should not play and element is playing: `pause()`; if sound is off, also unload it.
A play promise that rejects after a newer clip started is ignored (token). Any other failure (`NotSupportedError` for a missing file, `NotAllowedError` for a blocked start, an `error` event) calls `onUnavailable` once per run and leaves the run going.
`stop()`: pause, `currentTime = 0`, remove `src`, `load()`, forget the chapter.

## Accessibility notes from ghost-ui-reviewer
The "Narration unavailable" line is an always-present `<p role="status">`. While empty it is visually hidden and absolutely positioned (so it adds no gap), never `display: none`, so the live region exists before its text appears. The start prompt traps Tab on its one button.

## Autoplay and Safari
One element is reused for all nine clips and the first `play()` runs synchronously inside the click handler (the first chapter starts before the runner's first `await`). Later `play()` calls on the same element are allowed after that. The sound toggle also calls `play()` from its own click.

## Fit and the hold
`fitReport` returns, per chapter, start, length, clip, headroom and `fits` (clip <= length - 0.4 s). The measured clips: chapters 1 to 8 fit; chapter 9 (End) is 7.04 s in a 6.0 s chapter, so it needs a hold. The first sound in a page also started 0.5 to 0.8 s after `play()` in Chromium, so a second rule was added: every clip keeps `FIT_MARGIN_MS` (0.4 s) plus `START_ALLOWANCE_MS` (1 s) of headroom. That gave the intro a 1 s hold (`INTRO_HOLD_MS`) and the end card a 3 s hold (`END_HOLD_MS`). Total goes from 162.6 s to 166.6 s (2:46.6), under the 2:55 limit.

## Correctness properties
1. At most one clip plays at any time, for any event sequence.
2. A started clip begins at offset 0 at its chapter's scheduled start; a late sound-on starts at the exact offset into the chapter.
3. Pause then Resume plays the same clip and never restarts a finished one.
4. After `stop()` nothing plays and no source is held.
5. Any play or load failure leaves the narrator usable and reports unavailable once.
6. Manifest chapter ids, count and order equal the script's; every file exists; every clip fits.