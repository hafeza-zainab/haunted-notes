# Kiro evidence index

Every statement below comes from [KIRO_LOG.md](../haunted-notes/KIRO_LOG.md), [KIRO_WRITEUP.md](../KIRO_WRITEUP.md) or a file in this repository. Where there is no evidence the section says NOT USED or lists the gap.

## 1. Kiro surfaces (IDE, CLI, Web, Crew)

- **IDE: used.** The app was built mainly in the Kiro IDE ([write-up, section 1](../KIRO_WRITEUP.md)). Specs, steering, hooks, the custom agent and the MCP config all live under [.kiro/](../.kiro/).
- **CLI: NOT USED** (no evidence in the repo).
- **Web: NOT USED** (no evidence in the repo).
- **Crew: NOT USED.** No Crew app was built.

## 2. Custom agent

- [ghost-ui-reviewer](../.kiro/agents/ghost-ui-reviewer.md) is a report-only UI reviewer. Its tools are `["read", "@playwright"]`, so it cannot edit files or run shell commands. It reads [design.md](../.kiro/steering/design.md) first, then checks AA contrast, 44px targets, keyboard access, aria labels, reduced motion and 390px layout.
- First measured run (dashboard and quiz at 390px): FAIL on white-on-accent text at 3.99:1, active nav and sort labels at about 2.9 to 3.1:1, missing focus rings on three controls, and label-in-name on three buttons. These were fixed afterwards (section "Fixes from the ghost-ui-reviewer report" in the log).
- Later runs: on the haunting-atmosphere work it found a real answer leak (see section 4). On the study-insights panel (static, no browser) it found a chart baseline at about 1.2:1 contrast, off-scale spacing and a tall panel at 390px, fixed in commit `ec66685`.
- Known limits, recorded in the log: the ban on `browser_run_code_unsafe` is enforced by its prompt only, and the first run was static because the dev server was stopped.

## 3. Agent hooks

Four v1 hooks in [.kiro/hooks/](../.kiro/hooks/):

| Hook file | Trigger | Does |
|---|---|---|
| [test-on-lib-save.json](../.kiro/hooks/test-on-lib-save.json) | save `src/lib/**/*.ts` | runs `npm test` |
| [lint-fix-on-tsx-save.json](../.kiro/hooks/lint-fix-on-tsx-save.json) | save `src/**/*.tsx` | runs `eslint --fix` on the file |
| [test-for-new-component.json](../.kiro/hooks/test-for-new-component.json) | create `src/components/*.tsx` | writes a render test |
| [reduced-motion-check-on-css-save.json](../.kiro/hooks/reduced-motion-check-on-css-save.json) | save `src/**/*.css` | lists motion with no reduced-motion override |

- The original two hooks were replaced because their matchers were over-escaped, one piped to `tail` (not in PowerShell) and one asked for a library that is not installed ([log, "A2: Hooks that really run"](../haunted-notes/KIRO_LOG.md)).
- **Reduced-motion hook finding:** it reported about 15 `transition` rules and `scroll-behavior: smooth` with no override. This led to one consolidated `prefers-reduced-motion` block in `index.css` ([log, "Hook finding fixed: reduced motion"](../haunted-notes/KIRO_LOG.md)).
- **Earlier hook:** the original lint hook caught a type error in `speech.ts` and an unused React import during save.
- **During the autopilot run** the sub-agents reported the test hook, the ESLint hook and the reduced-motion hook firing after saves. One test-hook run showed a missing import in a new property test, which was fixed.
- **Gap:** the log says the hooks' appearance in the Agent Hooks panel was not confirmed.

## 4. Spec-driven development

Specs in [.kiro/specs/](../.kiro/specs/):

| Spec | Notes |
|---|---|
| [haunted-notes.md](../.kiro/specs/haunted-notes.md) | requirements, design, tasks. Fixed cloze deletion (no LLM) and Zustand with persist |
| [srs-and-demo.md](../.kiro/specs/srs-and-demo.md) | spaced repetition and demo mode. Kiro implemented 10 tasks |
| [haunting-atmosphere.md](../.kiro/specs/haunting-atmosphere.md) | five ghost types, atmosphere layer, haunted level, reduced motion |
| [better-quiz.md](../.kiro/specs/better-quiz.md) | hints, reveal, typo tolerance, streak, results screen |
| [study-insights/](../.kiro/specs/study-insights/) | requirements, design, tasks; review log and dashboard panel |
| [data-safety-offline/](../.kiro/specs/data-safety-offline/) | requirements, design, tasks; export/import, service worker, model status |
| [demo-autoplay/](../.kiro/specs/demo-autoplay/) | requirements, design, tasks; the self-playing "Run demo" that replaced the 60-second tour. Correctness properties: exact restore after any abort point, idempotent recovery on load, corrupt snapshot never throws |

What the specs prevented or exposed:
- **Spec edited before code:** new cards were being counted as "due". The requirement (R4/R5) was corrected first, then the code ([write-up, section 2](../KIRO_WRITEUP.md)).
- **Spec work exposed a real answer leak:** while checking the haunting-atmosphere spec, the reviewer found the demo "Content" card showing its answer in the prompt, aria-label and text, because `demoData.ts` had its own non-global replace. Fixed with a global replace and a test.
- **Property correctness written into the spec:** study-insights and data-safety-offline each list correctness properties (11 and 16), and tests were written against them. These exposed the bugs in section 6.
- **Not verified:** two spec tasks (offline reload and import safety in a real browser) are marked complete only because the spec allows logging them as UNVERIFIED. They were not run.
- Vibe-coded first build: the write-up records that a single large prompt produced a working app fast but needed manual fixes (flashcard quality, audio bugs, a messy dashboard).

## 5. Steering docs

In [.kiro/steering/](../.kiro/steering/):
- [product.md](../.kiro/steering/product.md): `inclusion: always`. Free only, no backend, accessibility rules, palette, and the allowed network calls. It was updated when Whisper was added.
- [tech.md](../.kiro/steering/tech.md): `inclusion: always`. Stack, allowed network calls, lazy-loaded heavy libraries, pure logic in `src/lib`, exact version pinning.
- [design.md](../.kiro/steering/design.md): `fileMatch` on `src/**/*.tsx` and `src/**/*.css`. Tokens, spacing scale, contrast and tap-target rules. The custom agent reads it.
- [testing.md](../.kiro/steering/testing.md): `fileMatch` on `src/lib/**`. Requires unit and property tests with `now` passed explicitly. It shaped the property tests in section 6.

Effect, from the log: steering enforced accessibility and single-responsibility components without per-component reminders, and kept heavy libraries out of the main bundle.
Dependencies in `haunted-notes/package.json` are pinned to exact versions, as `tech.md` asks (see [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md), item 8).

## 6. Property-based testing

Tools: `vitest@5.1.0` and `fast-check@4.10.2`, both pinned exactly. Property tests (files with `fc.assert`) are in `haunted-notes/src/lib/`:
[srs.test.ts](../haunted-notes/src/lib/srs.test.ts), [cloze.test.ts](../haunted-notes/src/lib/cloze.test.ts), [answer.test.ts](../haunted-notes/src/lib/answer.test.ts), [blank.test.ts](../haunted-notes/src/lib/blank.test.ts), [quizRound.test.ts](../haunted-notes/src/lib/quizRound.test.ts), [haunt.test.ts](../haunted-notes/src/lib/haunt.test.ts), [reviewLog.property.test.ts](../haunted-notes/src/lib/reviewLog.property.test.ts), [insights.property.test.ts](../haunted-notes/src/lib/insights.property.test.ts), [backup.test.ts](../haunted-notes/src/lib/backup.test.ts), [swStamp.test.ts](../haunted-notes/src/lib/swStamp.test.ts), [offlineStatus.test.ts](../haunted-notes/src/lib/offlineStatus.test.ts), [ocrPixels.test.ts](../haunted-notes/src/lib/ocrPixels.test.ts), [persistedState.test.ts](../haunted-notes/src/lib/persistedState.test.ts), [adversarial.test.ts](../haunted-notes/src/lib/adversarial.test.ts).

Bugs the tests found:

| # | Bug | Minimal failing example | Fix |
|---|---|---|---|
| 1 | A number became the blank | `java a a 2020-2024 a java 42 java.` gave the blank `2020-2024` | tokens with no letters are rejected |
| 2 | The prompt leaked the answer | `Java java. - java java 42 java Java.` left repeats visible | replacement made global |
| 3 | `sanitizeReviewLog` hung on a hugely negative schema version (the migration loop ran from `v` up to 1). It also made the full test run time out | a log with `v` such as `-2**31` | versions below 0 return an empty log |
| 4 | `weakestRooms` returned a NaN weakness | one note `n1`, one card with `weaknessScore: NaN` | non-finite scores count as 0, scores clamped to [0, 1] |
| 5 | Wrong-shape JSON in localStorage broke loading | `flashcards: null`, `flashcards` as an object, `notes` as a string, a `null` card inside `flashcards` (4 of 8 cases failed) | new `persistedState.ts` and a validating `merge` on the store |
| 6 | A storage quota error escaped store actions | `setItem` throwing `QuotaExceededError` inside `addNote` | `safeStorage` wrapper |

Properties that found no bug: `srs.ts` (the log records none), the backup validator and merge (round trip, totality, prototype safety, idempotence), service worker stamping and model status. Bugs 1 and 2 are in the log; bugs 3 to 6 are in the autopilot section of the log.

## 7. MCP

- [.kiro/settings/mcp.json](../.kiro/settings/mcp.json) configures the `playwright` server, pinned to `@playwright/mcp@0.0.85`, headless and isolated, using a cached Chromium.
- Used for: the demo quiz flow, the `?dev=1` "+1 day" button, screenshots at 1280px and 390px, a reduced-motion run, and the hint, reveal and results checks in the better-quiz spec ([log, "Playwright MCP setup" and "B2: Better quiz"](../haunted-notes/KIRO_LOG.md)). Screenshots are in [docs/screens/](screens/).
- The custom agent uses the same server for contrast and tap-target measurements.
- **Tools called in the A5 run** (list supplied by the repository owner from the A5 report; the report file itself is not in this repository, so this list is not independently checkable): `browser_navigate`, `browser_snapshot`, `browser_console_messages`, `browser_click`, `browser_type`, `browser_take_screenshot`, `browser_find`, `browser_resize`, `browser_evaluate`, `browser_emulate_media`, `browser_run_code_unsafe`.
- Note: [ghost-ui-reviewer](../.kiro/agents/ghost-ui-reviewer.md) forbids `browser_run_code_unsafe` and its allowed list has no `browser_click` or `browser_type`, so this list belongs to the main agent's A5 run, not to the custom agent.
- **Gaps:** the log did not record tool names before this entry. The autopilot run could not start a server from its shell, so its browser checks are UNVERIFIED. The config contains a path to Chromium on the author's machine.

## 8. Kiro powers

- **NOT USED.** No power was installed or installable from the session ([log, "A7: Kiro power (skipped)"](../haunted-notes/KIRO_LOG.md)). The agent file sets `includePowers: false`.

## Open gaps

- CLI, Web and Crew usage: none.
- MCP tool names were not recorded when the calls were made; the list in section 7 comes from the owner's A5 report.
- The hooks' presence in the Agent Hooks panel is not confirmed.
- Browser checks for offline behavior, import safety and the final chart layout are UNVERIFIED until `npm run dev` is running (a later browser pass is planned).