# Requirements: self-playing "Run demo"

## Introduction
The 60-second spotlight tour (TourCoach) is replaced by a self-playing demo that works like a video. A script drives the real app (real navigation, real inputs, real Hint, Skip and Reveal buttons, real store actions) while a caption bar explains each step. The run lasts about 2 minutes 40 seconds at 1x (never over 2:50), ends by itself and leaves the user's data exactly as it was.

Glossary: **run** = one play of the script. **script** = the ordered chapters and steps in `src/lib/demoScript.ts`. **snapshot** = a copy of the user's notes, flashcards, review log and demo flags taken when a run starts. **bar** = the fixed bottom control bar. **shield** = the transparent layer that blocks user clicks while a run is active.

## Requirements

### R1 Start
1. A button with the visible text exactly "Run demo" (play icon `aria-hidden`) replaces every 60-second tour button: empty state, Add Note demo box, dashboard summary bar.
2. `?demo=1` in the URL starts a run automatically after load.
3. A second start while a run is active does nothing.

### R2 Script content
1. Nine chapters in this order: Intro, Four inputs, Ghost rooms, The quiz, Spaced repetition, Study insights, Your data stays yours, Built with Kiro, End card.
2. Every caption is 12 words or fewer. Where a step shows sample data, the caption says "sample".
3. Total length at 1x is between 140 and 170 seconds (target about 160). The measured wall-clock total must stay under 170 seconds.
4. Captions describe only what is on screen at that moment. The Built with Kiro captions use only facts from `docs/KIRO_EVIDENCE.md`.
5. Quiz answers are read from the store inside script code. They are never written to the DOM before the answer is submitted.

### R3 Real app, no side effects
1. The script reaches elements only through `data-demo="..."` attributes, never through position or text.
2. It does not start transcription, OCR, a model download, a file chooser, a file download or any network call. The source of the script and the runner never reference `fetch`, `window.open`, `URL.createObjectURL`, or the Whisper and Tesseract modules.
3. The Photo tab does not load the OCR engine while a run is active. Photo and Audio show a text labelled SAMPLE put into the textarea.
4. If a target element is missing, the run stops cleanly: data restored, bar closed, a `console.warn` logged.

### R4 Controls
1. The bar is visible for the whole run and holds: chapter title, caption (`role="status"`, `aria-live="polite"`), elapsed / total time, progress strip, Pause/Resume, Stop, Speed (1x or 1.5x) and one dot per chapter.
2. Every button is at least 44px high and wide, keyboard reachable, and its accessible name contains its visible text.
3. Escape stops the run.
4. The shield blocks user pointer and keyboard input on the app. The script's own programmatic clicks still work.
5. With `prefers-reduced-motion: reduce` the script scrolls instantly and no smooth effects play.
6. The total shown is computed from the script (`total / speed`), never a typed-in number.

### R5 Data safety
1. On start the snapshot is held in memory and written to localStorage key `haunted-notes-demo-snapshot`. The run then starts on an empty state.
2. While a run is active the persisted store key is not written, so a closed tab cannot overwrite real data with demo data.
3. On finish, Stop, Escape or an error, the snapshot is restored exactly, the key is deleted and focus returns to the main region.
4. On every app load, a leftover snapshot key is restored first and deleted. Recovery twice gives the same result as once. A corrupt snapshot never throws; it is deleted.

### R6 Removal of the old tour
`TourCoach`, `src/lib/tour.ts`, the store's tour state and their tests are removed. README, KIRO_EVIDENCE, SUBMISSION_CHECKLIST and DEMO_SCRIPT no longer describe the tour.

### R7 Quality
`npm run lint`, `npm test` and `npm run build` pass. No new dependency, no new network call. The whole run is checked in a browser at 1280px and 390px.
