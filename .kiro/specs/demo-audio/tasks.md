# Tasks: narration inside "Run demo"

- [ ] 1. Rename the nine clips to `chapter-N.wav` (content unchanged, hashes checked); measure durations in the browser; write `manifest.json`
- [ ] 2. Script: chapter ids, 2 s hold in the end step; `demoNarration.ts` (windows, fit report) with tests
- [ ] 3. `demoNarrator.ts` with a fake audio object, unit and property tests
- [ ] 4. Runner: one audio element, sync at chapter starts, Pause/Resume/Stop, sound flag, `?sound=0`
- [ ] 5. Bar: Sound button, "Narration unavailable"; player: "Start with sound" prompt for `?demo=1`
- [ ] 6. `sw.js` bypass, `netlify.toml` header, swStamp tests; source-scan test allows only a `/demo-audio/` Audio
- [ ] 7. Browser verification (a to h of the brief), `DEMO_TIMING.md`, README, `DEMO_SCRIPT.md`, `BROWSER_CHECKS.md`, log