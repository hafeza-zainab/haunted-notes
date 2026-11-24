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

## 8. Run demo (branch `demo-autoplay`)
Run with the Playwright MCP against the dev server (`http://localhost:5173`), with one real note and one real card in localStorage so that restore could be compared with `JSON.stringify` (notes, flashcards, review log). Status: PASS, FAIL or UNVERIFIED.

### 8.1 Full runs
| Check | 1280px | 390px | Measured |
|---|---|---|---|
| All 9 chapters and 33 steps play and the run ends by itself | PASS | PASS (twice: reduced motion on, then off) | Step starts logged by a MutationObserver on the caption. The last step starts at 152.3 s and lasts 6 s, so the measured total is **158.3 s (2:38)**, equal to the scripted total. Limit 170 s: PASS. |
| Total shown in the bar is the real total | PASS | PASS | Bar read "0:00 / 2:38" at the start and "1:42 / 2:38" in the spaced repetition chapter; it is computed from the script. |
| Every caption matches the screen | PASS | PASS | Each step's view was logged next to its caption (Add a new note, Ghost dashboard, Quiz mode, Quiz complete, text card over the app, empty state with Try demo). Highlighted target per step logged and visible (see 8.4). Observation: the quiz card order is random, so which ghost is skipped and which cards are missed differs per run. If the skipped card was one of the two built-in "returned" cards, one orange ghost is already on the dashboard before the time-travel step. The captions stay true either way. |
| Data restored after finish | PASS | PASS | Notes, cards and review log equal the originals; snapshot key deleted; bar, shield and `demo-running` class gone; focus on `main#main-content`. |
| Data restored after Stop (button, real click) | PASS | not run | Same checks. |
| Data restored after Escape (real key) | PASS | not run | Same checks. Escape pressed in the intro and in the mic step. |
| Data restored after a reload in the middle | PASS | not run | Reloaded at about 24 s. The saved store still held the real note during the run (writes are suspended); the leftover snapshot was deleted on the next load. |
| Recovery on load applies a snapshot over demo-looking data | PASS | not run | Saved store set to a fake demo note, a valid snapshot written, page reloaded: the real note was back and the snapshot key was gone. |
| `?demo=1` starts the run by itself | PASS | not run | Bar present about 1 s after load. |
| Shield blocks pointer input | not run | PASS | Playwright could not click the Quiz nav button: "`div.demo-shield` intercepts pointer events". |
| Shield blocks keyboard input | PASS | not run | Focus on the Quiz nav button, Enter pressed: 0 trusted clicks, view unchanged. |
| No console errors or warnings | PASS | PASS | In-page recorder of `console.error`, `console.warn`, `error` and `unhandledrejection`: empty. Playwright console: 0 errors, 0 warnings. |
| No network, file or model requests during a run | PASS | not run | `performance.getEntriesByType('resource')` was empty after clearing it before the run: no module, worker, model or OCR asset, no external URL. No file chooser or download was opened (the script never clicks those; source scan test covers it). |
| No horizontal scroll while running | not run | PASS | Max `scrollWidth - clientWidth` = 0 in both 390px runs. |
| Reduced motion: instant scrolling | not run | PASS | With `prefers-reduced-motion: reduce` every `scrollIntoView` call used `behavior: "auto"`. |
| Highlighted targets clear of the bar | not run | PASS | Every highlighted element was fully visible above the bar at 390px (20 targets, 100% visible). |
| Clicked targets visible above the bar | not run | PASS with a note | The first 390px run showed Reveal and Skip hidden behind the bar. Fixed (`reveal()` scrolls click and type targets into view; commit `647116f`). Second run, checked 0.8 s after each click: of 25 clicks, 20 visible, 2 under the bar (below) and 3 gone because the view changed. Add Note and Reveal were 4 and 13 px under the bar, because the success and feedback message pushes the button down after the click; they were visible at the click. |

### 8.2 Control bar (390 and 1280px)
| Check | Status | Measured |
|---|---|---|
| Pause and Stop at least 44px | PASS | 93 x 44 and 79 x 44 at both widths (min button size in the 390px run: 44). |
| Bar height | PASS | 205 px at 390px (24% of 844), 167 px at 1280px; main content bottom padding 224 px and 176 px, so nothing is hidden at the end of a page. |
| Keyboard | PASS | Focus starts on Pause; Tab goes Pause, Stop; focus ring is the global 2px accent ring (4.2:1). Tab can still leave the bar to the skip link behind the shield (cosmetic, other keys are blocked). |
| Names equal visible text | PASS | No `aria-label`; icons `aria-hidden`; caption `role="status"` `aria-live="polite"`. |
| Contrast | PASS after fix | Text 13.7:1, Stop 5.3:1, borders and dots 3.6:1. |
| State not by colour alone | FIXED | ghost-ui-reviewer: done and upcoming dots differed only by fill. Now the current dot is a longer pill and finished chapters read "(done)" to screen readers. Chapter text "Chapter N of 9" was already there. Re-measured: UNVERIFIED (the CSS change was not re-viewed in the browser; unit test covers the "(done)" text). |
| Reduced motion | PASS | No animation or transition on the bar, card or highlight. |

### 8.3 Items from sections 1 to 7 above, after this branch
| Section | Status on `demo-autoplay` | Why |
|---|---|---|
| 1 Layout, no horizontal scroll (dashboard, Add Note, quiz, results) at 390px | PASS | 0 px overflow while the demo showed all four views. |
| 1 Layout at 768px, insights panel height and chart size, chart label size, stitch strip, load notice | UNVERIFIED | Not measured again. Only the insights panel look at 1280px was seen in a screenshot. |
| 2 60-second tour | REMOVED | Feature replaced by Run demo. |
| 3 Quiz round: correct, hint, wrong, reveal, skip, results, review missed, dashboard and chart update | PASS | All were driven by the script at 1280 and 390px. Final dashboard: streak 1, reviewed today 10, accuracy 80% (8 of 10) after the script's 10 reviews; the review log gains one event per answered or revealed card. |
| 3 Answer not in the page before answering | UNVERIFIED in the browser | Covered by `demoTargets.test.tsx` (rendered markup) only. |
| 4 Export and import | UNVERIFIED | Not re-run. The run only outlines the buttons; the privacy line was added to the same panel. |
| 5 Offline on the production preview | UNVERIFIED | Production preview not started on this branch. |
| 6 Console | PASS | 0 errors and 0 warnings across all runs. |
| 7 ghost-ui-reviewer on the live app | PASS for the new bar | See 8.2. The rest of the app was not reviewed again. |

### 8.4 Screenshots (`docs/screens/`)
`demo-autoplay-intro-1280.png`, `demo-autoplay-mic-1280.png` (Add Note step), `demo-autoplay-results-1280.png` (Review missed step), `demo-autoplay-returned-1280.png` (spaced repetition step, bar and returned ghost), `demo-autoplay-restored-after-finish-1280.png` (the real note back after a run), `demo-autoplay-bar-390.png`, `demo-autoplay-reveal-390.png`.

### 8.5 Not covered
No test clicks a real file chooser or the export button during a run: the script never does, and the source scan test enforces it. Not run: a 768px run, Firefox and Safari, a run with the demo already loaded as the user's own data (the snapshot logic is unit-tested), and a real tab close (a reload was used instead).
### 8.6 After the 2-3-5-7 ladder (branch `ladder-2357`, dev server)
The demo changed: the dashboard shows "Review ladder: 2, 3, 5, 7 days", the spaced repetition chapter has a new "ignored" step, and the script is now 34 steps and **162.6 s (2:42)**. Section 8.1 to 8.5 above describe the earlier 158.3 s script.

| Check | 1280px | 390px (reduced motion on) | Measured |
|---|---|---|---|
| All 34 steps play; last step starts at 156.6 s, so the total is 162.6 s | PASS | PASS | Equal to the scripted total. Under the 170 s limit. |
| Captions match the screen in the spaced repetition chapter | PASS | PASS (seen in a screenshot) | "Ghosts return after 2, 3, 5, then 7 days." with "Next ghost returns in 2 days" and "Review ladder: 2, 3, 5, 7 days" both outlined. After the two-day jump: 6 ghosts returned (the 3-day built-in ones are not yet due), "Next ghost returns in 1 day". |
| "Ignored" step: ghosts grow | PASS | PASS | Before: 6 returned; haunt meter "Restless"; weakest rooms Biology 80%, Java 45%, Marketing 21%; ghost sizes 80, 66, 66, 66, 42, 49, 35 px. After five more days: 8 returned; meter "Crowded"; Biology 93%, Java 65%, Marketing 46%; sizes 80, 75, 75, 75, 63, 52, 59, 58, 45 px, with more poltergeists and banshees. |
| Haunt meter, weakest rooms and room sort use the grown weakness | PASS | not run | Values above come from the dashboard during the run. |
| `?dev=1` "+1 day" button gone | PASS | not run | `.btn-dev` not in the DOM. |
| Data restored; snapshot key removed; focus on main | PASS | PASS | Notes, cards and review log equal the originals. |
| No console errors or warnings | PASS | PASS | In-page recorder empty. |
| No horizontal scroll | not run | PASS | Max overflow 0 px. The ladder line is 24 px tall in the summary bar at 390px. |
| Bar and buttons | not run | PASS | Bar height 205 px; smallest button 44 px. |
| Every programmatic click is visible above the bar at the moment of the click | not run | PASS | 25 of 25 visible, 0 hidden (measured synchronously, with reduced motion on so the scroll is instant). |
| Every highlighted element fully visible above the bar | not run | PASS | 20 of 20 targets at 100% at every sample. |

Screenshot: `demo-autoplay-ignored-390.png` (spaced repetition chapter, grown ghosts and the bar).
Not run again after the ladder change: a 390px run with motion on, 768px, the production preview and offline mode, export and import.
## 9. Narration in Run demo (branch `demo-audio`)
Run with the Playwright MCP (headless Chromium, dev server `http://localhost:5173`), with one real note and card in localStorage so that restore could be compared. Status: PASS, FAIL or UNVERIFIED. **Nothing was heard**: headless Chromium has no speaker, so every audio check reads `audio.currentTime`, `paused`, `ended`, `volume`, `muted` and `src`. Screenshots: `docs/screens/demo-audio-*.png`. Per-clip numbers are in `docs/DEMO_TIMING.md`.

| Check | Status | Measured |
|---|---|---|
| Manifest durations measured in the browser | PASS | `audio.duration` for the nine clips: 5.04, 20.24, 11.04, 21.68, 14.88, 6.80, 7.12, 11.12, 7.04 s. They also equal the WAV headers (a test checks this). |
| (a) Each clip is started at its chapter's scheduled start | PASS | `play()` was called 2 to 23 ms after the scheduled start for all nine clips, with `currentTime` 0 each time. |
| (a) Each clip is audible within 300 ms of the scheduled start | **FAIL for two clips** | From `currentTime` samples every 100 ms: 7 clips at 85 to 103 ms; clip 1 at 504 ms and clip 5 at 536 ms (earlier run: 804 ms for clip 1). Cause: the browser takes time to start its audio output (first sound in the page, and after a 27 s silence). A test in the same browser showed the file load costs 34 to 70 ms. I cannot remove that start-up time; holds were added so a late start never cuts a clip. May differ on your machine. |
| All nine clips play to their end before the next chapter | PASS | `ended` / `currentTime` equals the duration for all nine; they end 1.46 s (clip 1) to 27.6 s (clip 4) before the next chapter, and clip 9 ends 1.9 s before the run closes. |
| (b) Pause pauses the audio, Resume continues it | PASS | Real clicks on the bar. Paused at clip time 10.19 s (script 0:17, chapter start 0:07): `paused` true, `currentTime` and the bar clock frozen for 2.5 s. Resume: same clip, `play()` called at 10.19 s, 2.4 s later it was at 12.61 s (script 0:19). A finished clip is not restarted (unit test). |
| Sound off and on during a run | PASS | Sound off: `paused` true, `src` empty, caption still shown, button reads "Sound off"; chapters 3 and 4 started silently (no `play()`). Sound on at script 0:58 inside chapter 4: the clip started at 4.73 s (expected 4.6 to 5.6 s) and kept playing; button reads "Sound on". |
| (c) Stop stops the audio and restores my data | PASS | Real click on Stop while a clip played: `src` empty, `paused` true, `currentTime` 0, 2 s later still silent; data equal to the original; snapshot key gone; focus on `main`. |
| (c) Escape stops the audio and restores my data | PASS | Real Escape at clip time 6.66 s: same result. |
| (d) `?demo=1` shows one "Start with sound" button | PASS | Dialog, button 192 x 44 px with focus, text "A narrated walkthrough of 2:46" (from the script), no run and no audio element created. Screenshot `demo-audio-prompt-1280.png`. |
| (d) Escape cancels the prompt | PASS | Prompt gone, no run, no `play()`, focus on `main`, data untouched. |
| (d) Clicking "Start with sound" starts a run with sound | PASS | Real click: bar present, clip 2 playing at 3.31 s (`volume` 1, `muted` false), button "Sound on". |
| (d) `?demo=1&sound=0` starts silently by itself | PASS | No prompt; the run started about 0.6 s after load; button "Sound off"; no `/demo-audio/` request after 9 s of the run; no `<audio>` element created. |
| (e) A missing clip does not stop the run | PASS | Chapter 3's file name was rewritten to a non-existent name in the page (my files were not touched). "Narration unavailable" appeared once, at 37.95 s (chapter 3 start), in a `role="status"` element. Clips 4 to 9 still played, the run finished (166.6 s), data was restored. Screenshot `demo-audio-unavailable-390.png`. |
| (f) No console errors | PASS | In-page recorder (`console.error`, `console.warn`, `error`, `unhandledrejection`) empty in every run; Playwright console 0 errors and 0 warnings, including the missing-clip run. |
| (g) Measured total under 2:55 | PASS | 166.63 s (2:46.6) from the click to the bar closing, 166.63 s again in the missing-clip run at 390px. |
| Data restored after finish, Stop, Escape | PASS | Notes, cards and review log equal the originals each time; snapshot key removed. |
| 390px: bar layout with the third button | PASS | Bar 205 px (24% of 844 px; 235 px while "Narration unavailable" is shown); Pause 93, Sound 119, Stop 79 px wide, all 44 px high, in one row; no horizontal scroll; main content bottom padding 256 px. Screenshots `demo-audio-bar-390.png`, `demo-audio-bar-1280.png`. |
| (h) ghost-ui-reviewer on the changed UI at 390 and 1280px | PASS after one fix | Contrast, 44 px targets, keyboard and focus ring, names equal visible text, reduced motion and layout passed. One FAIL: the empty "Narration unavailable" line used `display: none`, which removes a live region from the accessibility tree. Fixed (visually hidden but present; a test guards it), plus Tab trapped in the prompt, a token colour for the prompt backdrop and more bar padding. The hidden line was re-measured (`display: block`, 1 x 1 px, absolute) and the bar is back to 205 px. The "Narration unavailable" state itself was reviewed from source only. |

### Not covered (UNVERIFIED)
- **Hearing the audio.** Nothing was heard. Whether each clip says the right thing at the right moment of its chapter is unchecked (`NARRATION_SCRIPT.md` was not in the repository).
- Other browsers: Firefox and Safari, and Safari/iOS autoplay rules. The design reuses one audio element and calls the first `play()` inside the click for this reason, but it was not run there.
- A real service worker: the bypass is tested with the real `sw.js` against a fake worker scope, and the built `dist/sw.js` contains it, but the production preview and offline mode were not run on this branch.
- Netlify: the `Cache-Control` header for `/demo-audio/*` is in `netlify.toml` and a test reads it; it was not deployed.
- 768px, and a run with reduced motion on this branch (the bar has no animation; the reviewer checked it).
- A start-up time on slower devices or Bluetooth audio: it may be longer than the 0.5 to 0.8 s measured here.