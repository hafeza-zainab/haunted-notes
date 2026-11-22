# Browser checks

Branch `prize-prep-2`. Date of this report: the P2/P5/P7 session.

**No browser check has been run yet.** Nothing was listening on port 5173 (dev) or 4173 (preview), and the agent shell refuses to start servers. Every item below that needs a browser is UNVERIFIED. To run them, start `npm run dev` (and later `npm run preview`) in `haunted-notes/` and ask for P1 again.

Status: PASS = checked. FAIL = checked and broken. UNVERIFIED = not run.

## P1. Pending checks

| # | Check | Status | Notes |
|---|---|---|---|
| 1.1 | Insights panel height at 1280px under about 220px | UNVERIFIED | Code caps the chart at 140px and uses two columns from 1024px. The reviewer's static estimate was 230 to 240px before trimming. |
| 1.2 | No horizontal scroll at 390, 768 and 1280px | UNVERIFIED | |
| 1.3 | Chart labels 12 to 14px at every width; weekday labels fit at 360px | UNVERIFIED | Labels are 12px and counts 13px in a viewBox drawn at container width (240 to 512px), so 1 unit is 1px. |
| 1.4 | Screenshots `insights-fixed-390.png`, `-768.png`, `-1280.png` | UNVERIFIED | Not taken. |
| 1.5 | Try demo, quiz round (correct, wrong, hint, reveal, skip), Review missed; dashboard, streak and chart update | UNVERIFIED | Store and render tests cover the review log and insights numbers. |
| 1.6 | Console clean on every view | UNVERIFIED | |
| 1.7 | Export, then import the same file: dialog says nothing new | UNVERIFIED | Covered by merge idempotence property tests and a maximum-size test. |
| 1.8 | Import a file with a script tag in a note title: shown as text, never runs | UNVERIFIED | Covered statically: React text rendering only, and a source scan test bans HTML-injection APIs in the backup components. |
| 1.9 | ghost-ui-reviewer on dashboard, quiz, add note, results, insights, backup | PARTIAL | Static run on the new UI (strip, tour, load notice, chart). One FAIL fixed, see below. Earlier static run on backup and model status had no hard FAIL. No measured browser run. |

## P2. Frankenstein strip

| Check | Status | Notes |
|---|---|---|
| Render test | PASS | `StitchStrip.test.tsx`: caption, 4 inputs, 3 stages in order, no interactive elements, all 3 arrows `aria-hidden`. |
| Static review (contrast, aria, motion) | PASS | Text 13.7:1 and muted 5.33:1 on `--bg-surface`; stage chip borders 3.9:1; the only transform is a static 90 degree arrow rotation on narrow screens. |
| Screenshots `frankenstein-strip-390.png`, `-1280.png` | UNVERIFIED | Not taken. |
| Layout at 390px and 1280px | UNVERIFIED | |

## P5. Netlify deploy config

| Check | Status | Notes |
|---|---|---|
| `netlify.toml` present with base, command, publish, headers, SPA fallback | PASS | Header paths match built files: `dist/sw.js`, `dist/manifest.webmanifest`, `dist/assets/*`. |
| Service worker with the base path: build, preview, load, go offline, reload, Try demo | UNVERIFIED | Preview could not be started. The app is served from the site root, so the worker scope is `/`. |
| Real Netlify deploy and header check | UNVERIFIED | Not deployed. |

## P7. 60-second tour

| Check | Status | Notes |
|---|---|---|
| Pure step list test | PASS | `tour.test.ts`: 5 steps in order, unique ids, text at most 120 characters, no demo answer, step logic property. |
| Store tests | PASS | `useStore.tour.test.ts`: loads demo once, walks 5 steps, quiz step opens an unfiltered quiz, closes after the last, not persisted. |
| Render tests | PASS | `TourCoach.test.tsx`: `role="dialog"` named by the step title, Next and Skip tour, Finish on the last step, no demo answer in any step. |
| Static review: focus, Escape, aria, 44px, reduced motion | PASS | Focus moves to the panel each step and returns to `#main-content` on close; Escape closes; buttons 44px; no animation. |
| Panel covering its target at 390px | FIXED, UNVERIFIED | Reviewer FAIL (static estimate). Targets now scroll to just below the nav (`block: 'start'`, `scroll-margin-top: 5rem`) and `main` gets bottom padding while the tour is open. Not measured. |
| Check at 390px and 1280px with Playwright | UNVERIFIED | |
