---
inclusion: fileMatch
fileMatchPattern: "src/lib/**"
---

# Haunted Notes: Testing Rules

Applies when working on files in `src/lib/`.

## Requirements
- Every exported pure function in `src/lib/` must have BOTH:
  - unit tests (vitest) for concrete examples and edge cases, and
  - property-based tests (fast-check) for invariants that must hold for all inputs.
- Test files sit next to the module: `src/lib/srs.test.ts`, `src/lib/cloze.test.ts`.
- Pass `now` explicitly in tests. Never depend on the real clock.
- Keep tests deterministic: seed fast-check or use `fc.assert` with a fixed `seed`
  when reproducing a failure.

## Invariants worth encoding
- `srs.ts`: ease never below 1.3; interval never decreases over consecutive correct
  answers; a wrong answer sets `reps` to 0 and `dueAt` to now; `isDue` is false when
  `reps` is 0; `dueAt` moves forward after a correct answer.
- `cloze.ts`: the blank is never a stopword or a number; the prompt never contains the
  answer; no card is made from fewer than 8 words.

## Workflow
- When a property test finds a real bug, fix the code, keep the failing case as a
  regular unit test, and note it in `KIRO_LOG.md`.
- Run with `npm test` (single run, not watch mode).
- Note: vitest and fast-check are added to the project in the A3 prompt. Until then,
  write tests but do not assume the runner exists.
