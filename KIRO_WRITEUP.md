# How Kiro was used: Haunted Notes (Kiroween 2026)

Fill in the <...> parts as you go. Only claim what you really did. Judges score "variety of Kiro tools used impactfully" and "was there experimentation".

## 1. Kiro surfaces (IDE / CLI / Web / Crew)
- Built mainly in the Kiro IDE.
- <If you tried CLI or Web, say how it differed. If not, say so honestly in one line.>

## 2. Spec-driven development vs vibe coding
What really happened (keep, it is a good story):
- First build: one large prompt ("vibe coding"). It produced a working app fast, but I had to fix several things by hand-testing: flashcard quality, audio bugs, a messy dashboard.
- Spaced repetition and demo mode: written as a proper spec (requirements, design, tasks). Kiro implemented 10 tasks and kept the task list updated.
- Then a bug the spec did not predict: new cards counted as "due". I fixed it by editing the requirement first (R4/R5), then the code.
- Later, two more features were built spec first: study-insights (review log, dashboard panel, chart) and data-safety-offline (export/import, service worker, model status). Each spec had requirements, design and a task list with correctness properties, and the tasks were run one at a time. Details are in KIRO_LOG.md.
- <Your verdict: which approach was faster, which gave fewer bugs, what you would do next time.>

## 3. Steering docs
- `.kiro/steering/product.md`: free-only, no backend, accessibility rules, palette.
- The biggest effect: <e.g. keeping Kiro from adding paid APIs or a backend; updating the network rule when Whisper was added>.
- <Add a second steering file, such as design.md or tech.md, and describe it.>

## 4. Agent hooks
- Lint on save for `.tsx` files.
- New-component test generation.
- <Say what they actually caught or saved. Confirm they show up in Kiro's Agent Hooks panel.>

## 5. MCP
- Playwright MCP (config in .kiro/settings/mcp.json) was used in earlier sessions for runtime checks at 390px; results are in KIRO_LOG.md. The autopilot run could not start a dev or preview server from its shell, so it did not use the browser and its runtime checks are marked UNVERIFIED.
- <What the browser access let Kiro do that it could not do before.>

## 6. Property-based testing
- <Properties tested on `src/lib/srs.ts` (interval never decreases after correct answers, ease never below 1.3, wrong answer resets reps).>
- Property-based testing. I enabled PBT on the two pure modules, srs.ts and cloze.ts, using vitest and fast-check, with a steering file (testing.md) that makes Kiro write properties for anything under src/lib/. The properties covered review scheduling (interval never decreases after correct answers, ease never below 1.3, a wrong answer resets reps) and card generation (the blank is never a stopword or a number, the prompt never contains the answer). PBT found two bugs my manual testing had missed: a date range like 2020-2024 could become the blank, and only the first occurrence of the answer was blanked, leaving it visible later in the sentence. Both were fixed, and the minimal failing examples are in KIRO_LOG.md.
- Property tests in the autopilot run found one more bug: sanitizeReviewLog hung on a hugely negative schema version, because the migration loop ran from that version up to 1 (fixed). A property test on weakestRooms found that a NaN weakness score produced a NaN result (fixed). Adversarial tests on stored state found that wrong-shape localStorage JSON and a quota error could break the store (both fixed).


## 7. Custom agents / Kiro powers
- ghost-ui-reviewer (.kiro/agents/ghost-ui-reviewer.md): a read-only UI reviewer that checks contrast, 44px targets, keyboard access, aria, reduced motion and 390px layout against design.md. On the study-insights panel it reported a chart baseline at about 1.2:1 contrast, off-scale spacing and a tall panel at 390px, all fixed afterwards. On the backup, model status and insights UI it reported no hard FAIL. Both runs were static because no server was running.
- No Kiro power was used.

## 8. Debugging stories (good evidence of real use)
- Whisper looping on one repeated token: traced to WebGPU with the quantized model plus no repetition guards. Fixed with WASM only, `no_repeat_ngram_size`, normalized mono audio and a hallucination filter.
- Quiz Skip frozen on the last card: React skipped the re-render because every state reset was a no-op. Fixed with a render-trigger counter.
- Quiz repeating questions: the queue was rebuilt from the live store; fixed with a frozen snapshot of card IDs.

## 9. Credits strategy
- Free tier covered the core build; <how you spent the hackathon credits>.
