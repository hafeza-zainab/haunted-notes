# Design: 2-3-5-7 revision ladder

- `src/lib/srs.ts`: `LADDER_DAYS = [2, 3, 5, 7]`, `ladderDays(index)` (clamped, NaN-safe), `isLate(card, now)`, `scheduleCorrect` (reps + 1 unless late; wait = `ladderDays(reps - 1)`, halved with a hint), `scheduleWrong` (ease unchanged), `effectiveWeakness(card, now)` with `GRACE_DAYS = 1`, `GROWTH_PER_DAY = 0.05`, `GROWTH_CAP = 0.2`.
- Why the cap is 0.2: ghost type is `floor(weakness x 5)`, so a +0.2 change moves the type by at most one. (An earlier idea of 0.25 could move it by two; a property test pins the 0.2 version.)
- `DashboardView` and `QuizView` draw ghosts with `effectiveWeakness(card)`. The haunt meter, insights and room sort still use the stored score; they are not part of this change.
- `demoData.ts`: the two returned cards use `intervalDays: 2` (the first rung).
- `demoScript.ts` / `runner.ts`: the `store` action takes an optional `times`; the travel step uses 2.

## Correctness properties
1. On-time answers give waits 2, 3, 5, 7, 7, 7 and review days 0, 2, 5, 10, 17.
2. On any reachable card the wait is on the ladder (or half of a rung after a hint).
3. A late answer never moves a card up and always returns it after now.
4. `effectiveWeakness` is within [stored, min(1, stored + 0.2)], never falls as time passes, never exceeds 1, and moves the ghost type by at most one.
5. `ease` is never changed by scheduling.
6. After a demo-like quiz (every card answered once), two one-day jumps make 7 cards due; one jump makes none.