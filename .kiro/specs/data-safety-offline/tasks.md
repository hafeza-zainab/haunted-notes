# Implementation Plan: Data Safety and Offline

## Overview

Build bottom-up in three tracks that meet only at the end: (A) the pure backup module with its tests, then the store action and components; (B) the offline shell: stamping, service worker, manifest, icons and registration; (C) the model status. Every task builds on the previous ones and ends wired into the app. Language: TypeScript (strict, no `any`) for `src/`, plain JavaScript for `public/sw.js` and `scripts/make-icons.mjs`. No new dependencies; `vitest` 5.1.0 and `fast-check` 4.10.2 are already installed.

Prerequisite: the `study-insights` spec is built first. Task 1.1 checks that `reviewLog.ts` and its types exist and stops this spec if they do not.

Test sub-tasks are not marked optional: `.kiro/steering/testing.md` requires unit and property tests for every exported pure function in `src/lib/`, and the request asks for them. Run `npm run build` and `npm run lint` after each code task, and `npm test` after each test task, all in `haunted-notes/`. Do not edit unrelated code.

## Tasks

- [x] 1. Backup types and export
  - [x] 1.1 Confirm the study-insights prerequisite
    - Check that `src/lib/reviewLog.ts` exports `REVIEW_LOG_VERSION`, `emptyReviewLog` and `sanitizeReviewLog`, that `src/types.ts` has `ReviewEvent` and `ReviewLog`, and that the store has `reviewLog`
    - If any is missing, stop and report; do not recreate them in this spec
    - _Requirements: 9.1, 9.2_

  - [x] 1.2 Create `src/lib/backup.ts` with constants, types, export and file helpers
    - Export `BACKUP_APP`, `BACKUP_SCHEMA_VERSION`, `BACKUP_LIMITS`, `BackupData`, `ExportFile`, `buildExport(data, now)`, `serializeExport`, `backupFileName(now, tzOffsetMinutes = 0)` and `isFileSizeAllowed(bytes)`
    - `buildExport` copies exactly `notes`, `flashcards` and `reviewLog`; no clock reads; no React, Zustand or DOM imports
    - _Requirements: 1.2, 1.3, 1.4, 1.7, 2.2, 3.2, 15.3_

  - [x] 1.3 Write unit tests in `src/lib/backup.test.ts` for export helpers
    - Empty export has empty arrays; envelope keys are exact; file name for a fixed `now` and offsets; size boundary at 5 MiB and 5 MiB + 1
    - _Requirements: 1.2, 1.4, 1.5, 3.2_

  - [x] 1.4 Write property test for the export envelope
    - **Property 1: Export envelope is exact and deterministic**
    - Create the shared generators (valid note, card, event, `BackupData`) at the top of `backup.test.ts`
    - **Validates: Requirements 1.2, 1.3, 1.7**

  - [x] 1.5 Write property test for file name and size check
    - **Property 3: Backup file name and size check**
    - **Validates: Requirements 1.4, 3.2**

- [x] 2. Validation and sanitization
  - [x] 2.1 Add result types, limits helpers and `isPlainObject` / `isForbiddenKey` to `src/lib/backup.ts`
    - Export `RejectReason`, `ImportWarning`, `DroppedCounts`, `ValidateResult`, `ValidateContext`
    - `isPlainObject` accepts only objects whose prototype is `Object.prototype` or `null`; `isForbiddenKey` matches `__proto__`, `constructor`, `prototype`
    - _Requirements: 4.1, 5.3, 5.4_

  - [x] 2.2 Implement `sanitizeNote` and `sanitizeCard` in `src/lib/backup.ts`
    - Read fields only with `Object.hasOwn`; build results from object literals with known keys; check types, lengths and numeric ranges from the Assumptions; omit an invalid `title`; fill SRS defaults with `defaultSrsFields(now)` when all four SRS fields are absent
    - Do not use `Object.assign`, spread or `for...in` on untrusted values
    - _Requirements: 4.7, 4.8, 4.9, 4.11, 5.1, 5.2, 5.4, 5.6_

  - [x] 2.3 Implement `validateBackup` and `parseBackupText` in `src/lib/backup.ts`
    - Follow the 7 steps in the design: envelope checks and reasons, counts, notes with a `Set` of ids, cards with orphan and duplicate checks via `Set`, review log pre-filter then `sanitizeReviewLog`, warning `review-log-ignored`; wrap the body in `try/catch` returning `bad-shape`
    - `parseBackupText` returns `not-json` on a `JSON.parse` error
    - _Requirements: 3.3, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10, 4.12, 5.5, 5.8, 9.2, 9.3, 9.5, 9.6_

  - [x] 2.4 Write unit tests for validation in `src/lib/backup.test.ts`
    - One hand-written file per reject reason; legacy card gets default SRS fields; title of 201 characters drops only the title; `{"__proto__":{"polluted":1}}` leaves `({}).polluted` undefined; card with an id equal to `__proto__` is dropped; orphan card dropped; newer `reviewLog.v` gives the warning and keeps notes and cards
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.10, 4.11, 5.4, 9.3_

  - [x] 2.5 Write property test for round trip
    - **Property 2: Export round trip**
    - **Validates: Requirements 2.1, 2.2, 2.3, 9.1**

  - [x] 2.6 Write property test for totality
    - **Property 4: Validation is total**
    - Use `fc.anything()`, `fc.string()` and `JSON.stringify` of `fc.jsonValue()` as generators
    - **Validates: Requirements 3.3, 3.6, 5.8, 15.5**

  - [x] 2.7 Write property test for envelope defects
    - **Property 5: Envelope defects are rejected with the right reason**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.6**

  - [x] 2.8 Write property test for dropping invalid records
    - **Property 6: Invalid records are dropped and the rest kept**
    - **Validates: Requirements 4.7, 4.8, 4.9, 4.10, 4.12, 5.4, 9.5**

  - [x] 2.9 Write property test for key whitelist and prototype safety
    - **Property 7: Output contains only known keys and no pollution**
    - Build hostile input through `JSON.parse` of strings with forbidden own keys at several depths; compare `Object.getOwnPropertyNames(Object.prototype)` before and after
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.7**

  - [x] 2.10 Write property test for ignored review logs
    - **Property 13: Newer or malformed review log is ignored with a warning**
    - **Validates: Requirements 9.3**

- [x] 3. Checkpoint - validator complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Merge and store action
  - [x] 4.1 Implement `mergeBackup` and `ImportSummary` in `src/lib/backup.ts`
    - Follow the 4 merge steps in the design: `Set` of note ids, `Set` of card ids and content keys, event union keyed `t|r|c` then `sanitizeReviewLog`; never mutate `current`; reuse existing objects
    - _Requirements: 7.2, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 9.4_

  - [x] 4.2 Write unit tests for merge in `src/lib/backup.test.ts`
    - Same-id note skipped; same content with new id skipped; existing SRS fields survive; new items appended in file order; 500-event cap applied; summary numbers for a small example
    - _Requirements: 8.2, 8.3, 8.4, 8.8, 9.4_

  - [x] 4.3 Write property test for preserving existing data
    - **Property 8: Merge preserves existing data and adds each new item once**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.8**

  - [x] 4.4 Write property test for no duplicates
    - **Property 9: Merge result has no duplicates**
    - **Validates: Requirements 8.5**

  - [x] 4.5 Write property test for idempotence
    - **Property 10: Merge is idempotent**
    - **Validates: Requirements 8.6**

  - [x] 4.6 Write property test for summary counts
    - **Property 11: Summary counts add up**
    - **Validates: Requirements 8.7, 7.2**

  - [x] 4.7 Write property test for the merged review log
    - **Property 12: Merged review log is valid, sorted and capped**
    - **Validates: Requirements 9.2, 9.4**

  - [x] 4.8 Add `importBackup` to `src/store/useStore.ts`
    - Add `importBackup(data: BackupData): ImportSummary`; read `notes`, `flashcards`, `reviewLog` from `get()`, call `mergeBackup`, then one `set` with those three fields; return the summary
    - Add no persisted field and no migration; leave `currentView`, `soundEnabled`, `quizNoteId`, `quizDueOnly`, `isDemoLoaded` untouched
    - _Requirements: 8.9, 8.10, 15.7_

  - [x] 4.9 Write store tests in `src/store/useStore.test.ts`
    - `importBackup` changes only the three data fields and returns the summary; UI settings keep their values; a second call adds nothing
    - _Requirements: 8.6, 8.9, 8.10_

- [x] 5. Backup components and styles
  - [x] 5.1 Create `src/components/ImportDialog.tsx`
    - Props: `summary: ImportSummary`, `onConfirm`, `onCancel`; a native `<dialog aria-labelledby>` opened with `showModal()` in an effect; Cancel button with `autoFocus`; the Confirm button only when something is new; counts and warning texts only, from a fixed lookup
    - Close on the `cancel` event; no file-derived text, no HTML injection APIs
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9, 7.10_

  - [x] 5.2 Create `src/components/BackupPanel.tsx`
    - A `<section>` with a heading, an Export button, an Import button, a visually hidden file input (`accept=".json,application/json"`) and an `aria-live` status region
    - Export: `buildExport`, `serializeExport`, `Blob`, `URL.createObjectURL`, `<a download>` click, `URL.revokeObjectURL`, then the status "Exported N notes and M cards."
    - Import: size check before reading, `file.text()` in `try/catch`, `parseBackupText` with `existingNoteIds` from the store and `now: Date.now()`, a preview from `mergeBackup`, then open `ImportDialog`; on confirm call `importBackup` and show the result; reset the input value after each read; map every `RejectReason` to a fixed message
    - Return focus to the Import button after cancel
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 6.1, 6.4, 6.5, 7.1, 7.6, 7.7_

  - [x] 5.3 Add styles to `src/index.css`
    - Add `.backup-panel`, `.backup-actions`, `.backup-status`, `.backup-dialog`, `.backup-dialog::backdrop`, `.backup-counts` using only existing tokens; backdrop via `color-mix(in srgb, var(--bg) 80%, transparent)`; actions stack at 390px and sit in a row from `min-width: 640px`; no `@keyframes` or `transition`; confirm the reduced-motion block needs no entry
    - _Requirements: 7.8, 15.6, 15.8_

  - [x] 5.4 Render the panel in `src/components/DashboardView.tsx`
    - Add `<BackupPanel />` below the room list and on the `EmptyState` path; change nothing else
    - _Requirements: 3.1, 15.6_

  - [x] 5.5 Write component tests in `src/components/BackupPanel.test.tsx` and `src/components/ImportDialog.test.tsx`
    - With `react-dom/server`: panel has two buttons, a file input with `accept` and an `aria-live` region; dialog shows counts and warnings, shows only Cancel when nothing is new, and contains no seeded Answer_Text marker; source scan of both component files finds none of `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.3, 7.9, 7.10_

  - [x] 5.6 Write a source-scan test for `backup.ts`
    - In `src/lib/backup.test.ts` read the module text: no `Object.assign`, no `Date.now`, no `from 'react'`, no `from 'zustand'`
    - _Requirements: 1.3, 5.6, 15.3_

- [x] 6. Checkpoint - backup feature wired in
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Offline shell: stamping, worker, manifest, icons
  - [x] 7.1 Create `src/lib/swStamp.ts`
    - Export `SW_BUILD_TOKEN`, `SW_PRECACHE_TOKEN`, `stampServiceWorker`, `makeBuildId` and `selectPrecacheUrls`; no imports; `selectPrecacheUrls` keeps `index.html` and `assets/*.js|css`, drops `.map`, `.wasm`, `.onnx` and `sw.js`, appends extras, sorts and removes duplicates
    - _Requirements: 10.9, 12.1, 12.8, 15.3_

  - [x] 7.2 Write `public/sw.js`
    - Implement install (precache, fail on any non-200, then `skipWaiting`), activate (delete only `haunted-shell-*` caches that differ, then `clients.claim`; unregister itself if the build token is unstamped) and fetch (ignore non-GET, cross-origin, `sw.js`, `manifest.webmanifest`, `.wasm`, `.onnx`, `.traineddata`; network-first navigation with `index.html` fallback and update; cache-first assets, store only 200 same-origin)
    - No reference to `transformers-cache` or any model or Tesseract host
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 12.2, 12.3, 12.5, 12.6, 12.7_

  - [x] 7.3 Add the stamping plugin to `vite.config.ts`
    - Plugin `haunted-sw-stamp` with `apply: 'build'` and a `writeBundle` hook: collect file names from the bundle, build the id with `node:crypto` sha256 (first 12 hex characters), read the output `sw.js`, call `stampServiceWorker`, write it back, and throw if a token remains
    - Import `swStamp.ts` with its `.ts` extension; add it to the `include` of `tsconfig.node.json` only if the compiler requires it
    - _Requirements: 12.1, 12.8, 15.1_

  - [x] 7.4 Write unit tests in `src/lib/swStamp.test.ts`
    - Real `public/sw.js` text contains both tokens before stamping and neither after; `selectPrecacheUrls` on a sample bundle list; `makeBuildId` differs when a file name changes
    - _Requirements: 12.1, 12.8_

  - [x] 7.5 Write property test for stamping
    - **Property 15: Service worker stamping replaces both tokens**
    - **Validates: Requirements 12.1, 12.8**

  - [x] 7.6 Write property test for precache selection
    - **Property 16: Precache selection keeps only shell files**
    - **Validates: Requirements 10.9, 12.1**

  - [x] 7.7 Write source-scan tests for `public/sw.js` in `src/lib/swStamp.test.ts`
    - No `transformers-cache`, `huggingface`, `jsdelivr` or `tesseract` text; the only `caches.delete` call is guarded by the `haunted-shell-` prefix; `skipWaiting` and `clients.claim` are present; `.wasm`, `.onnx` and `.traineddata` exclusions are present
    - _Requirements: 10.8, 10.9, 12.2, 12.3_

  - [x] 7.8 Create the icon generator `scripts/make-icons.mjs` and the PNG files
    - Use only `node:zlib` and `node:fs`: draw a ghost on `#0d0d14` into an RGBA buffer, write PNG chunks with a CRC32 table, output `public/icons/icon-192.png`, `icon-512.png` and `icon-maskable-512.png` (ghost inside the central 80%); run the script once and commit the files
    - _Requirements: 11.2, 11.6_

  - [x] 7.9 Create `public/manifest.webmanifest` and update `index.html`
    - Manifest fields and relative `start_url` and `scope` as in the design; add `<link rel="manifest">` and `<link rel="apple-touch-icon">` to `index.html`
    - _Requirements: 11.1, 11.3, 11.4, 11.5_

  - [x] 7.10 Write manifest and icon tests in `src/lib/manifest.test.ts`
    - Parse the manifest; check required fields, colors equal `#0d0d14`, relative URLs; for each icon check the file exists, has the PNG signature and the width and height from the IHDR chunk match `sizes`; check `index.html` links
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.11 Create `src/lib/registerSw.ts` and call it from `src/main.tsx`
    - `shouldRegisterSw({ prod, hasServiceWorker, secure })` and `registerServiceWorker()`; register on `load` with `updateViaCache: 'none'` and a relative scope; a failed registration logs one `console.warn`; call after the first render; development builds never register
    - _Requirements: 10.1, 10.2, 10.10, 10.11, 12.4_

  - [x] 7.12 Write unit tests in `src/lib/registerSw.test.ts`
    - `shouldRegisterSw` is false in dev, without `serviceWorker`, and in an insecure context; true in production over a secure context; a rejected registration warns once and does not throw (fake `navigator` and `window`)
    - _Requirements: 10.1, 10.2, 10.10, 10.11_

- [x] 8. Checkpoint - offline shell builds
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Model status in the Audio tab
  - [x] 9.1 Create `src/lib/offlineStatus.ts`
    - Export `WHISPER_MODEL_ID`, `REQUIRED_MODEL_FILES`, `ModelStatus` and `modelStatus(cachedUrls, modelId?, required?)`; no imports of React, Zustand or DOM
    - _Requirements: 13.2, 13.3, 13.4, 15.3_

  - [x] 9.2 Write unit tests in `src/lib/offlineStatus.test.ts`
    - All files present gives `ready`; one missing gives `not-downloaded`; empty list gives `not-downloaded`; URLs of another model do not count
    - _Requirements: 13.3, 13.4_

  - [x] 9.3 Write property test for model status
    - **Property 14: Model status matches the cached files**
    - **Validates: Requirements 13.2, 13.3, 13.4**

  - [x] 9.4 Create `src/lib/modelCache.ts`
    - `readModelStatus(cacheStorage?)`: return `unknown` when `caches` is undefined or any call throws; call `has('transformers-cache')` first so the bucket is never created; then `open`, `keys()`, map to URLs and call `modelStatus`; no `fetch`, no import of `@huggingface/transformers`
    - _Requirements: 13.5, 13.8, 13.9_

  - [x] 9.5 Write unit tests in `src/lib/modelCache.test.ts`
    - Fake `CacheStorage`: missing bucket gives `not-downloaded` and `open` is not called; a throwing `open` gives `unknown`; no `caches` gives `unknown`; a full bucket gives `ready`
    - _Requirements: 13.3, 13.4, 13.5, 13.9_

  - [x] 9.6 Create `src/components/ModelStatus.tsx` and mount it in the Audio tab
    - Props: `refreshKey`; read the status in an effect on mount and when `refreshKey` changes; render icon plus text for the three statuses; mount it in `AddNoteView` inside the Audio tab only, passing the existing Whisper load state as `refreshKey`
    - Add `.model-status` to `src/index.css` with existing tokens, 44px-safe layout and no animation
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 9.7 Write render tests in `src/components/ModelStatus.test.tsx`
    - With `react-dom/server` and a stubbed status: each of the three statuses shows its text and an icon element; the file does not import `@huggingface/transformers` (source scan)
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.7, 13.8_

- [x] 10. Checkpoint - model status wired in
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Final verification
  - [x] 11.1 Run the quality gates and audit constraints
    - Run `npm run build`, `npm run lint` and `npm test` in `haunted-notes/` and fix failures caused by this feature
    - Confirm `package.json` dependency lists are unchanged; search the new CSS for hard-coded colors, `transition` and `animation`; confirm built `dist/sw.js` has no remaining token
    - _Requirements: 12.1, 15.1, 15.2, 15.6, 15.7_

  - [x] 11.2 Verify offline behavior with Playwright and log the result
    - Run `npm run build`, start `npm run preview` as a background process, then with Playwright: load, wait until the worker controls the page, fetch the manifest and each icon, go offline, reload, press Try demo, answer one quiz question; read the `transformers-cache` keys and confirm `REQUIRED_MODEL_FILES` (adjust the constant if the real file names differ); also check that `npm run dev` registers no worker
    - Append the manifest check, icon check, worker registration, offline reload and installability results to `haunted-notes/KIRO_LOG.md`; if any step cannot run, log it as UNVERIFIED with the reason and keep registration behind the production guard
    - Stop the preview process afterward
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 11.3 Verify import safety in the browser and log the result
    - With Playwright against the preview build: export, then import the same file and confirm the summary says nothing new; import a hand-made hostile file (`__proto__` keys, script text in `rawText`, unknown version) and confirm rejection or counts, no script execution, and no change to existing notes; confirm no card `sentence` or `clozeWord` text appears in the dialog; log results in `KIRO_LOG.md` (UNVERIFIED with the reason if not possible)
    - _Requirements: 6.3, 6.4, 7.1, 7.9, 8.6, 14.3, 14.4_

## Notes

- Test tasks are required, not optional (see Overview).
- Each property test uses `fc.assert` with `numRuns` of at least 100 and a comment tag `Feature: data-safety-offline, Property N: <title>`.
- After task 11.1, run the `ghost-ui-reviewer` agent on `BackupPanel`, `ImportDialog` and `ModelStatus` for contrast, 44px targets, focus and 390px layout.
- Spec documents live only in `C:\dev\kiro\.kiro\specs\data-safety-offline\`.
- Tasks 11.2 and 11.3 are browser runs requested by the user. They write only to `KIRO_LOG.md`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "7.1", "7.8", "9.1"] },
    { "id": 1, "tasks": ["1.2", "7.2", "7.9", "9.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "7.3", "7.4", "7.10", "9.3"] },
    { "id": 3, "tasks": ["1.4", "2.2", "7.5", "7.11", "9.4"] },
    { "id": 4, "tasks": ["1.5", "2.3", "7.6", "7.12", "9.5", "9.6"] },
    { "id": 5, "tasks": ["2.4", "4.1", "7.7", "9.7"] },
    { "id": 6, "tasks": ["2.5", "4.8", "5.1"] },
    { "id": 7, "tasks": ["2.6", "4.9", "5.2"] },
    { "id": 8, "tasks": ["2.7", "5.3"] },
    { "id": 9, "tasks": ["2.8", "5.4"] },
    { "id": 10, "tasks": ["2.9", "5.5"] },
    { "id": 11, "tasks": ["2.10"] },
    { "id": 12, "tasks": ["4.2"] },
    { "id": 13, "tasks": ["4.3"] },
    { "id": 14, "tasks": ["4.4"] },
    { "id": 15, "tasks": ["4.5"] },
    { "id": 16, "tasks": ["4.6"] },
    { "id": 17, "tasks": ["4.7"] },
    { "id": 18, "tasks": ["5.6"] },
    { "id": 19, "tasks": ["11.1"] },
    { "id": 20, "tasks": ["11.2"] },
    { "id": 21, "tasks": ["11.3"] }
  ]
}
```
