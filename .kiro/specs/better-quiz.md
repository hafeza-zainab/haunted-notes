# Better Quiz: Spec

Builds on `haunted-notes.md`, `srs-and-demo.md` and `haunting-atmosphere.md`. Changes the quiz only.

## Requirements

**R1: Hint.** A Hint button. First press shows the first letter of the answer; second press also
shows the length. Further presses do nothing. A hinted correct answer still banishes the ghost,
but schedules a shorter next interval than an unhinted correct answer (half as long, never zero).

**R2: Reveal.** A Reveal button shows the answer and counts as a wrong answer (ghost does not
banish, card goes to the missed list). The user then presses Next.

**R3: Typo tolerance.** For answers of 6 or more letters (after normalisation), an answer within
edit distance 1 is accepted and counts as correct; the feedback says "Close enough!". Shorter
answers must match exactly after normalisation. Pure function in `src/lib/answer.ts` with
property tests.

**R4: Streak.** The quiz header shows the current streak of correct answers in a row. A wrong
answer or a reveal resets it; a skip leaves it unchanged.

**R5: Results screen.** The end-of-round screen lists the missed cards (answered wrong or
revealed) with their correct answers, shows the best streak, and has a "Review missed" button
that starts a new round with only those cards.

**R6: Accessibility.** All new controls are at least 44px on mobile; every aria-label contains
the visible text (no aria-label needed for plain text buttons); hint and feedback text are in
`aria-live` regions; no new animation (reduced motion is trivially respected).

**R7: Do not break.** The fixed `_____` blank, the answer-leak fixes (the full answer must not be
in the DOM before answering, including after a hint: only the first letter and the length may
appear), and the queue snapshot (each round's order and length are frozen when it starts).

## Design

- `src/lib/answer.ts` (pure): `normaliseAnswer`, `judgeAnswer(input, answer)` returning
  `'exact' | 'close' | 'wrong'`, `hintFor(answer, level)`.
- `src/lib/srs.ts`: `scheduleCorrect(card, now, hinted)`; hinted interval is half of the normal one.
- `src/lib/quizRound.ts` (pure): `nextStreak`, `addMissed`.
- Store: `answerCard(cardId, correct, hinted?)`. No persisted-shape change, so no migration.
- `QuizView`: hint level, streak, best streak and missed ids as local state; the queue is a
  state snapshot that `Review missed` replaces with the missed ids.
- Focus: Reveal moves focus to Next; the Hint button uses `aria-disabled` at its maximum so focus
  is never lost.

## Tasks

1. [ ] `answer.ts` plus property tests (exact, close, wrong, hint never contains the answer).
2. [ ] Hinted scheduling in `srs.ts` plus property tests.
3. [ ] `quizRound.ts` plus tests.
4. [ ] Store: `answerCard` takes `hinted`.
5. [ ] `QuizView`: Hint, Reveal, typo tolerance, streak, results screen, Review missed.
6. [ ] CSS for hint, streak and missed list (tokens only).
7. [ ] Lint, tests, build; ghost-ui-reviewer; Playwright at 390px and 1280px (hint, reveal, typo, results); fix only FAILs; log it.
