# Kiro Usage Log — Haunted Notes

Record of each time a spec, hook, or steering file changed the outcome.

---

## Steering

**File:** `.kiro/steering/product.md`  
**Effect:** Always-included context injected into every Kiro session.
- Kept every generated component to single responsibility (small components rule)
- Ensured `prefers-reduced-motion` was added to every animation block
- Ghost colour (`--ghost-fill`, `--ghost-stroke`) derived from the single accent glow rule
- `mobile-first` rule drove the CSS to start with single-column layout and add breakpoints

---

## Spec

**File:** `.kiro/specs/haunted-notes.md`  
**Effect:** Structured requirements → design → tasks.
- Requirements phase locked in cloze-deletion as the flashcard algorithm (no LLM)
- Design phase decided Zustand + persist middleware over useState + manual JSON.stringify
- Tasks list kept implementation in dependency order (types → lib → store → components)

---

## Hooks

### `lint-on-save` (PostFileSave)
**Trigger:** Any `src/**/*.tsx?` file save  
**Effect:** Runs `npm run lint` automatically — caught the unused import of `React` in the first draft of `App.tsx` before a manual review would have.

### `new-component-test` (PostFileCreate)
**Trigger:** New file under `src/components/*.tsx`  
**Effect:** Agent prompt to generate a Vitest + RTL skeleton test — ensures test files keep pace with components without manual prompting.

---

## Notes for submission write-up

- Steering was the highest-leverage file: it silently enforced accessibility and design consistency across all 7 components without any per-component reminder.
- The spec's task list in dependency order meant the store was finished before any view consumed it, avoiding circular-import issues.
- The lint hook caught a type error in `speech.ts` (SpeechRecognition DOM types) during save, which surfaced before the final build step.

---

## Feature: Audio file transcription tab (Whisper)

**Date added:** after initial scaffold

### Changes made
- Added `@huggingface/transformers@3.8.1` dependency
- New `src/workers/whisper.worker.ts` — loads `Xenova/whisper-tiny.en` (q8 quantised, ~40 MB one-time download), decodes Float32Array via ASR pipeline with `chunk_length_s=30`, `stride_length_s=5`
- New `src/lib/useWhisper.ts` — React hook managing worker lifecycle, surfaces `loading_model` (with % progress from `progress_callback`), `transcribing` (indeterminate), `done`, `error` states
- `src/types.ts` — `NoteInputMethod` extended: `'voice'` renamed to `'mic'`, `'audio'` added
- `AddNoteView.tsx` — "Voice" tab renamed to "Live mic"; new "Audio file" tab with file picker, status/progress rows, transcript lands in editable textarea
- `vite.config.ts` — `worker.format: 'es'`, `optimizeDeps.exclude: ['@huggingface/transformers']`, `build.target: 'esnext'`
- `index.css` — refactored `.voice-controls/.photo-controls` into unified `.audio-controls`, replaced `.ocr-progress` with generic `.task-progress`

### Steering update
- `.kiro/steering/product.md` rule updated: network calls are now allowed for the one-time Whisper model download only; all other data stays local.

### Architecture decision
- The worker is lazy-created (first `transcribe()` call) and kept alive across uses so the model stays resident in memory — subsequent transcriptions skip the download/load step entirely.
- `v8.3.6` of `@huggingface/transformers` doesn't expose per-chunk callbacks during `.call()`; transcription progress bar is intentionally indeterminate.

---

## Prompt pack A1: More steering files

**Files:** `.kiro/steering/design.md`, `.kiro/steering/tech.md`, `.kiro/steering/testing.md`
- `design.md` (fileMatch `src/**/*.tsx`, `src/**/*.css`): palette tokens taken from `:root` in `index.css`, spacing scale, ghost animation rules, mandatory `prefers-reduced-motion` override per animation, AA contrast, one accent glow color.
- `tech.md` (always): stack, network limits, lazy-loading rule for Whisper and Tesseract, pure-logic-in-`src/lib` rule.
- `testing.md` (fileMatch `src/lib/**`): vitest unit tests plus fast-check property tests required for every pure function. The runner itself is installed in prompt A3.
- App code untouched.

---

## A4: Banished means banished

- Added `isBanished` (`reps > 0 && dueAt > now`) to `src/lib/srs.ts`. Dashboard counts, room ghost grid, room progress bar and the NavBar badge now use it instead of the old weakness threshold. Spec: R15, Task 13.

## QuizView refactor and lint cleanup

- Replaced the queue/index refs and the `tick` re-render hack in `QuizView.tsx` with `useState` (lazy-initialised queue snapshot plus index state). This removed 15 `react-hooks/refs` lint errors and the root cause of the earlier "Skip does nothing on the last card" bug, since the index is now real state.
- Queue now excludes banished cards. An empty queue shows "No ghosts to review right now".
- Fixed the remaining lint errors with no behavior change: regex escapes and an unused parameter in `cloze.ts`, an unused callback parameter and a set-state-in-effect in `AddNoteView.tsx`.
- `npm run lint` and `npm run build` both pass. Spec: Task 14.

---

## A3: Property-based tests (vitest + fast-check)

- Added `vitest@5.1.0` and `fast-check@4.10.2` as dev dependencies, pinned exactly as `tech.md` requires, plus an `npm test` script (`vitest run`). `testing.md` loads for `src/lib/**` and set the shape of these tests (unit plus property tests, `now` passed explicitly, no real clock).
- `src/lib/srs.test.ts`: interval never decreases over consecutive correct answers; `dueAt` is always after the answer time; ease never below 1.3; a wrong answer always sets reps 0, interval 0 and `dueAt` to now (any starting state); `isDue` false when reps is 0. Histories are generated by actually answering from the defaults, so monotonic properties are checked on states the app can really reach.
- `isBanished` properties: never true when `isDue` is true; always false when reps is 0; for a scheduled card exactly one of `isDue` / `isBanished` holds; a correct answer banishes until `dueAt`, then the ghost returns.
- `cardStatus` (new pure helper in `srs.ts`): for any card exactly one of new / haunting / due / banished holds. `haunting` means reps 0 with `lastReviewed` set (answered wrong), which is the only way to tell it apart from `new`.
- `src/lib/cloze.test.ts`: blank is never a stop-word or a number; prompt never contains the answer; no card from fewer than 8 words; cards start new. `STOP_WORDS` is now exported for the tests.
- Result: 22 tests pass (6 extra runs with fresh seeds all green). `npm run lint` and `npm run build` pass.

### Bugs found by property tests (both in `cloze.ts`, both fixed)

1. **A number could become the blank.** Minimal failing example: `java a a 2020-2024 a java 42 java.` gave the blank `2020-2024`. Cause: the relaxed fallback accepts any 6+ character token that is not purely digits, so `2020-2024`, `123.456` and similar passed. Fix: `isRelaxedTarget` and `isSafeBlank` now reject tokens with no letters.
2. **The prompt could leak the answer.** Minimal failing example: `Java java. - java java 42 java Java.` Cause: `makeClozePrompt` replaced only the first occurrence of the word, so repeats stayed visible. Fix: the replacement is now global.

No bugs were found in `srs.ts`. Note that `scheduleCorrect` can return an interval that does not grow if given an unreachable state (for example reps 2 with interval 0); real answer histories never produce that, so the monotonic properties use generated histories rather than arbitrary values, and no code change was made.

---

## Next ghost returns in N days

- Dashboard summary bar now shows "Next ghost returns in N days" (soonest banished ghost, rounded up, minimum 1 day, hidden when nothing is banished). Logic is two pure functions in `srs.ts` (`nextReturnInMs`, `daysFromMs`) with property tests. Spec: R16, Task 16.

---

## A2: Hooks that really run

Replaced the two original hooks with four, created through Kiro's hook tool so they are valid v1 hook files in `.kiro/hooks/`:

| Hook | Trigger | Does |
|---|---|---|
| `test-on-lib-save` | save `src/lib/**/*.ts` | runs `npm test`, reports failures briefly |
| `lint-fix-on-tsx-save` | save `src/**/*.tsx` | runs `eslint --fix` on the saved file, reports what remains |
| `test-for-new-component` | create `src/components/*.tsx` (not `*.test.tsx`) | writes a render test using vitest and `react-dom/server` |
| `reduced-motion-check-on-css-save` | save `src/**/*.css` | lists animations/transitions with no reduced-motion override, report only |

Why the old ones were replaced:
- Their matchers were over-escaped in JSON (`\\\\.`), so the regex asked for a literal backslash and would not match real paths.
- `lint-on-save` piped to `tail`, which does not exist in PowerShell.
- `new-component-test` asked for React Testing Library, which is not installed (vitest and fast-check only).

New matchers accept both `/` and `\`, and I checked them against sample Windows and POSIX paths (match and non-match cases, including `*.test.tsx`). Prompts are one or two sentences each. Spec: Task 17.

Not verified: that the hooks appear in the Agent Hooks panel and fire. Kiro loads hooks at session start, so that needs a restart or new session and a manual save to confirm.

---

## Hook finding fixed: reduced motion

- The `reduced-motion-check-on-css-save` hook reported motion without a `prefers-reduced-motion` override: about 15 `transition` rules (nav and action buttons, room and ghost cards, quiz input, progress bar width) and `scroll-behavior: smooth` on `html`. The existing override only listed the ghost classes and `.btn-secondary.listening`.
- Fix: one consolidated `@media (prefers-reduced-motion: reduce)` block at the end of `index.css` (universal selector sets `animation: none`, `transition: none`, `scroll-behavior: auto`; `html` set to `auto`). The two earlier reduced-motion blocks are left as they were.
- Re-check: a script confirms the override block is present and covers every rule with motion. Not verified in a real browser with reduced motion switched on; that is part of the B7 pass.

---

## Playwright MCP setup

- Added a workspace MCP config at `.kiro/settings/mcp.json` (server `playwright`), so the agent can drive a real browser against the running app instead of using a separate script.
- Package is pinned: `@playwright/mcp@0.0.85` (run through `cmd /c npx -y` on Windows).
- Runs `--headless` and `--isolated` (fresh profile per session, nothing persisted) with `--browser chromium`.
- Uses the already cached Chromium via `--executable-path` (`ms-playwright/chromium-1248/chrome-win64/chrome.exe`), so no browser download at run time.
- Used for the B7 browser pass: demo quiz flow, `?dev=1` "+1 day", screenshots at 1280px and 390px, and a reduced-motion run.

---

## Custom agent: ghost-ui-reviewer

- **File:** `.kiro/agents/ghost-ui-reviewer.md` (workspace custom agent). Report only: it never edits files.
- **Checks:** reads `.kiro/steering/design.md` first, then checks AA contrast, 44px tap targets at 390px, keyboard access and focus ring, aria labels (label-in-name), reduced motion, and layout and overflow at 390px.
- **Tools:** read-only file tools plus the Playwright MCP server (`"tools": ["read", "@playwright"]`, `includeMcpJson: false`). No write or shell tools. The prompt forbids `browser_run_code_unsafe`, but `@playwright` grants the whole server, so that ban is enforced by the prompt only.
- **Invoke:** in chat, ask Kiro to "run the ghost-ui-reviewer agent on the dashboard and quiz" (optionally name views or components). Start `npm run dev` first or it can only do a static review.
- **First run (dashboard and quiz at 390px):** the first run hit `ERR_CONNECTION_REFUSED` because the dev server was stopped, so it reported a static review. The second run, with the server up, measured in the browser.
  - PASS: tap targets (none under 44px), reduced motion, layout (no horizontal scroll), most aria labels.
  - FAIL: white-on-accent text at 3.99:1 (`.btn-primary`, `.ghost-badge`, `.skip-link`), active nav and sort labels at about 2.9 to 3.1:1, focus ring removed on `.btn-due`, `.btn-dev` and text inputs, label-in-name on "Review due ghosts", "Clear demo" and "Try demo".
  - Not acted on: no app code was changed. These findings are for a later fix.
- **Caveat:** the agent could not click because `browser_click` is not on its allowed list. It used Tab and Enter instead. Findings from the static-only first run (modal focus trap, input disabled after a correct answer, aria-label on spans) were not re-measured in the browser run, so treat them as unverified. One of them does hold up: my earlier Playwright snapshot showed the quiz ghost label as "Ghost haunting: A Java class is a blueprint for creating objects.", which contains the answer and is read aloud by screen readers.

---

## Fixes from the ghost-ui-reviewer report

Order followed: answer leak, contrast, focus, label-in-name, ConfirmDialog, readOnly, sr-only, tokens.

- **Answer leak:** the quiz ghost `aria-label` and the dashboard card `title` now use the cloze `prompt`. Checked in the browser: the full sentence and the answer are not in the DOM, any attribute, or any `title` before answering.
- **Contrast:** new tokens `--accent-strong` (#7a35e6), `--border-strong` (#7c6aa8), `--due`, `--due-glow`. Active nav, sort and tab labels use `--text`. `.badge--haunting` uses `--ghost-eyes`.
- **Focus:** removed `outline: none` from `.btn-due`, `.btn-dev`, `.quiz-input`, `.note-textarea`, `.room-title-input`. The global 2px accent `:focus-visible` outline now applies.
- **Label-in-name:** "Review due ghosts (N)", "Clear demo notes", "Try demo: load sample notes" (empty state), plus the same fix on two `AddNoteView` buttons ("Try demo…", "Reset: …") and the sound toggle `title`.
- **ConfirmDialog:** focus trap, Escape to close, focus restored to the opener. Verified in the browser (Tab wraps, Escape closes, focus returns to "Reset all data"). First attempt restored focus to the wrong element because `autoFocus` runs first, and then React StrictMode's simulated unmount stole focus in dev. Fixed by capturing the opener during render and skipping the restore while the dialog is still in the DOM.
- **Quiz input:** `readOnly` instead of `disabled` after a correct answer. Focus stays on the input.
- **sr-only:** badges, nav badge, quiz progress and quiz prompt use visually hidden text instead of `aria-label` on spans and paragraphs. The prompt keeps its visible text.
- **Tokens:** `#ffb432` and `rgba(255,180,50,…)` replaced by `--due`, `--due-glow` and `color-mix(in srgb, var(--due) N%, transparent)`. `.btn-sm` no longer needs `!important`.

### Contrast, before and after (390px, measured in the browser unless noted)

| Item | Before | After | Need |
|---|---|---|---|
| White on `.btn-primary`, `.ghost-badge`, `.skip-link` | 3.99 | 6.04 | 4.5 |
| Active nav label | 2.89 | 9.44 | 4.5 |
| Active sort label | 3.10 | 10.13 | 4.5 |
| `.badge--haunting` text | 3.63 | 7.09 | 4.5 |
| `.quiz-input` border | about 1.4 | 4.20 | 3 |
| `.tab-btn` border (inactive) | about 1.4 | 4.13 | 3 |
| `.sort-btn` border (inactive) | 1.33 | 4.13 | 3 |
| `.btn-ghost` border | 1.37 | 3.57 | 3 |
| Quiz input placeholder | about 3.9 | 5.34 | 4.5 |
| `.btn-due` border | about 3.4 (hand calc) | about 7.3 (hand calc; the browser reports `color-mix` as `color(srgb …)`) | 3 |

Not in the original list, added after the reviewer's re-run flagged them: `.btn-ghost`, `.btn-secondary` and `.sort-btn` borders, the input placeholder colour, the `.btn-due` border, and the sound-toggle `title`.

### Checks
- `npm run lint`, `npm test` (28 passed) and `npm run build` pass. ESLint on every saved file is clean.
- Reduced-motion check on `index.css` after each save: all covered (the final `prefers-reduced-motion` block sets `animation` and `transition` to `none` on every element).
- 390px: no horizontal scroll, 0 controls under 44px.
- Reviewer re-run: the first run after the fixes had one FAIL class (borders on ghost, sort and secondary buttons, placeholder). The second had two FAILs, `.btn-due` border and the sound-toggle title, both fixed afterwards. Not re-run a third time. The `.btn-due` result rests on my hand calculation.

### Left open on purpose
- **Blank length:** the number of underscores equals the answer length (for example `___` for DNA), so it hints at the answer. Fixing it means changing cloze generation and the saved card prompts (needs a store migration), so I did not do it here.
- `.btn-secondary` border (only on the Add Note view) and the shake and banish animations under reduced motion were not measured at runtime.
- `.quiz-input[readonly]` uses 0.5 opacity. I calculated about 4.6:1, only just above 4.5.
- Screenshots: `docs/screens/dashboard-390-a11y-after.png`, `docs/screens/quiz-390-a11y-after.png`.

---

## Fixed-length blanks

- **Why:** the blank had one underscore per answer letter, so `___` told you the answer was 3 letters (for example DNA).
- **New:** `src/lib/blank.ts` exports `BLANK` (`_____`) and `normalizeBlanks()`, which replaces any run of 2 or more underscores with `BLANK`. It is a pure function.
- **Used for display:** the dashboard ghost card text, `title` and `aria-label`, and the quiz prompt and ghost `aria-label`. Cards already saved with length-matched blanks are normalised at display time, so there is no store migration.
- **Used for new cards:** `cloze.ts` now writes `BLANK` into every new prompt. The demo data still stores old-style blanks and relies on display normalisation.
- **Bug found by the new property test:** for "…is Node20…" the definition regex picked "Node", but `\bNode\b` does not match inside "Node20". That produced a card with no blank at all (the whole sentence shown as the question). `buildCard` now returns no card when the prompt equals the sentence.
- **Tests:** `cloze.test.ts` gained two properties (every underscore run in a prompt is exactly `BLANK`; prompts built from answers of different lengths are identical) and the existing "prompt never contains the answer" stays. New `blank.test.ts` has 5 tests (output independent of run length, every output run is `BLANK`, idempotent, single underscore untouched, old blanks converted). 35 tests pass over 4 fresh-seed runs. Lint and build pass.
- **One test bug fixed along the way:** my first frame sentence contained "is", which made the generator blank "common" instead of the acronym.

### Runtime checks (Playwright MCP, 390px)

| Check | Result |
|---|---|
| Add Note `.tab-btn` border vs page | 4.13 inactive, 4.86 active (need 3) |
| Add Note `.btn-secondary` border (Start listening, Choose image, Choose audio file) | 4.13 (need 3); text 13.73; height 44 |
| Reduced motion: banish after a correct answer | class `ghost-banish` applied, `animation-name: none`, 0 running animations |
| Reduced motion: shake after a wrong answer | class `ghost-shake` applied, `animation-name: none`, 0 running animations |
| "Banished!" message under reduced motion | shown, then advances |
| Read-only quiz input after a correct answer | focus kept; effective text (130,130,143) on (24,24,38) = 4.62:1 (need 4.5; thin margin) |
| Blank on screen / in ghost aria-label | `_____` in both, for an answer 10 letters long |

Screenshot: `docs/screens/quiz-390-readonly-after.png`.

### Final ghost-ui-reviewer run
No FAILs. It noted `.btn-due` border at about 1.2:1, but the button is filled and its text is 6.89:1. The sound-toggle emoji contrast is not measurable by script. It did not read the console, and it did not trigger banish or shake live (I did, above).

---

## A7: Kiro power (skipped)

No power was installed or installable from here. The agent's Powers tool lists "No powers installed", and I cannot open the Powers panel or install one from this session, so no power was used. Nothing was reviewed or changed under A7. Inventing a power's findings would add nothing, so this step is skipped. To do it later, install a free React, testing or accessibility power from the Powers panel in the Kiro IDE and re-run the A7 prompt.

---

## B5: Lazy loading

- **Finding:** `@huggingface/transformers` was already out of the main bundle, because it is imported only in `whisper.worker.ts`, and the worker is created on the first transcription. The only static heavy import was `tesseract.js` in `src/lib/ocr.ts`.
- **Change:** `ocr.ts` now exports `loadOcrEngine()` (cached dynamic `import('tesseract.js')`, retry allowed after a failed fetch) and `extractTextFromImage` awaits it. `AddNoteView` starts the import the first time the Photo tab is selected and shows a "Loading OCR engine…" progress state with "Choose image" disabled until it is ready. No new CSS (reuses `.task-progress`).
- **Not done:** Photo and Audio are inline panels in `AddNoteView`, not separate components, so there was nothing to split with `React.lazy`. Splitting them would be a refactor, which was out of scope.

### Bundle sizes (`npm run build`, vite gzip)

| File | Before | After |
|---|---|---|
| Main `index-*.js` | 279.52 kB raw / 89.26 kB gzip | 262.63 kB raw / 82.37 kB gzip |
| `src-*.js` (tesseract.js, new chunk) | in main | 18.97 kB raw / 7.84 kB gzip |
| `whisper.worker-*.js` | 886.85 kB (not in main) | unchanged |
| `ort-wasm-*.wasm` | 21.6 MB (not in main) | unchanged |
| CSS | 16.59 kB / 3.78 kB gzip | unchanged |

The main bundle was already well under the 250 kB gzip target (89 kB before, 82 kB after).

### Runtime check (Playwright MCP, `vite preview` production build, 390px)
- First load requests only `/`, `index-*.js` and `index-*.css`. No tesseract, transformers, whisper or wasm.
- Try demo, a full quiz round (1 correct, 1 wrong, 7 skipped including the last card) and "Round complete!" all work. Console errors: none. No horizontal scroll.
- Opening Add Note requests nothing heavy. Selecting Photo fetches only `src-*.js`. The Audio tab requests nothing, because Whisper still loads on the first transcription.
- Skeleton: with that one request delayed by 1.5 s, "Loading OCR engine…" appears as a status region, "Choose image" is disabled, and it becomes enabled after the load. Screenshot: `docs/screens/addnote-photo-loading-390.png`.
- `npm run lint`, `npm test` (35 passed) and `npm run build` pass.

### Noticed, not changed
- `tesseract.js` fetches its worker, WASM core and `eng` language data from a CDN at run time by default. That is an outbound network call beyond the one-time Whisper download that `product.md` and `tech.md` allow. Fixing it means bundling or self-hosting those files, which is a separate task.
- Actual OCR and Whisper transcription were not run end to end.

---

## Spec: Haunting atmosphere (`.kiro/specs/haunting-atmosphere.md`)

Spec written first (R1 to R6, design, tasks), then built against it.

- **Five ghost types (R1):** `ghostTypeFor(weakness)` in the new pure module `src/lib/haunt.ts` splits 0 to 1 into five equal bands: wisp, ghoul, banshee, phantom, poltergeist. Shapes live in `src/components/ghostShapes.tsx` (teardrop, hunched with hollow eyes, long hair with a wailing mouth, hooded cloak, spiky with angry face). Rendered ghost SVG in the browser: poltergeist 1193 bytes, phantom 880 bytes; a test keeps every type under 2048. Glow strength and float speed differ per type, using the accent colour only.
- **Atmosphere (R2):** one fixed, `aria-hidden`, `pointer-events: none` layer (`Atmosphere.tsx`) with three slow fog layers, a faint flicker and six specks. Only `transform` and `opacity` animate. No layout shift (header meter has a fixed minimum width).
- **Banish (R3):** the ghost thins out and lifts (600 ms) while 7 fixed particles drift away (900 ms). Soft three-tone sine shimmer, only when sound is on. **Sound now defaults to off** for new visitors (it was on). Verified: with sound off no `AudioContext` is created; after enabling it, one is.
- **Returned ghosts (R4):** keep the orange aura and now shake in once (400 ms) before floating. New ghosts do not.
- **Haunted level (R5):** `hauntedLevel()` sums the weakness of unbanished ghosts into 5 tiers (Calm, Uneasy, Restless, Crowded, Overrun). The header meter (`role="meter"`, labelled by its visible text) and `data-level` on the app shell drive the vignette, fog layers and specks. Demo data reads "Crowded, 9 weak ghosts".
- **Reduced motion (R6):** no fog movement, no flicker, no particles, 0 running animations; the banished ghost is dimmed in place (opacity 0.2); the shake has no transform; the meter and "Banished!" text stay. Verified at runtime.
- **Tests:** `haunt.test.ts` (type bands, monotonic type, level properties), `ghostShapes.test.tsx` (size, distinct shapes), render tests for the three new components, `demoData.test.ts`. 55 tests pass over repeated runs. Lint and build pass; main bundle 83.88 kB gzip.

### Checks (Playwright MCP and ghost-ui-reviewer)
- Contrast of text over the fog at the maximum level, measured from rendered pixels: 5.54 (muted text), 5.58, 4.8 (accent heading). Meter label 5.34, level name 14.99, lit segment 4.58.
- 390px: no horizontal scroll, 0 targets under 44px, meter box 120x24 and does not overlap the nav. 1280px: no overflow.
- Reviewer FAILs and fixes:
  1. **Real answer leak:** the demo "Content" card still showed "content" in its prompt, aria-label and text. `demoData.ts` had its own non-global replace (the same bug fixed earlier in `cloze.ts`). Fixed with a global replace plus a test. After the fix none of the nine quiz cards contains its answer anywhere in the page HTML. **Demo cards already saved in a browser keep the old prompt until you click "Clear demo", then "Try demo".**
  2. Design nits: shake-in 550 ms changed to 400 ms; meter gap 0.2rem changed to 0.25rem.
- Not changed: the existing `pulse-border` animation (`.btn-secondary.listening`) animates `box-shadow`, not only `transform` and `opacity`. It is pre-existing and covered by the reduced-motion block.
- Reviewer was not re-run after these last two small fixes; I verified them directly (answer scan on all nine quiz cards, shake-in duration 0.4 s).

Screenshots in `docs/screens/`: `haunt-before-{dashboard,quiz}-{1280,390}.png`, `haunt-after-{dashboard,quiz}-{1280,390}.png`, `haunt-after-five-types-1280.png`, `haunt-after-banish-390.png`, `haunt-after-banish-reduced-390.png`.

---

## B2: Better quiz (`.kiro/specs/better-quiz.md`)

Spec written first, then built against it.

- **Hint:** first press shows the first letter, second adds the length, further presses do nothing (the button is `aria-disabled`, not `disabled`, so focus stays on it). A hinted correct answer still banishes, but the next interval is half as long: measured 12 h hinted versus 24 h unhinted on a new card. `scheduleCorrect(card, now, hinted)` in `srs.ts`; the store's `answerCard` takes `hinted` (no persisted-shape change, no migration).
- **Reveal:** shows the answer and counts as wrong (missed list, streak reset). Focus moves to Next, because the Reveal button is disabled right after.
- **Typo tolerance:** `src/lib/answer.ts` (pure): `judgeAnswer` returns exact, close or wrong. Answers of 6+ letters accept edit distance 1 and show "Close enough!"; shorter answers must match exactly after normalising. `hintFor` never contains the whole answer; if the wording happens to equal the answer it falls back to a symbolic form.
- **Streak:** "Streak N" in the quiz header (inside the existing `aria-live` score region). Wrong and reveal reset it, skip leaves it. `nextStreak` and `addMissed` live in `src/lib/quizRound.ts`.
- **Results screen:** missed cards with their answers, best streak, "Review missed" (a new round with only the missed ids, as another frozen queue snapshot) and "Back to Dashboard". Review mode has its own heading and a "Reviewing missed cards" label.
- **Lint note:** my first version used `useCallback` and the React Compiler lint rule rejected it, so the handlers are plain functions now.

### Tests
`answer.test.ts` (normalise, symmetric edit check, single edit accepted at 6+ letters, rejected under 6, two edits never accepted, hint never contains the answer), `quizRound.test.ts`, and three new hinted-scheduling properties in `srs.test.ts` (hinted returns sooner, still banished with reps + 1, unhinted unchanged). **76 tests pass over repeated runs.** One test bug along the way: a property returned an assertion value instead of nothing (fixed in the test only).

### Playwright MCP (390px and 1280px)
- Hint 1: "Starts with “s”"; hint 2: "Starts with “s”, 10 letters"; a third press changes nothing and focus stays on Hint. The answer was not in the DOM after two hints, and the blank stayed `_____`.
- Hinted correct: "Banished! … A hint was used, so it returns sooner." Card due in 12 h, intervalDays 0.5. Typo answer ("Photosynthesix"): "Close enough! Banished!", due in 24 h, streak 2.
- Reveal: counted as wrong (✗ 1, streak 0), focus on "Next →". Wrong answer ("zzz") goes to the missed list.
- Results: "2 correct out of 4 asked (5 skipped)", best streak 2, two missed cards with answers. Review missed: "1 / 2" with the "Reviewing missed cards" label. Finishing the review round shows "Review complete", no missed list, only "Back to Dashboard".
- 390px: 0 targets under 44px, no horizontal scroll on quiz or results. 1280px: no overflow. Screenshots: `docs/screens/quiz2-{hint,typo,reveal,results,review}-390.png`, `quiz2-{hint,typo,reveal,results,review-done}-1280.png`.

### ghost-ui-reviewer: FAILs and fixes
- **Results focus:** after the last card focus dropped to `<body>`. The results heading now takes focus (`tabIndex={-1}` plus a stable callback ref); one Tab reaches "Review missed". Verified.
- **Spacing:** `.quiz-missed li` padding 0.6rem 0.8rem changed to 0.5rem 0.75rem (on the 0.25rem scale).
- **Docs:** `--border-strong` added to `.kiro/steering/design.md`.
- **Not changed:** `.quiz-feedback.wrong` measures 4.74:1, which passes AA (the reviewer called it marginal and said no change was needed). The score block is re-announced as a whole on each change (verbose, not a failure). `--accent-strong`, `--due`, `--due-glow`, `--text-disabled` and `--track` are also missing from the design.md palette table; I left them alone because only `--border-strong` was flagged.
- The reviewer was not re-run after these three small fixes; I checked each directly (focus on the heading, computed padding 8px 12px).

Lint, tests and build pass; main bundle 84.80 kB gzip.


---

## Autopilot run (branch `autopilot/nov-15`, 2026-11-15)

### Spec: study-insights (spec first, then built)
- Specs: `.kiro/specs/study-insights/` (requirements, design, tasks). Built `reviewLog.ts`, `insights.ts`, store wiring with `sanitizeReviewLog` in `onRehydrateStorage`, `ReviewBarChart`, `StudyInsights`, styles and Dashboard hookup. Property tests cover append, sanitize, serialization round trip, streak, today count, accuracy, buckets, bar heights and weakest rooms.
- **Bug found by a property test (fixed):** `sanitizeReviewLog` hung on a hugely negative schema version `v` (the migration loop ran from `v` up to 1). It now rejects `v < 0` and returns an empty log. The hang also made the full `npm test` run time out for several minutes.
- **Bug found by a property test (fixed):** `weakestRooms` returned a NaN weakness when a card had `weaknessScore: NaN`, which would render "weakness NaN%" and break sorting. Non-finite scores now count as 0 and scores are clamped to [0, 1]. Unit test added.
- **ghost-ui-reviewer (static, no browser):** FAIL on chart baseline contrast (about 1.2:1), off-scale spacing and an estimated tall panel at 390px. Fixed in `ec66685` (baseline uses `--border-strong`, spacing on the 0.25rem scale, three compact stat columns). Not re-measured in a browser.

### Spec: data-safety-offline (spec first, then built)
- Specs: `.kiro/specs/data-safety-offline/`. Built `backup.ts` (export, untrusted-input validator, merge), `ImportDialog`, `BackupPanel`, `swStamp.ts`, `public/sw.js`, the stamping Vite plugin, manifest, three PNG icons from `scripts/make-icons.mjs`, production-only `registerSw.ts`, `offlineStatus.ts`, `modelCache.ts` and `ModelStatus`.
- Property tests cover the export envelope, round trip, validator totality (random garbage never throws), envelope defects, dropped invalid records, key whitelist and prototype safety, ignored review logs, merge preserving data, no duplicates, idempotence, summary counts, merged log, service worker stamping, precache selection and model status. No bug was found in the backup code by these tests.
- Known small issue, not fixed: when the 500-event cap drops incoming events, a repeat import counts them as added again in the summary. Stored data is unchanged.
- No new dependencies. `package.json` has no diff against `main`.

### Measurements (`npm run build`, vite gzip)
- Main bundle: 86.5 kB after study-insights, 90.2 kB after data-safety-offline (limit 250 kB). Whisper worker and WASM stay separate chunks.
- `npm run lint`, `npm test` (255 tests, 27 files) and `npm run build` pass. Built `dist/sw.js` has no unreplaced build tokens.

### UNVERIFIED (not run in a browser)
- Tasks 11.2 (offline reload, service worker control, installability, real `transformers-cache` file names) and 11.3 (import safety in the browser) were NOT run: the agent shell refused to start a dev or preview server. `REQUIRED_MODEL_FILES` in `offlineStatus.ts` is a guess until checked against the real cache.
- Layout at 390px and 1280px, reduced motion emulation, heading order and chart label legibility for the new panels were checked only by static review.

### Demo variety (Phase 1)
- Three new demo cards got weakness 0.1, 0.3 and 0.5, so wisp, ghoul and banshee appear alongside the phantom (two returned cards at 0.7 and 0.6) and poltergeist (new cards at 1.0). Exactly two cards are due, none banished. Three tests added to `demoData.test.ts`. Not viewed in a browser.

### OCR preprocessing (Phase 4)
- Removed the hard black/white threshold in `ocr.ts`. Greyscale, 2x upscale (max width 2500px) and a mild contrast boost (factor 1.3 in the new pure module `ocrPixels.ts`) remain. Unit and property tests added. The "Works best with clear printed text" note is unchanged. OCR was not run end to end.
- **SKIPPED: audio language switch.** A multilingual Whisper model is a different download from `Xenova/whisper-tiny.en`, which is the only model download `product.md` and `tech.md` allow. Adding it needs a steering change by the owner first.

### Fault-finding (Phase 5, code level only, no browser)
- **Bug found by adversarial tests (fixed):** valid JSON in localStorage with the wrong shape (`flashcards: null`, `flashcards` an object, `notes` a string, a `null` card inside `flashcards`) left the store with non-array state, and the rehydrate step called `.map` on it. Fix: new pure module `persistedState.ts` plus a `merge` option on the persisted store that rebuilds notes, cards, review log and UI settings from validated parts. 4 of the 8 corrupt-storage cases failed before the fix.
- **Bug found by adversarial tests (fixed):** a localStorage quota error (`QuotaExceededError`) thrown by `setItem` propagated out of store actions such as `addNote`. Fix: the store uses a `safeStorage` wrapper that catches read and write errors and logs one warning.
- Passed without changes: empty, whitespace and symbol-only notes give zero cards; a 20,000-character note and 20,000-character runs without spaces finish well under 3 s; 300 random binary strings never throw and no prompt contains its answer; an empty or punctuation-only answer is never judged correct or close; a maximum-size import (500 notes, 5,000 cards, 500 events) validates and merges in under a second and a repeat import adds nothing.
- Round 1 found two bugs. Round 2 found none, so the loop stopped after 2 rounds.
- Not done (needs a browser): rapid double-clicks, pasting HTML into inputs, tab switching during audio or OCR loading, back and forward, resizing, reduced motion on and off, keyboard-only walkthrough, console reading.

### Final numbers
- `npm run lint`, `npm run build` and `npm test` pass at the end: 285 tests in 32 files after the last test was added.


---

## Prize prep (branch `prize-prep`, off `main`)

### P4: Submission-readiness audit
- Added `scripts/check-submission.mjs` (Node built-ins and `git` only, read-only) and `docs/SUBMISSION_CHECKLIST.md`. The script checks LICENSE, `.kiro/` not ignored and tracked, specs/steering/hooks populated, secret patterns and `.env` files in tracked files (164 files scanned, none found), README sections, write-up placeholders, ignore rules for `.playwright-mcp/` and `node_modules/`, and exact dependency pins.
- Result: 5 checks PASS, 4 FAIL, 6 MANUAL. FAILs: README live-app and demo-video URL placeholders, `KIRO_WRITEUP.md` placeholders (your verdict sections), and 17 dependencies with `^` or `~` ranges.
- Fixed one clear gap: the README had no License section; added one that points to the MIT `LICENSE`. Did not invent URLs, fill your write-up sections, or edit `package.json`.

### P6: Kiro evidence index
- Added `docs/KIRO_EVIDENCE.md` with eight sections (surfaces, custom agent, hooks, specs, steering, property-based testing, MCP, powers), linked from `README.md` and `KIRO_WRITEUP.md`. All relative links were checked to exist. Sections with no evidence say NOT USED (CLI, Web, Crew, powers). Gaps listed: MCP tool names are not recorded in this log; hooks appearing in the Agent Hooks panel was never confirmed.

### P3: Safer loading of saved data
- Before this change the store silently dropped malformed saved notes and cards. Now `src/lib/loadReport.ts` (pure) inspects the raw saved string. If anything would be dropped, or the value cannot be read, the storage wrapper copies the raw string to `haunted-notes-storage-backup` before the cleaned state can be saved. An existing backup is never overwritten. If the backup write fails (quota), the notice says so instead of claiming a backup exists.
- A dismissible `LoadNotice` (`role="status"`, Dismiss button 44px) appears at the top of the dashboard and on the empty state, with counts only and no note or card text. The notice lives in the store but is excluded from persistence by `partialize`.
- A legacy card that only lacks SRS fields is repaired, not counted as dropped, so ordinary upgrades show no notice.
- Tests: 15 in `loadReport.test.ts` (3 fast-check properties: totality, valid data gives no notice or backup, backup equals the raw value), 8 store tests, 3 render tests. 311 tests pass; lint and build pass; main bundle 91.6 kB gzip.
- Noticed: `reviewLog.property.test.ts` "Property 1" timed out once at the 5 s default while the CPU was busy (72% in use) and passed on rerun in about 2.5 s. Not changed.
- UNVERIFIED: the notice in a real browser (layout, focus, 390px). Needs `npm run dev`.


### Dependency pins, test timeout and MCP tool record
- **Pins:** every dependency and devDependency in `haunted-notes/package.json` is now the exact version that was already installed (19 packages, `^` and `~` removed). Examples: `zustand 5.0.16`, `@huggingface/transformers 3.8.1`, `tesseract.js 5.1.1`, `@vitejs/plugin-react 6.2.1`, `globals 17.14.0`. Nothing was upgraded. `npm install` regenerated `package-lock.json`; its diff changes only the declared specifiers, with no `version`, `resolved` or `integrity` line changed. `scripts/check-submission.mjs` item 8 went from FAIL to PASS.
- **Timeout:** `vite.config.ts` now imports `defineConfig` from `vitest/config` and sets `test.testTimeout` to 30000 ms (default was 5000), after `reviewLog.property.test.ts` timed out once on a busy machine. No test was changed.
- **Playwright MCP tools called in the A5 run** (list supplied by the owner from the A5 report; that report is not in this repository, so I could not check it): `browser_navigate`, `browser_snapshot`, `browser_console_messages`, `browser_click`, `browser_type`, `browser_take_screenshot`, `browser_find`, `browser_resize`, `browser_evaluate`, `browser_emulate_media`, `browser_run_code_unsafe`. The custom agent `ghost-ui-reviewer` forbids `browser_run_code_unsafe` and its allowed list has no `browser_click` or `browser_type`, so this list belongs to the main agent's run.

---

## Prize prep 2 (branch `prize-prep-2`, off `main` at `fa539f1`)

No browser was available: nothing listened on port 5173 or 4173, and the agent shell refuses to start servers. All browser steps are UNVERIFIED; see `docs/BROWSER_CHECKS.md`.

### P2: "Four inputs, one ghost pipeline" strip
- New `StitchStrip` component on the empty state and under the Add Note title: Type, Speak, Photo and Audio file into Flashcards, Ghosts, Spaced review. A static figure with two labelled lists; arrows are `aria-hidden`. No interactive elements, existing tokens only, no animation. Inputs stack above the pipeline below 640px.
- Render test added (3 tests). Screenshots not taken (UNVERIFIED).

### P5: Netlify config (not deployed)
- `netlify.toml` at the repo root: base `haunted-notes`, `npm run build`, publish `dist`; `Cache-Control: no-cache` on `/sw.js` and `/manifest.webmanifest`; `public, max-age=31536000, immutable` on `/assets/*`; SPA fallback `/*` to `/index.html` with status 200 (real files are served first). README has a new Deploy section.
- Header paths were checked against `dist/` after `npm run build`. Service worker behavior under preview and on Netlify: UNVERIFIED.

### P7: 60-second tour
- "60-second tour" button next to Try demo on the empty state and in the Add Note demo shortcut. It loads the demo (once) and shows 5 coach-mark steps: rooms, a returned ghost, Start Quiz, Hint and Reveal (opens an unfiltered quiz), study insights.
- Pure step list in `src/lib/tour.ts`; state and actions (`tourStep`, `startTour`, `advanceTour`, `endTour`) in the store, excluded from persistence. `TourCoach` is a fixed `role="dialog"` panel named by the step title, with Next (Finish on the last step) and Skip tour, both 44px. Focus moves to the panel on each step and returns to `#main-content` on close; Escape closes. Added `data-tour="start-quiz"` to the Start Quiz button as a stable target.
- Tests: 7 in `tour.test.ts` (one fast-check property), 5 store tests, 4 render tests. One of my render-test expectations was wrong (it assumed React comment separators that `renderToStaticMarkup` does not emit); fixed in the test, the component was correct.

### ghost-ui-reviewer (static, no browser)
- Reviewed the strip, the tour, the load notice and the chart. PASS on computed contrast, 44px targets, aria names, focus handling and reduced motion.
- **FAIL (static estimate):** at 390px the fixed tour panel (estimated 230 to 260px tall) could cover tall outlined targets such as the insights panel. Fix: targets scroll to just below the sticky nav (`block: 'start'` and `scroll-margin-top: 5rem`), and `main` gets `padding-bottom: 18rem` while the tour is open. Not measured.

### Numbers
- `npm run lint`, `npm test` (330 tests, 39 files) and `npm run build` pass. Main bundle 92.8 kB gzip.

---

## Browser verification pass (branch `prize-prep-2`, Playwright MCP)

Run against the dev server (port 5173) and the production preview (port 4173), at 390, 768 and 1280px. Full results in `docs/BROWSER_CHECKS.md`; 19 screenshots in `docs/screens/final-*.png`.

Playwright MCP tools called in this pass: `browser_navigate`, `browser_resize`, `browser_evaluate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press_key`, `browser_file_upload`, `browser_take_screenshot`, `browser_console_messages`, `browser_run_code_unsafe` (only for `setOffline`, reloads with request-failure logging, and short scripted flows).

### Bugs found in the browser and fixed
1. **Offline start was broken.** On the preview build, an offline reload loaded the cached `index.html` but the main JS and CSS failed with `ERR_FAILED`, so the app never started. The files were in the cache and `fetch()` from the page got them, but the page's `<script type="module" crossorigin>` and crossorigin stylesheet are sent with an `Origin` header and the server answers `Vary: Origin`, so `caches.match` missed. Fix: `caches.match(request, { ignoreVary: true })` in `public/sw.js`, plus a source-scan test. After the fix: offline reload renders with 0 failed requests, Try demo and a quiz work, and the update path deleted the old cache.
2. **Horizontal scroll at 390px** when a note title is longer than about 30 characters: the rooms grid used `1fr`, whose minimum is the content width, and the title is `nowrap`. The page was 398px wide. Fix: `minmax(0, 1fr)`.
3. **Focus lost to `<body>`** after the load notice Dismiss, and after the import dialog closed (focus was returned while the modal was still open and the page inert). Both now return focus to a visible control or the main region.
4. **Insights panel at 1280px was 246px tall** (target about 220px). Tighter spacing in the 1024px block only: now 202px.
5. **"No reviews yet" wrapped to three lines** in the large number style at 390px, making the stat cards 162px tall. Now a small muted label: 109px.
6. **Tour step 1 target 24px under the sticky nav** at 390px (the nav is 104px tall, the scroll margin was 80px). Raised to 7.5rem. All 5 steps then measured: 0px covered by the panel, 0px under the nav.
7. **ghost-ui-reviewer FAIL:** the hidden audio and photo file inputs were Tab stops. Added `tabIndex={-1}` and `aria-hidden="true"`.

### Passed without changes
- Quiz round (correct, hinted correct, wrong, reveal, skip), results, Review missed, and the insights panel updating to streak 1, 6 reviewed, 67% accuracy.
- Export, re-import of the same file ("Nothing new will be added"), and a hostile file with `<script>`, `<img onerror>`, `<b onmouseover>` and `__proto__` keys: plain text only, nothing ran, no prototype pollution.
- Service worker scope, activation and control; manifest and 3 icons served with the right types; no worker on the dev server; the Audio tab model status offline with 0 network requests.
- Console: 0 errors and 0 warnings on every dev view; on the preview, errors only from the two offline reloads before fix 1.

### Not changed, noted
- Once the demo is loaded there is no "60-second tour" button anywhere.
- The import status says "Imported 1 notes, 1 cards" (no singular form).
- One run of the tour closed by itself during a dev-server CSS hot update; with no edits it stayed open.

### Still UNVERIFIED
- Model status "ready" (needs the roughly 40 MB model download) and `REQUIRED_MODEL_FILES` against a real cache.
- The install prompt, Netlify headers, the tour at 1280px, labels at 360px, and the photo input fix by keyboard (checked by code only).

### Numbers
- `npm run lint`, `npm test` (331 tests, 39 files) and `npm run build` pass. Main bundle 92.8 kB gzip.

---

## Tour button on the dashboard and pluralization (branch `prize-prep-2`)

- **Tour after the demo:** a "60-second tour" button in the dashboard summary bar, next to Start Quiz (`btn-ghost`, no `aria-label`, so its name is its visible text; the clock emoji is `aria-hidden`). It calls a new store action `replayTour`, which opens step 0 on the dashboard without loading or reloading the demo, and also works with your own notes. A `.btn-tour` class keeps it 44px tall at every width (the shared 44px rule only applies below 640px; at 1280 it was 40px).
- **Pluralization:** new pure helper `countLabel(n, singular, plural?)` in `src/lib/plural.ts`. Fixed plurals replaced in the export and import status (now in `src/lib/backupStatus.ts`: "Imported 1 note, 1 card and 1 review event."), the NavBar screen-reader badge ("1 ghost haunting"), and the hint length ("1 letter"). Already correct and unchanged: the day count, haunt meter, room count, returned-ghost count, streak label and load notice.
- **Tests:** `plural.test.ts` (unit plus one fast-check property), `backupStatus.test.ts`, two `replayTour` store tests (no demo load, the same card array, no demo added to your own notes), and `DashboardView.test.tsx` (button present with the demo and with your own notes, name equals visible text, NavBar "1 ghost" and "2 ghosts").
- **Playwright MCP, 390 and 1280px:** with the demo loaded the button is 147 x 44px at both widths; Tab from Start Quiz reaches it with the 2px accent ring; Enter opens step 1 with focus in the panel; the card count stays 9 (no demo reload); Escape returns focus to the main region; no horizontal scroll; 0 console errors or warnings. Screenshots `final-dashboard-tour-button-{390,1280}.png`.
- `npm run lint`, `npm test` (342 tests, 42 files) and `npm run build` pass. Main bundle 92.9 kB gzip.

---

## Quiet test output (branch `main`)

- **Problem:** with console output shown, `npm test` printed 15 warnings: 11 blocks from `StudyInsights.test.tsx` and 1 from `LoadNotice.test.tsx` ("could not save to localStorage ReferenceError: window is not defined", 14 lines in all), plus one expected "QuotaExceededError" warning from the quota test in `useStore.corrupt.test.ts`. Tests run in Node, which has no `window`, so every store write in those render tests hit the localStorage wrapper's catch. Note: this shell's Vitest run hides logs from passing tests, so the noise only showed with `--silent=false`; a normal terminal shows it.
- **Fix:** new shared setup `src/test/setup.ts`, registered as `test.setupFiles` in `vite.config.ts`. It gives the Node test environment an in-memory `window.localStorage` (cleared before each test), so the cause is gone and no real warning is hidden. It is assigned directly, not with `vi.stubGlobal`, so test files that stub their own `window` and call `vi.unstubAllGlobals()` get it back afterwards.
- **Quota test kept:** it now spies on `console.warn` to silence the expected warning, and additionally asserts that the warning was reported with a `DOMException`. No test was removed or weakened.
- **Result:** `npx vitest run --silent=false` prints 0 stderr blocks; `npm test` prints no error output; 342 tests in 42 files pass. `npm run lint` and `npm run build` pass.
