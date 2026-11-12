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
