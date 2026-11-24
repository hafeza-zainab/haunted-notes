# Tasks: self-playing "Run demo"

Run `npm run lint`, `npm test` and `npm run build` before each commit. Commit after each numbered part. Never push.

- [ ] 1. Snapshot module (R5)
  - [ ] 1.1 `src/lib/demoSnapshot.ts`: take, serialize, parse, write, recover
  - [ ] 1.2 Unit tests and fast-check property tests (exact restore, round trip, idempotent recovery, corrupt input)
- [ ] 2. Store changes (R5, R6)
  - [ ] 2.1 Add `demoRunning`, `beginDemoRun`, `endDemoRun`; pause persisted writes; exclude `demoRunning` from persistence (tour state is removed in part 6, with its component)
  - [ ] 2.2 Recover a leftover snapshot in `main.tsx` before render
  - [ ] 2.3 Store tests (replace `useStore.tour.test.ts`)
- [ ] 3. Script data (R2)
  - [ ] 3.1 `src/lib/demoScript.ts`: nine chapters, timeline helpers, clock format
  - [ ] 3.2 Tests: total 140 to 170 s, captions at most 12 words, no answers, Kiro facts
- [ ] 4. `data-demo` attributes on views (R3.1)
  - [ ] 4.1 NavBar, AddNoteView, DashboardView, EmptyState, QuizView, BackupPanel (plus privacy line), StudyInsights, ReviewBarChart, HauntMeter, GhostSvg, StitchStrip
  - [ ] 4.2 Test that every script target exists in the rendered views
- [ ] 5. Runner (R1, R3, R4, R5)
  - [ ] 5.1 `src/demo/domActions.ts` and `src/demo/runner.ts`
  - [ ] 5.2 Photo tab skips the OCR load while a run is active
  - [ ] 5.3 Source scan test
- [ ] 6. UI (R1, R4)
  - [ ] 6.1 `DemoBar`, `DemoCard`, `DemoPlayer`, `RunDemoButton`, CSS
  - [ ] 6.2 Replace the three tour buttons; delete `TourCoach`, `tour.ts` and their tests and CSS
  - [ ] 6.3 Control bar tests
- [ ] 7. Docs (R6): README, KIRO_EVIDENCE, SUBMISSION_CHECKLIST, DEMO_SCRIPT, BROWSER_CHECKS, KIRO_LOG
- [ ] 8. Browser verification (R7): 1280px and 390px full runs, Stop, finish, reload mid-run, console, measured total, ghost-ui-reviewer on the bar, screenshots `demo-autoplay-*`
