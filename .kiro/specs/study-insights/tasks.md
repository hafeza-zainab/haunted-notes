# Implementation Plan: Study Insights

## Overview

Build the feature bottom-up: types, then the pure `reviewLog` and `insights` modules with their tests, then the store wiring and migration, then the two components, CSS and the Dashboard hookup. Every task builds on the previous ones and ends wired into the Dashboard. Language: TypeScript (strict, no `any`). No new dependencies; `vitest` 5.1.0 and `fast-check` 4.10.2 are already installed.

Test sub-tasks are not marked optional: `.kiro/steering/testing.md` requires unit and property tests for every exported function in `src/lib/`, and the request asks for them. Run `npm run build` and `npm run lint` after each code task, and `npm test` after each test task. Do not edit unrelated code.

## Tasks

- [x] 1. Review log module
  - [x] 1.1 Add review types
    - In `haunted-notes/src/types.ts` add `ReviewEvent` (`t: number`, `r: string`, `c: 0 | 1`) and `ReviewLog` (`v: number`, `events: ReviewEvent[]`)
    - _Requirements: 3.2, 13.7_

  - [x] 1.2 Implement `src/lib/reviewLog.ts`
    - Export `REVIEW_LOG_VERSION = 1`, `REVIEW_EVENT_CAP = 500`, `emptyReviewLog()`, `appendReview(log, event)` and `sanitizeReviewLog(raw: unknown)`
    - `appendReview` returns a new log, builds the event with exactly the keys `t`, `r`, `c`, and keeps the newest 500 events
    - `sanitizeReviewLog` follows the 7 steps in the design: reject bad container, version or `events`; run the migration table for older versions; keep valid items only; stable sort by `t`; cap to the newest 500; never throw
    - No React, Zustand or DOM imports; no clock reads
    - _Requirements: 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 13.1, 13.2_

  - [x] 1.3 Write unit tests in `src/lib/reviewLog.test.ts`
    - Empty log; append at exactly 500 drops the oldest; `v: 2` resets; `v: 0` upgrades; `null`, a string, an array and `undefined` give an empty log; one bad item among good ones is dropped
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.4 Write property test for append
    - **Property 1: Append keeps the cap, order and event shape**
    - **Validates: Requirements 1.6, 2.1, 2.2, 2.3, 2.5, 3.3**

  - [x] 1.5 Write property test for sanitizing any input
    - **Property 2: Sanitizing any input yields a valid log**
    - Use `fc.anything()` and `fc.jsonValue()` as generators
    - **Validates: Requirements 2.2, 4.1, 4.2, 4.4, 4.6, 4.7**

  - [x] 1.6 Write property test for keeping valid events
    - **Property 3: Sanitizing keeps valid events and drops invalid ones**
    - **Validates: Requirements 2.4, 4.3**

  - [x] 1.7 Write property test for serialization round trip
    - **Property 4: Log serialization round trip**
    - **Validates: Requirements 3.4**

- [x] 2. Insights module
  - [x] 2.1 Implement day math, streak and today count in `src/lib/insights.ts`
    - Export `MS_PER_DAY`, `WINDOW_DAYS`, `dayIndex(t, tzOffsetMinutes)`, `currentStreak(events, now?, tz?)`, `reviewedToday(events, now?, tz?)`
    - Ignore events with `t > now`; streak starts today, else yesterday, else 0
    - Pure: no React, Zustand or DOM imports
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 13.1, 13.2_

  - [x] 2.2 Implement `accuracy7d` and `dailyBuckets` in `src/lib/insights.ts`
    - `accuracy7d` returns `null` for an empty window, else correct divided by total
    - `dailyBuckets` returns exactly 7 buckets, oldest first, with a deterministic weekday label computed in UTC from the day index
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.1_

  - [x] 2.3 Implement `barHeights`, `weakestRooms` and `computeInsights` in `src/lib/insights.ts`
    - `weakestRooms` uses `isBanished` from `src/lib/srs.ts`, mean `weaknessScore`, sorts by weakness descending then `noteId`, default limit 3
    - `computeInsights` combines all results into one `Insights` object
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 9.3, 9.7, 10.3_

  - [x] 2.4 Write unit tests in `src/lib/insights.test.ts`
    - Streak of 3 including today; streak continuing from yesterday; streak 0 after a 2-day gap; accuracy 3 of 4 is 0.75; an event exactly 7 days old is outside the window; empty events and empty rooms give defined results; weakest rooms tie-break; a room with only banished cards is excluded; weekday labels for a fixed `now`
    - Pass `now` and `tzOffsetMinutes` explicitly in every test
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 6.2, 7.3, 7.4, 8.3, 9.1, 10.3_

  - [x] 2.5 Write property test for the streak model
    - **Property 5: Streak matches the reference model and is never negative**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**

  - [x] 2.6 Write property test for future events and today
    - **Property 6: Streak ignores future events and never drops when today is added**
    - **Validates: Requirements 5.7, 5.4**

  - [x] 2.7 Write property test for the today count
    - **Property 7: Reviewed-today count matches the reference**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 2.8 Write property test for accuracy
    - **Property 8: Accuracy is null or between 0 and 1**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 10.3**

  - [x] 2.9 Write property test for daily buckets
    - **Property 9: Daily buckets cover seven days and agree with accuracy**
    - **Validates: Requirements 9.1, 7.4**

  - [x] 2.10 Write property test for bar heights
    - **Property 10: Bar heights are bounded and proportional**
    - **Validates: Requirements 9.3, 9.7**

  - [x] 2.11 Write property test for weakest rooms
    - **Property 11: Weakest rooms are bounded, ordered and non-empty**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.6**

- [x] 3. Checkpoint - pure modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Store wiring and migration
  - [x] 4.1 Add `reviewLog` state to `src/store/useStore.ts`
    - Add `reviewLog: ReviewLog` defaulting to `emptyReviewLog()`
    - In `answerCard`, find the card first; if missing return without changes; otherwise append `{ t: Date.now(), r: card.noteId, c }` in the same `set` call as the existing card update
    - `resetAll` sets `reviewLog` to `emptyReviewLog()`
    - Leave `loadDemoData`, `clearDemoData` and the Quiz skip path unchanged
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1_

  - [x] 4.2 Extend `onRehydrateStorage` in `src/store/useStore.ts`
    - Keep the existing SRS migration as is; add `state.reviewLog = sanitizeReviewLog(state.reviewLog)` as a separate step so a missing, corrupt or newer-version log becomes valid and notes and flashcards are kept
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8_

  - [x] 4.3 Write store tests in `src/store/useStore.test.ts`
    - Correct and wrong answers append events with the right `c` and `r`; an unknown card id appends nothing; `resetAll` clears the log; the persisted entry in localStorage contains `reviewLog` with `v: 1`; rehydrating with a missing or corrupt `reviewLog` yields an empty log and keeps flashcards
    - Use a test localStorage stub; do not depend on the real clock for assertions beyond the event existing
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 4.1, 4.8_

- [x] 5. Components, styles and Dashboard hookup
  - [x] 5.1 Move `noteTitle` into `src/lib/noteTitle.ts`
    - Move the existing helper and its `TITLE_MAX_LEN` constant from `DashboardView.tsx` unchanged, export it, and import it back in `DashboardView.tsx`; no behavior change
    - _Requirements: 8.5, 13.3_

  - [x] 5.2 Create `src/components/ReviewBarChart.tsx`
    - Props: `buckets: DayBucket[]`; inline SVG using only `svg`, `rect` and `text`; `role="img"` with an `aria-label` that states the 7-day total; bars from `barHeights`; weekday and count text labels
    - Add a `.sr-only` `<table>` with caption, header (Day, Reviews, Correct) and 7 rows
    - Show "No reviews in the last 7 days" when all counts are 0
    - No animation or transition; no inline colors, use CSS classes
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 11.2, 12.6_

  - [x] 5.3 Write render tests in `src/components/ReviewBarChart.test.tsx`
    - With `react-dom/server`: only `svg`, `rect` and `text` inside the SVG; `role="img"` and an `aria-label` present; 7 table rows in a `.sr-only` table; empty message shown for all-zero counts and hidden otherwise; a zero count renders a zero-height bar
    - _Requirements: 9.2, 9.4, 9.5, 9.7_

  - [x] 5.4 Create `src/components/StudyInsights.tsx`
    - A `<section>` named by its heading "Study insights"; read `reviewLog`, `notes` and `flashcards` from the store; call `computeInsights` with `now: Date.now()` and `tzOffsetMinutes: new Date().getTimezoneOffset()` inside `useMemo`
    - Show streak, reviewed today and accuracy ("No reviews yet" for `null`) as text in a `<dl>`; show up to 3 weakest rooms with title and "weakness N%", or the empty message; render `ReviewBarChart`
    - No buttons, no `aria-live`, no card `sentence`, `prompt` or `clozeWord` text
    - Keep logic out of the component; use a plural helper for "day streak(s)"
    - _Requirements: 5.8, 6.3, 7.5, 7.6, 8.4, 8.5, 10.1, 11.1, 11.3, 11.4, 12.3, 12.8, 13.3_

  - [x] 5.5 Write render tests in `src/components/StudyInsights.test.tsx`
    - Seed the store; empty log shows 0 streak, 0 today and "No reviews yet"; populated log shows the expected numbers; at most 3 rooms listed; no unique `clozeWord` or `sentence` marker string appears in the markup; no `aria-live`; section has an accessible name
    - _Requirements: 5.8, 6.3, 7.5, 7.6, 8.4, 8.5, 10.1, 11.1, 11.2, 12.3, 12.8_

  - [x] 5.6 Add styles to `src/index.css`
    - Add `.insights`, `.insights-stats`, `.insights-stat`, `.insights-weak`, `.chart-bar`, `.chart-baseline`, `.chart-label` using only existing tokens (`--bg-elevated`, `--accent`, `--track`, `--text`, `--text-muted`, `--border`, `--radius`); mobile-first single column at 390px, three stat columns from `min-width: 640px`; `max-width: 100%` on the SVG so there is no horizontal scroll
    - No `@keyframes` or `transition`; confirm the consolidated reduced-motion block needs no new entry
    - _Requirements: 9.8, 12.1, 12.2, 12.5, 12.6, 12.7_

  - [x] 5.7 Render the panel in `src/components/DashboardView.tsx`
    - Add `<StudyInsights />` between the summary bar and the sort controls, only when `notes.length > 0`; leave the `EmptyState` path unchanged
    - _Requirements: 10.2, 13.3_

- [x] 6. Checkpoint - feature wired in
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Final verification
  - [x] 7.1 Run the quality gates and audit the new CSS
    - Run `npm run build`, `npm run lint` and `npm test` in `haunted-notes/` and fix any failure caused by this feature
    - Search the new CSS for hard-coded colors and for `transition` or `animation`; confirm there are none
    - _Requirements: 12.1, 12.6, 13.4, 13.5, 13.6_

- [x] 8. Reviewer fixes
  - [x] 8.1 Fix ghost-ui-reviewer findings in `src/index.css`
    - (a) Change the `.chart-baseline` fill to `var(--border-strong)` so the baseline meets 3:1 contrast
    - (b) Round the off-scale spacing values in the insights block (`0.9rem`, `1.1rem`, `0.6rem`, `0.8rem`, `0.15rem`, `0.4rem`, and the `0.82rem` font size) to the nearest step of the 0.25rem scale in `.kiro/steering/design.md`
    - (c) Below 640px, make `.insights-stats` three compact columns (`grid-template-columns: repeat(3, 1fr)`) with a smaller `dd` font size, so the panel stays short at 390px
    - Add no new tap targets and no `transition` or `animation`; edit only the insights rules in `src/index.css`
    - Run `npm run build`, `npm run lint` and `npm test` in `haunted-notes/`
    - _Requirements: 12.1, 12.2, 12.6, 12.7_

## Notes

- Test tasks are required, not optional (see Overview).
- Each property test uses `fc.assert` with `numRuns` of at least 100 and a comment tag `Feature: study-insights, Property N: <title>`.
- After 7.1, run the `ghost-ui-reviewer` agent on `StudyInsights` and `ReviewBarChart` for contrast, 390px layout and reduced motion.
- Spec documents live only in `C:\dev\kiro\.kiro\specs\study-insights\`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "4.1"] },
    { "id": 3, "tasks": ["1.4", "2.3", "4.2"] },
    { "id": 4, "tasks": ["1.5", "2.4", "4.3", "5.2"] },
    { "id": 5, "tasks": ["1.6", "2.5", "5.3", "5.4"] },
    { "id": 6, "tasks": ["1.7", "2.6", "5.5", "5.6"] },
    { "id": 7, "tasks": ["2.7", "5.7"] },
    { "id": 8, "tasks": ["2.8"] },
    { "id": 9, "tasks": ["2.9"] },
    { "id": 10, "tasks": ["2.10"] },
    { "id": 11, "tasks": ["2.11"] },
    { "id": 12, "tasks": ["7.1"] },
    { "id": 13, "tasks": ["8.1"] }
  ]
}
```
