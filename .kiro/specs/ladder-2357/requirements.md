# Requirements: 2-3-5-7 revision ladder

## Introduction
Scheduling changes from SM-2 lite (1 day, 3 days, then interval x ease) to the 2-3-5-7 spaced-repetition ladder. Ghost types still follow the weakness score; ignoring a ghost now makes it look stronger.

## Requirements
1. **Ladder.** A correct answer returns the ghost after 2 days (1st), 3 (2nd), 5 (3rd) and 7 (4th and later). Answered on time, the review days are 0, 2, 5, 10, 17.
2. **Wrong answer or Reveal.** Reps go to 0, the wait to 0 and the card is due now (the ladder restarts). Weakness rules are unchanged (correct x 0.7, wrong + 0.25).
3. **Hint.** A correct answer with a hint waits half as long, as before.
4. **Late answers.** A scheduled card (reps > 0) answered later than its own wait past its due time is "late". A late correct answer keeps its reps and its wait; it does not move up. Exactly one wait late is still on time.
5. **Ignored ghosts grow.** After 1 full day overdue a ghost is drawn with extra weakness: +0.05 per further full day, capped at +0.2 (one ghost type), never above 1. The ghost drawings, the haunt meter, the weakest-rooms list and the room sort all use it. The extra is derived when drawing, never saved. Answering clears it, because the stored score is what the answer changes.
6. **Ease.** `ease` stays on every card (saved data and backups stay valid) but is never read or changed by scheduling.
7. **Old data.** No migration. Existing cards map to a rung by their `reps`.
8. **Demo.** The built-in returned cards sit on the 2-day rung. The "Run demo" time-travel step jumps two days (the store's `timeTravelDay` action called twice) and its caption says two days. The `?dev=1` "+1 day" dev button is removed: Run demo shows the time jump, and with a 2-day first rung it needed two presses. The store action `timeTravelDay` stays for the demo. A ghost-ignored step jumps five more days and its caption says "sample".
9. **Quality.** Lint, tests and build pass. Pure functions in `src/lib/srs.ts` with unit and property tests. No new dependency.