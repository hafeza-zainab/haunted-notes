# Prompt: self-playing "Run demo" for Haunted Notes (replaces the spotlight tour)

Before pasting:
1. `cd C:\dev\kiro` then `git checkout main` then `git pull` then `git checkout -b demo-autoplay`.
2. Open two terminals in `C:\dev\kiro\haunted-notes` and run `npm run dev` in one of them (leave it running). Kiro cannot start servers.
3. Turn on Autopilot in Kiro, open a NEW chat, paste everything inside the code block.

```
RULES: work on the current branch (demo-autoplay) only, commit after each finished part, never push, run lint, tests and build before each commit, never weaken a test, mark anything not run as UNVERIFIED, log everything in KIRO_LOG.md. Specs go only in C:\dev\kiro\.kiro\specs\. Follow all steering files. No new dependencies, no paid services, no new network calls.

GOAL: replace the "60-second tour" spotlight (TourCoach) with a self-playing demo that works like a video. A "Run demo" button starts a script that USES the real app (it clicks the real navigation, types into the real inputs, presses the real Hint, Skip and Reveal buttons, and calls the real store actions), while a caption bar at the bottom explains each step. It must explain the whole product, last about 2 minutes 40 seconds at normal speed (never over 2:50, because I will screen-record it as my YouTube demo, which must be under 3 minutes), and end on its own.

Write the spec first (.kiro/specs/demo-autoplay: requirements, design, tasks), then build it.

LESSONS FROM MY OTHER PROJECT (apply them):
1. Captions must describe exactly what is visible on screen. Never claim a step does something it does not. Where a step is shown with sample data, say "sample" in the caption.
2. Never depend on today's date or on positional selectors. Add data-demo="..." attributes to every element the script touches, and look elements up by those attributes. If an element is missing, stop cleanly (restore data, close the bar) and log a console warning, never leave the app half-changed.
3. Interrupted runs must not leave data behind. See DATA SAFETY below.
4. Measure the real duration with Playwright and show the true total in the bar, never a guessed number.

WHAT IT RUNS (chapters, each with a short title shown in the bar and a caption of 12 words or fewer, 3 to 5 seconds on screen; times at normal speed):
1. Intro card (6s): "Haunted Notes: your unfinished notes come back to haunt you".
2. Four inputs (about 30s): go to Add Note, type a short sample note into the real textarea one character at a time and add it; show the Live mic tab (caption notes it uses the browser's speech service), the Photo tab (OCR runs on your device) and the Audio file tab (Whisper runs on your device). Do NOT start any real transcription, OCR, model download or file chooser. For the audio and photo tabs, put a clearly labelled SAMPLE transcript into the textarea without calling the engines.
3. Ghost rooms (about 15s): load the built-in demo data, show the dashboard, the five ghost types and the haunt meter.
4. The quiz (about 45s): Start Quiz, use Hint, answer wrong, answer right (banish), use Reveal, Skip, reach the results screen, press Review missed and answer. Read the correct answers from the store in script code only; never put answers in the DOM before answering.
5. Spaced repetition (about 15s): show "Next ghost returns in N days", call the store's timeTravelDay action, show an orange returned ghost.
6. Study insights (about 10s): streak, today count, accuracy, chart.
7. Your data stays yours (about 10s): highlight (do not click) Export and Import, and show the privacy line. Do not trigger a download.
8. Built with Kiro (about 12s): text-only caption cards using facts from docs/KIRO_EVIDENCE.md (specs, steering, hooks, custom agent, MCP, property-based tests). Nothing not in that file.
9. End card (about 6s): "Try it yourself" plus the Try demo button visible.

CONTROLS (bottom bar, always visible during the run): chapter title, caption, elapsed / total time, progress strip, a Pause/Resume button, a Stop button, and the chapter list as small dots. Every button at least 44px, keyboard reachable, label-in-name safe, role="status" aria-live="polite" caption, Escape stops. A transparent shield blocks user clicks on the app while it runs (the script's own programmatic clicks still work). Respect prefers-reduced-motion (instant scrolling, no smooth effects). A "Speed" choice (1x, 1.5x) is optional.

PLACEMENT: replace every 60-second tour button (empty state, Add Note demo box, dashboard summary bar) with "Run demo" (visible text exactly "Run demo", with the play icon aria-hidden). Remove TourCoach, tour.ts and the store's tour state; migrate or delete their tests and say in KIRO_LOG.md exactly which tests were removed and why (feature removed). Update README.md, docs/KIRO_EVIDENCE.md, docs/SUBMISSION_CHECKLIST.md and DEMO_SCRIPT.md wherever they mention the old tour. Note: this app has no login or signup page (no accounts), so the home screen (empty state) and the top of the dashboard are the right places. Also support the URL ?demo=1 to start the run automatically after load, so I can record it without a cursor.

DATA SAFETY (most important):
- On start, snapshot the user's real data (notes, flashcards, reviewLog and the demo flags) in memory AND to a separate localStorage key (haunted-notes-demo-snapshot), then run on a clean state loaded with the built-in demo data.
- On finish, Stop, Escape or an error, restore the snapshot and delete the key, then return focus to the main area.
- On every app load, if the snapshot key exists (tab closed mid-run), restore it first and delete it. Write this as pure functions in src/lib with unit tests and fast-check property tests (restore after any abort point gives exactly the original data; recovery on load is idempotent; corrupt snapshot never throws).
- The run must not create files, open dialogs, download models or call the network.

TESTS: unit tests for the script data (total length at 1x between 140 and 170 seconds, every caption 12 words or fewer, every data-demo target exists in the rendered views), the snapshot and restore functions, and the control bar. Add a source scan test that the script never references fetch, window.open, URL.createObjectURL or the Whisper and Tesseract modules.

VERIFY (the dev server is running at http://localhost:5173; use the Playwright MCP): run the whole demo at 1280px and again at 390px; confirm that every caption matches the screen, that all chapters complete, that the measured total is under 2:50, that data is restored after finish, after Stop and after a reload in the middle, that there are no console errors, and run ghost-ui-reviewer on the control bar. Save screenshots with "demo-autoplay-" in the name in docs/screens/. Report PASS, FAIL or UNVERIFIED for every item in docs/BROWSER_CHECKS.md.
```

## After it finishes
1. Open the app, press Run demo, and watch the whole run once yourself.
2. Record it with OBS or Game Bar (no voice, no face): that recording can be your YouTube video, plus an end card with the live URL.
3. Merge `demo-autoplay` into `main` and push only after you have watched it.
