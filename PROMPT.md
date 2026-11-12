# Haunted Notes: Kiro prompt pack (Nov 12 onward)

Rules for using this pack:
- One prompt at a time. After each: `npm run build`, test it by hand for 2 minutes, then commit and push.
- Prompts marked SPEC go into a new Kiro spec (requirements, then design, then tasks). Read the requirements before approving, and delete anything extra.
- Every prompt ends with "Do not change anything else." on purpose. It keeps Kiro from breaking working features.
- Log each one in KIRO_LOG.md (a one-line entry is enough). The write-up is scored on this.

---

## Phase 0: Manual (no credits)
1. `git pull origin main` in C:\dev\kiro.
2. Make sure `steering/product.md` lives in `.kiro/steering/`.
3. Open Kiro's Agent Hooks panel and check your 2 hooks are listed. If not, A2 below fixes it.
4. Commit.

---

## Phase A: Must-haves (Kiro depth is 20% of the score)

### A1. More steering files
```
Create three steering files in .kiro/steering/ and leave app code untouched:
- design.md (inclusion: fileMatch for src/**/*.tsx and src/**/*.css): dark spooky palette
  tokens, spacing scale, ghost animation rules, prefers-reduced-motion required, min
  contrast AA, one accent glow color.
- tech.md (inclusion: always): React + Vite + TypeScript + Zustand, no backend, no
  paid services, heavy libs (Whisper, Tesseract) must be lazy-loaded, keep logic in
  pure modules under src/lib.
- testing.md (inclusion: fileMatch for src/lib/**): pure functions must have
  property-based tests (fast-check) and unit tests (vitest).
Do not change anything else.
```

### A2. Hooks that really run
```
Create agent hooks using Kiro's own hook format so they appear in the Agent Hooks
panel (replace the two old .json files if they do not appear):
1. On save of src/lib/**/*.ts: run the vitest tests for that file and report failures.
2. On save of src/**/*.tsx: run eslint --fix on the saved file.
3. On creation of a new component in src/components: generate a basic render test.
4. On save of src/**/*.css: check that every animation has a prefers-reduced-motion
   override and list any that do not.
Do not change anything else.
```

### A3. Property-based tests (SPEC recommended)
```
Add vitest and fast-check as dev dependencies and an "npm test" script. Write
property-based tests for src/lib/srs.ts: interval never decreases after consecutive
correct answers; ease never goes below 1.3; a wrong answer always sets reps to 0 and
dueAt to now; isDue is false whenever reps is 0; dueAt always moves forward after a
correct answer. Add property tests for src/lib/cloze.ts: the blank is never a stopword
or a number; the prompt never contains the answer; no card is created from fewer
than 8 words. Fix any real bugs the tests reveal, and list them in KIRO_LOG.md.
Do not change anything else.
```

### A4. Banished means banished
```
After a correct answer a ghost counts as banished and leaves the room's haunting grid,
returning only when SRS dueAt passes. Define banished as reps > 0 and dueAt in the
future. Update dashboard counts, the room progress bar and the spec. Do not change the
quiz queue logic. Do not change anything else.
```

### A5. MCP server (free)
```
Set up the Playwright MCP server in the workspace MCP config (.kiro/settings/mcp.json).
Then use it to: open http://localhost:5173, click "Try demo", run a full quiz round
(one correct, one wrong, one skip), open ?dev=1 and press +1 day, and take screenshots
of the dashboard and quiz at 1280px and 390px widths. Report any visual bugs, console
errors and layout overflow. Save screenshots to docs/screens/. Do not change app code
yet, only report.
```
Then paste the findings into a follow-up prompt: "Fix the issues you found, smallest change each."

### A6. Custom agent
```
Create a custom agent called "ghost-ui-reviewer". It reviews changed React components
against .kiro/steering/design.md: contrast, motion, keyboard access, mobile layout at
390px. It must output a short checklist and only suggest fixes, not edit files. Put it
where Kiro keeps custom agents for this app type, and tell me how to invoke it.
```
Use it after each polish prompt in Phase B and note what it caught.

### A7. Kiro powers
Open the Powers panel in Kiro and install one free power that fits (for example for testing or React). Then:
```
Use the installed power to review the project for best-practice gaps. List findings
first; do not edit. Do not change anything else.
```
Note in KIRO_WRITEUP.md which power and what it changed.

---

## Phase B: Features and polish (SPEC each, one at a time)

### B1. Haunting atmosphere (Design 20%)
```
SPEC: Haunting atmosphere. Requirements: five visually distinct ghost types (chosen by
card weakness: wisp, ghoul, banshee, phantom, poltergeist) as SVG with different eyes,
shape and glow; subtle fog layers and flicker on the background; a satisfying banish
animation (dissolve into particles plus soft sound); returned ghosts look different
(orange aura, shake in); a haunted-level meter in the header (more weak ghosts means
a darker room). All motion honors prefers-reduced-motion. Sound is off by default and
toggled from the header. Keep bundle size small: no animation libraries.
```

### B2. Quiz upgrades
```
SPEC: Better quiz. Add: a Hint button (reveals first letter, then length), a Reveal
button (counts as wrong), tolerance for small typos (edit distance 1 for answers of 6
or more letters), and a results screen listing the missed cards with correct answers
and a "Review missed" button. A streak counter for correct answers in a row.
```

### B3. Insights and progress
```
SPEC: Study insights. Add a progress panel on the dashboard: current streak in days,
cards reviewed today, accuracy over the last 7 days, and the 3 weakest rooms. Store
review events compactly in localStorage with a cap of 500 events. Include a simple
bar chart in plain SVG, no chart library.
```

### B4. Data safety and offline
```
SPEC: Data safety and offline. Add Export (JSON download) and Import (merge, with
confirm) for notes, cards and review history. Make the app an installable PWA that
works offline after the first load, caching the app shell. The Whisper model is cached
by the browser, so show whether it is ready offline in the audio tab.
```

### B5. Faster first load (judges notice this)
```
Lazy-load Whisper (transformers.js) and Tesseract.js so they are only fetched when the
Audio or Photo tab is first used. Show a small skeleton while loading. Target: main
bundle under 250 KB gzipped. Report bundle sizes before and after in KIRO_LOG.md.
Do not change anything else.
```

### B6. Input quality
```
Improve OCR: remove the hard threshold in src/lib/ocr.ts; use grayscale, 2x upscale
(max width 2500px) and a mild contrast boost only. Add a note that it works best with
printed text. Also add an optional language switch in the Audio tab: English (fast,
whisper-tiny.en) or Multilingual (whisper-tiny with language auto-detect). Do not
change anything else.
```

### B7. Mobile and accessibility pass
```
Audit and fix at 390px width and on keyboard only: no horizontal scroll, tap targets at
least 44px, focus rings visible, quiz fully usable with Tab/Enter, aria-live on quiz
feedback and on transcription progress, labels on all inputs. Report what you changed
in KIRO_LOG.md. Do not change anything else.
```

---

## Phase C: Finish (before Dec 1)
1. Run the "ghost-ui-reviewer" on the whole app, and run A5 again with Playwright MCP on the finished app.
2. Prompt: `Update README.md, KIRO_LOG.md and KIRO_WRITEUP.md to reflect the real final features, tests, hooks, MCP, agent and power I used. Do not invent anything not present in the repo.`
3. Prompt: `Run lint, tests and build. Fix only failures. Do not change anything else.`
4. Deploy to Netlify, test the live site on phone and desktop.
5. Record the demo (under 3 minutes, YouTube public), write the blog post and the social post (starts with #KiroweenHackathon26).
6. Submit by the afternoon of Dec 4 IST.

## Suggested order if time is short
A4, A3, A1, A2, A5, B5, B1, B2, then the rest. These cover the Kiro usage the judges ask about, plus the biggest design gains.