# Autopilot report (branch `autopilot/nov-15`, 2026-11-15)

Nothing was pushed. `main` was not touched.

## Result in one line
Lint, build and 285 tests (32 files) pass. Nothing was checked in a real browser, because the agent shell refused to start a dev or preview server.

## Tasks

### DONE
- **Phase 0:** branch, status file, baseline (all green at start).
- **Phase 1:** demo variety. All five ghost types appear on first load; exactly two returned ghosts. Tests added.
- **Phase 2:** study insights (spec first, 36 tasks plus one reviewer-fix task). Review log (cap 500, schema version, safe sanitizing on load), dashboard panel (streak, reviewed today, 7-day accuracy, 3 weakest rooms), plain SVG bar chart with a hidden table. Unit tests and 11 fast-check properties.
- **Phase 3:** data safety and offline (spec first, 55 tasks). Export, validated import with confirm dialog and merge, service worker (production only, versioned cache, app shell only), manifest, three icons, model-cache status in the Audio tab. Unit tests and 16 properties.
- **Phase 4 (OCR part):** hard threshold removed; greyscale, 2x upscale (max 2500px) and a mild contrast boost remain.
- **Phase 5:** fault-finding at code level, 2 rounds (round 2 found nothing). 
- **Phase 6 (partial):** bundle size check.
- **Phase 7:** README, KIRO_LOG.md, KIRO_WRITEUP.md updated with facts only. Opinion and verdict sections left as placeholders.

### FAILED
- None.

### SKIPPED
- **Audio language switch (Phase 4).** A multilingual Whisper model is a different download than `Xenova/whisper-tiny.en`, the only model download that `product.md` and `tech.md` allow. Your safety rules forbid new network calls beyond those files, so I did not add it. Decision for you: if you want it, update both steering files first.
- **Browser attacks and screenshots (Phases 5 and 6).** No server could be started, so there are no `final-*` screenshots in `docs/screens/`.
- **Phase 2 and 3 browser checks** (see UNVERIFIED).

## Bugs found and fixed
1. `sanitizeReviewLog` hung on a hugely negative schema version `v` (property test). Also made the full test run time out. Now returns an empty log.
2. `weakestRooms` returned a NaN weakness for a card with a NaN score (property test). Non-finite scores now count as 0 and scores are clamped to [0, 1].
3. Wrong-shape JSON in localStorage (`flashcards: null`, `notes` a string, a `null` card) left the store with non-array state and would crash on load. New pure module `persistedState.ts` and a `merge` option rebuild state from validated parts.
4. A localStorage quota error threw out of store actions. The store now uses a storage wrapper that catches read and write errors.
5. Reviewer (static) findings on the insights panel: chart baseline contrast about 1.2:1, off-scale spacing, panel too tall at 390px. Fixed in CSS.

## UNVERIFIED (never run in a browser)
- Service worker registration, offline reload, Try demo and a quiz while offline, update path, installability (manifest and icons are tested only as files).
- Real file names in the `transformers-cache` bucket. `REQUIRED_MODEL_FILES` in `src/lib/offlineStatus.ts` is a best guess, so the Audio tab may show "not downloaded" or "unknown" wrongly until checked.
- Import safety in the UI with a hostile file (the validator is covered by unit and property tests).
- Layout at 360, 390, 768 and 1280px; reduced motion; heading order; chart label legibility at 390px; whether the insights panel pushes the first ghost too far down.
- Console errors and warnings on every view.
- Keyboard-only use, dialog focus return, rapid double-clicks, pasting HTML into inputs, tab switching during audio or OCR loading, back and forward.
- OCR and Whisper end to end (the new OCR preprocessing is covered by unit tests only).
- Spec tasks 11.2 and 11.3 are marked complete because the spec allows logging them as UNVERIFIED. They were not run.

## Decisions I made for you
- Skipped the audio language switch (reason above).
- Chose compact three-column stat cards for the insights panel instead of a collapsible panel.
- Treated a NaN or out-of-range weakness score as 0 or clamped, instead of dropping the card.
- Lenient state loading: invalid notes and cards are dropped silently on load; valid ones are kept as they are.
- Backup limits: 5 MiB file, 500 notes, 5,000 cards, 5,000 events. A wrong app, unknown version or limit breach rejects the whole file.
- Grouped spec tasks per sub-agent run and marked them complete afterwards, so some commits cover several tasks.

## Known small issues
- When the 500-event cap drops incoming review events, a repeat import counts them as added again in the summary. Stored data does not change.
- `backup.test.ts` has a leftover `void MAX_TIME;` line to silence an unused constant.
- Two uncommitted-by-design leftovers may remain in `.kiro/specs/data-safety-offline/` (`tasks.md` status and `tasks.meta.json`).

## Look at these yourself before merging
Run the app first (`cd haunted-notes`, then the dev script from README), then:
1. Dashboard at 390px with the demo loaded: five ghost types visible, insights panel height, the Export and Import buttons at the bottom.
2. Dashboard at 1280px: insights panel and chart.
3. Quiz: answer a few cards, then return to the Dashboard and check the streak, today count and chart update.
4. Add Note, Audio tab: the model status line (Ready / Not downloaded / Unknown).
5. Export a backup, then Import the same file: the dialog should say nothing new. Then try a hand-edited file with a script tag in a note: it should show as plain text, never run.
6. Production build (`npm run build`, then the preview script): reload once, go offline in DevTools, reload, press Try demo and take a quiz. Check Application > Manifest and Service Workers.
7. In DevTools > Application > Cache Storage, open `transformers-cache` after one transcription and compare the file names with `REQUIRED_MODEL_FILES`.
8. Reduced motion on (DevTools > Rendering): no animation anywhere new.

## Review and merge commands
```bash
git log --oneline main..autopilot/nov-15
git diff main --stat
git diff main -- haunted-notes/src/store/useStore.ts
git checkout main
git merge autopilot/nov-15
```
To merge only some work, use `git cherry-pick <hash>` on `main` instead of the merge.