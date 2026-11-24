# Requirements: narration inside "Run demo"

## Introduction
Nine narration clips (one per chapter of the Run demo script) play in sync with the run, so a screen recording with desktop audio contains the narration, and any visitor who clicks Run demo hears it. Captions always stay visible. A failed clip never stops the run.

Glossary: **clip** = `public/demo-audio/chapter-N.wav` (N = 1 to 9, the chapter order). **manifest** = `public/demo-audio/manifest.json` (file name and measured `durationMs` per chapter id). **narrator** = the pure controller in `src/lib/demoNarrator.ts`. **headroom** = chapter length minus clip length.

## Requirements
1. **Manifest.** `manifest.json` lists, for each chapter id of the script (same count, ids and order), its file name and `durationMs`. Durations are measured with `audio.duration` in a real browser, never guessed. The runner does not fetch the manifest; it derives `/demo-audio/chapter-N.wav` from the chapter number. Tests tie the two together.
2. **Sync.** A clip starts at the absolute scheduled start of its chapter. Pause and Resume pause and resume the audio. Stop, Escape, finish or an error stop it, reset it and release it. Two clips never play at once (one audio element is reused).
3. **Fit.** A clip must be at most the chapter length minus 0.4 s. A clip that does not fit is never cut silently: it is reported in `docs/DEMO_TIMING.md` and fixed with a hold in the script data (total stays under 2:55) or by shortening the narration text. A data test checks every clip against the manifest. Because the browser needs time to start its audio output (measured up to 0.8 s), a second data test also requires 1 s of start-up allowance on top of the 0.4 s.
4. **Sound toggle.** A "Sound on / Sound off" button in the bar: at least 44px, visible text equals its accessible name, state shown by text. Default on, in memory only, `?sound=0` starts muted. Captions stay visible either way.
5. **Autoplay policy.** A click on Run demo can start sound. `?demo=1` has no click, so it shows one "Start with sound" button (44px, focused, Escape cancels). `?demo=1&sound=0` starts silently by itself. The policy is not bypassed.
6. **Failure is not fatal.** If a clip fails to load or play, the run continues with captions only and the bar shows "Narration unavailable" once (`role="status"`). Nothing throws, data is still restored.
7. **Service worker and hosting.** `/demo-audio/` is bypassed by `public/sw.js` (media sends range requests) and is not precached. `netlify.toml` sends `Cache-Control: public, max-age=3600` for `/demo-audio/*`.
8. **Network.** The only new request is the same-origin clip. No `fetch`, XHR, `window.open`, `createObjectURL`, file chooser, Whisper, Tesseract or speech module.
9. **Quality.** Lint, tests and build pass. No new dependency. The audio files are not edited or re-encoded.