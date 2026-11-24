# Browser checks

Branch `prize-prep-2`. Run with the Playwright MCP (headless Chromium) against the dev server (`http://localhost:5173`) and the production preview (`http://localhost:4173`). Measurements are from `getBoundingClientRect` and computed styles in the browser.

Status: PASS = checked and fine. FIXED = checked, broke, fixed in this pass and re-checked. FAIL = checked and still broken. UNVERIFIED = not run.

Screenshots are in `docs/screens/` with names starting with `final-`.

## 1. Layout at 390, 768 and 1280px

| Check | 390px | 768px | 1280px | Notes |
|---|---|---|---|---|
| No horizontal scroll (dashboard, Add Note, quiz, results) | FIXED | PASS | PASS | Rooms grid overflowed to 398px when a note title is longer than about 30 characters (see Fixes 1). Demo titles are short, so earlier runs missed it. |
| Insights panel layout | FIXED | PASS | FIXED | One column below 1024px, two columns from 1024px (466px and 512px at 1280). |
| Insights panel height | 494px (one column) | 467px (one column) | **202px** | Target at 1280 was under about 220px; it was 246px before Fixes 3. |
| Chart size | 324 x 120px | 512 x 120px, centered | 512 x 120px | Cap is 32rem wide and 140px tall. |
| Chart label size | 12.0 to 13.0px | 12.0 to 13.0px | 12.0 to 13.0px | Rendered size (font-size times SVG scale). Weekday labels fit at 390; 360px was not measured. |
| Stitch strip | PASS | not measured | PASS | 390: inputs stacked above the pipeline with a down arrow, chips 13.6px. 1280: one row under the Add Note title. |
| Load notice | PASS | not measured | not measured | "2 saved items could not be loaded; a backup copy was kept." `role="status"`, Dismiss 84 x 44px, backup key equals the original raw value. |

Screenshots: `final-dashboard-{390,768,1280}.png`, `final-insights-1280.png`, `final-add-note-{390,1280}.png`, `final-stitch-strip-{390,1280}.png`, `final-load-notice-390.png`, `final-quiz-{390,1280}.png`, `final-results-{390,1280}.png`.

## 2. 60-second tour at 390px (REMOVED on branch `demo-autoplay`)

The tour was replaced by the self-playing Run demo (section 8 below). The results in this section are kept as history and no longer describe the app.

Nav ends at 104px. The panel starts at 627px (602px on the quiz step).

| Step | Target (top to bottom) | Covered by panel | Hidden under nav | Focus in panel | Status |
|---|---|---|---|---|---|
| 1 Haunted rooms | `.room-card` 120 to 497 | 0px | 0px | yes | FIXED (was 24px under the nav, see Fixes 4) |
| 2 A returned ghost | `.ghost-card` 120 to 305 | 0px | 0px | yes | PASS |
| 3 Start Quiz | button 120 to 164 | 0px | 0px | yes | PASS |
| 4 Hint and Reveal (opens the quiz) | `.quiz-actions` 431 to 531 | 0px | 0px | yes | PASS |
| 5 Study insights | `.insights` 120 to 614 | 0px (13px gap) | 0px | yes | PASS |

- Escape closes the tour: PASS. Focus returns to `main#main-content`, the outline is removed and the extra bottom padding is gone.
- Skip tour: PASS, same result. Next and Skip tour (Finish on the last step) are 44px tall.
- No demo answer in any step's text: PASS.
- Screenshots: `final-tour-step{1,2,3,4,5}-390.png`.
- Not checked at 1280px with Playwright.
- Once the demo is loaded, the tour starts from a "60-second tour" button in the dashboard summary bar (added later; 147 x 44px at 390 and 1280px, checked with Playwright).

## 3. Quiz round and Review missed (390px)

| Check | Status | Measured |
|---|---|---|
| Correct answer | PASS | ✓ 1, streak 1, auto-advances |
| Hint, then correct | PASS | Hint "Starts with “M”"; answer not in the page HTML before answering; ✓ 2, streak 2 |
| Wrong answer | PASS | ✗ 1, streak 0; answer shown only after answering |
| Reveal | PASS | Counted wrong (✗ 2); focus moves to Next |
| Skip | PASS | Score unchanged |
| Results | PASS | "2 correct out of 4 asked (5 skipped)", best streak 2, 2 missed cards, focus on the heading |
| Review missed | PASS | Only the 2 missed cards, labelled "Reviewing missed cards"; "Review complete!" afterwards |
| Dashboard, streak and chart update | PASS | Streak 1, reviewed today 6, accuracy 67% (4 of 6), today's bar 6, hidden table "Mon 6 4". Review log `110011`; skips are not logged. |

## 4. Export and import (dev server, 390px)

| Check | Status | Notes |
|---|---|---|
| Export | PASS | "Exported 3 notes and 9 cards." File `haunted-notes-backup-2026-11-23.json`, 6 KB, schema version 1, 3 notes, 9 cards, 6 review events. |
| Import the same file | PASS | Dialog: 0 new, 3/9/6 already here; "Nothing new will be added."; only Cancel, which has focus. Screenshot `final-import-nothing-new-390.png`. |
| Hostile file: `<script>` and `<img onerror>` in a note title, `<script>` in note text, `<b onmouseover>` in a card prompt, `__proto__` keys at the top level and in a note | PASS | Dialog shows counts only (1 new note, 1 new card). After Merge the title renders as plain text (0 child elements), 0 injected `img`/`script`/`b` elements, no script ran, `Object.prototype` not polluted, existing 3 notes kept. |
| Focus after Cancel or Escape | FIXED | Returns to Import backup (see Fixes 5). |
| Focus after Merge | FIXED | Was `<body>`; now the Import button, or the main region when the panel is replaced. |
| Minor | NOTE | The status text now uses singular forms ("Imported 1 note, 1 card"), fixed later. A hostile prompt containing `__` is shown with that run turned into the fixed `_____` blank; text only, harmless. |

## 5. Offline on the production preview (390px)

| Check | Status | Notes |
|---|---|---|
| Service worker registered | PASS | Scope `http://localhost:4173/`, activated, controlling the page, 1 registration. |
| Shell cached, heavy files not cached | PASS | Cache `haunted-shell-<id>` with 10 files (index.html, JS, CSS, worker chunk, icons, manifest, favicon). No `.wasm`. |
| Manifest loads | PASS | 200, `application/manifest+json`, name "Haunted Notes", `start_url` `./`, `display` standalone, theme `#0d0d14`. 3 icons, each 200 `image/png`. |
| Offline reload | FIXED | **Was broken**: the page loaded but the app never started (main JS and CSS failed with `ERR_FAILED`). See Fixes 6. After the fix: renders, 0 failed requests. |
| Try demo and a quiz while offline | FIXED | After the fix: 3 rooms, one correct answer (✓ 1) and a skip. Screenshot `final-offline-quiz-390.png`. |
| Update path | PASS | After rebuilding, the new worker took over and the old `haunted-shell-` cache was deleted. |
| Model status in the Audio tab, offline | PASS | "Whisper model not downloaded yet…", with 0 network requests. |
| Model status "ready" | UNVERIFIED | Needs the one-time model download (about 40 MB). `REQUIRED_MODEL_FILES` is still unchecked against a real cache. |
| Dev server registers no worker | PASS | 0 registrations, no caches on port 5173. |
| Installability prompt | UNVERIFIED | Manifest and icons are valid; the install prompt itself was not triggered in headless Chromium. |
| Netlify headers | UNVERIFIED | Not deployed. |

## 6. Console

| Where | Status | Notes |
|---|---|---|
| Dev: dashboard, Add Note, quiz, results, tour, load notice, import | PASS | 0 errors, 0 warnings (only Vite and React DevTools info lines). |
| Preview, online and offline | PASS after fix | The only errors in the session were 4 `ERR_FAILED` lines from the two offline reloads before Fixes 6. None after. |

## 7. ghost-ui-reviewer on the live app

Run on the dev server at 390x844 (dashboard also at 1280x900). It can only use Tab, Shift+Tab and Enter, so it could not start the tour, open the file chooser or trigger the load notice; those were measured in sections 2 and 4 above.

| View | Result |
|---|---|
| Dashboard (insights, backup) | PASS: lowest text contrast 4.86:1, borders 3.46 to 5.81:1, no target under 44px, label-in-name, no scroll, reduced motion leaves 0 running animations |
| Quiz | PASS: answer not in the DOM before answering, targets 44px, tab order input, Hint, Skip, Reveal, Dashboard |
| Results | PASS: focus on the heading |
| Add Note | **FAIL, FIXED**: the hidden audio file input was a Tab stop (1 x 1px, clipped), so focus went to nothing visible. The photo input had the same code. Fix: `tabIndex={-1}` and `aria-hidden="true"` on both. Re-checked: Tab from "Choose audio file" now goes to Add Note. The photo half was checked only by code, not by Tab. |
| Tour, load notice | Static PASS (measured live in sections 1 and 2 above) |

## Fixes made in this pass

1. **Room grid overflow at 390px** (`index.css`): grid columns `1fr` changed to `minmax(0, 1fr)` (also for the 2 and 3 column breakpoints), so a long note title truncates with its ellipsis instead of widening the page.
2. **"No reviews yet" in the accuracy card** (`StudyInsights.tsx`, `index.css`): shown as a small muted label instead of the 20px number style. The stat cards went from 162px to 109px tall at 390px.
3. **Insights panel at 1280px** (`index.css`, 1024px block only): tighter padding and heading margins, weakest-room rows at 0.9rem. Height 246px down to 202px.
4. **Tour target under the nav** (`index.css`): `.tour-target` `scroll-margin-top` raised from 5rem to 7.5rem, because the nav is 104px tall at 390px.
5. **Focus lost after Dismiss and after the import dialog** (`LoadNotice.tsx`, `BackupPanel.tsx`): Dismiss now focuses the main region. The import dialog returned focus while the modal was still open (the page behind it is inert), so it now waits one frame and falls back to the main region if the panel was replaced.
6. **Offline start failed** (`public/sw.js`): the module script and crossorigin stylesheet are requested with an `Origin` header, while precache stored them without one. Vite preview sends `Vary: Origin`, so `caches.match` missed and fell through to the offline network. The asset lookup now uses `caches.match(request, { ignoreVary: true })`. Regression check added in `swStamp.test.ts`.
7. **Hidden file inputs in the tab order** (`AddNoteView.tsx`): see section 7.
