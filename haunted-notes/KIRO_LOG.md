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
