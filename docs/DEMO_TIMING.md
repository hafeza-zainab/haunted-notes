# Demo timing: narration clips against the script

Branch `demo-audio`. All numbers below come from the script data (`src/lib/demoScript.ts`), the manifest (`public/demo-audio/manifest.json`, durations measured with `audio.duration` in Chromium) and one full run in Chromium through the Playwright MCP at 1280px (dev server). Nothing here was heard: headless Chromium has no speaker. Times are in seconds at normal speed.

## Chapters and clips

| Ch | Chapter | Your file before rename | Start | Chapter length | Clip | Headroom | Fits (0.4 s margin) | Headroom left after 1 s start-up allowance |
|---|---|---|---|---|---|---|---|---|
| 1 | Intro | 1 Intro.wav | 0.00 s | 7.00 s | 5.04 s | 1.96 s | yes | 0.56 s |
| 2 | Four inputs | 2 Four inputs.wav | 7.00 s | 30.90 s | 20.24 s | 10.66 s | yes | 9.26 s |
| 3 | Ghost rooms | 3 Ghost rooms.wav | 37.90 s | 15.50 s | 11.04 s | 4.46 s | yes | 3.06 s |
| 4 | The quiz | 4 The quiz.wav | 53.40 s | 49.40 s | 21.68 s | 27.72 s | yes | 26.32 s |
| 5 | Spaced repetition | 5 Spaced repetition.wav | 102.80 s | 19.30 s | 14.88 s | 4.42 s | yes | 3.02 s |
| 6 | Study insights | 6 Insights.wav | 122.10 s | 11.00 s | 6.80 s | 4.20 s | yes | 2.80 s |
| 7 | Your data stays yours | 7 Your data.wav | 133.10 s | 11.00 s | 7.12 s | 3.88 s | yes | 2.48 s |
| 8 | Built with Kiro | 8 Built with Kiro.wav | 144.10 s | 13.50 s | 11.12 s | 2.38 s | yes | 0.98 s |
| 9 | Try it yourself | 9 End.wav | 157.60 s | 9.00 s | 7.04 s | 1.96 s | yes | 0.56 s |

Script total: **166.6 s (2:46.6)**. Measured in the browser: 166.63 s from the click on Run demo to the bar closing. The limit is 2:55 (175 s) for the run and 3:00 for the video. Clips total 104.96 s.

The files were renamed from `N Title.wav` to `chapter-N.wav` (content unchanged; SHA-256 of every file was the same before and after, and the committed blobs are byte-identical).

## What did not fit, and what was done

- **Chapter 9 (End):** the clip is 7.04 s and the chapter was 6.0 s. It would have been cut by the end of the run. Fix: a 3 s hold in the end step (`END_HOLD_MS`). Nothing in the audio was changed.
- **Chapter 1 (Intro):** it fitted (5.04 s in 6.0 s) but with only 0.96 s of room, and the first sound in a page started 0.5 to 0.8 s after `play()` (see below). Fix: a 1 s hold in the intro step (`INTRO_HOLD_MS`).
- A data test now requires every clip to end at least 0.4 s before its chapter does, and a second test requires a further 1 s for the browser to start the audio.

## When the sound really starts

The script calls `play()` on time. The browser then needs time to start its audio output, so the sound begins a little later. Measured from `audio.currentTime` sampled every 100 ms in the full run:

| Ch | play() called after scheduled start | Sound audible after scheduled start | Clip ended before the next chapter by |
|---|---|---|---|
| 1 | 2 ms | **504 ms** (first sound in the page) | 1.46 s |
| 2 | 16 ms | 91 ms | 10.57 s |
| 3 | 18 ms | 103 ms | 4.36 s |
| 4 | 10 ms | 91 ms | 27.63 s |
| 5 | 22 ms | **536 ms** (27 s of silence before it) | 3.88 s |
| 6 | 12 ms | 89 ms | 4.11 s |
| 7 | 17 ms | 95 ms | 3.79 s |
| 8 | 6 ms | 85 ms | 2.30 s |
| 9 | 23 ms | 89 ms | 1.90 s before the run ended |

- Every clip reached its end (`ended`) before the next chapter began.
- Seven clips become audible within about 100 ms of their chapter start. Clips 1 and 5 take 0.5 s, because the audio output has to start (first sound) or restart (after a long silence). An earlier run of the same page measured 0.80 s for clip 1.
- A clean test in the same browser showed the file load itself costs only 34 to 70 ms. The start-up time depends on the machine and the audio device, so it can be longer on yours.

## Things to check by ear

- **What is said when.** Each clip starts with its chapter and plays once; it is not tied to individual steps. The quiz clip is 21.7 s long but the quiz chapter lasts 49.4 s, so the results screen and "Review missed" come about 25 s after the narration ends. Chapter 2 has about 10 s of captions-only time at the end. If your narration mentions something that appears later in its chapter, it will be said before it shows. `NARRATION_SCRIPT.md` was not in the repository, so this was not checked.
- **Clip 1 and clip 5 start a little late** (see above). If the intro sounds late, tell me and I can lengthen the hold.
- **A too-long clip.** If you replace a clip with a longer one: shorten the text in `NARRATION_SCRIPT.md` and regenerate that one clip, or ask me to add a hold step to that chapter. Then re-measure (`audio.duration` in the browser), update `manifest.json`, and run `npm test`: the fit test fails if a clip no longer fits.

## How to re-measure

1. Start `npm run dev`. Open the app, then in the browser console run
   `for (let n = 1; n <= 9; n++) { const a = new Audio('/demo-audio/chapter-' + n + '.wav'); a.addEventListener('loadedmetadata', () => console.log(n, Math.round(a.duration * 1000))) }`
2. Put the numbers in `public/demo-audio/manifest.json` (`durationMs`).
3. `npm test` checks that the manifest matches the script and the WAV headers, and that every clip fits.