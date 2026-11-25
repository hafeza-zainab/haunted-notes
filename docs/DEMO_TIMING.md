# Demo timing: subtitles and narration clips

Branch `demo-sync`. Numbers come from the script data (`src/lib/demoScript.ts`), the manifest (`public/demo-audio/manifest.json`: clip lengths measured with `audio.duration` in Chromium, and the cue time of every phrase measured from the quiet gaps in the WAV files), and full runs in Chromium through the Playwright MCP (dev server). Nothing here was heard: headless Chromium has no speaker. Times are in seconds at normal speed.

## What was wrong before

The captions were my own wording, not the narration ("Four inputs feed one ghost pipeline." while the voice said "Add notes four ways."), and the quiz chapter was 49.4 s long while its narration lasted 21.7 s, so the answers from about 75 s to 102 s were given in silence. Now each caption is a piece of the narration, shown when those words are spoken, and each chapter is only as long as its clip plus room to read the last screen.

## Chapters and clips

| Ch | Chapter | Start | Chapter length | Clip | Headroom | Subtitles |
|---|---|---|---|---|---|---|
| 1 | Intro | 0.00 s | 7.00 s | 5.04 s | 1.96 s | 2 |
| 2 | Four inputs | 7.00 s | 23.00 s | 20.24 s | 2.76 s | 7 |
| 3 | Ghost rooms | 30.00 s | 12.60 s | 11.04 s | 1.56 s | 4 |
| 4 | The quiz | 42.60 s | 26.50 s | 21.68 s | 4.82 s | 7 |
| 5 | Spaced repetition | 69.10 s | 17.00 s | 14.88 s | 2.12 s | 5 |
| 6 | Study insights | 86.10 s | 8.40 s | 6.80 s | 1.60 s | 3 |
| 7 | Your data stays yours | 94.50 s | 8.80 s | 7.12 s | 1.68 s | 3 |
| 8 | Built with Kiro | 103.30 s | 12.80 s | 11.12 s | 1.68 s | 3 |
| 9 | Try it yourself | 116.10 s | 9.00 s | 7.04 s | 1.96 s | 2 |

Script total: **125.1 s (2:05)**, 36 steps. Measured: 125.5 s from the click to the bar closing (the extra 0.4 s is the wait for the first sound, below). The clips total 104.96 s. The earlier script was 166.6 s; it is 41.5 s shorter because the chapters no longer wait in silence after the voice has finished. A test requires the run to be at least as long as all clips together, and every clip to end at least 0.4 s plus a 1 s start-up allowance before its chapter ends.

## Every subtitle, with its start

`Cue` is the start of the phrase inside the clip (measured). `Shown` is when the caption appears, counted from the chapter start. A caption appears up to 0.2 s after its cue; a test checks this against the manifest. Cues marked (est.) are splits inside one phrase with no quiet gap, placed by word count.

| Ch | Cue | Shown | Subtitle (exactly the narration) |
|---|---|---|---|
| 1 | 0.00 | 0.00 | Haunted Notes turns your unfinished notes into ghosts |
| 1 | 3.20 | 3.30 | that haunt you until you master them. |
| 2 | 0.00 | 0.00 | Add notes four ways. |
| 2 | 1.85 | 2.00 | Type them, speak with your microphone, |
| 2 | 4.20 | 4.30 | snap a photo of printed text, or upload an audio recording. |
| 2 | 8.10 | 8.20 | Audio files and photos are processed on your own device, |
| 2 | 11.25 | 11.35 | and the live microphone uses your browser's speech service. |
| 2 | 14.50 | 14.60 | Each note is split into fill-in-the-blank flashcards, |
| 2 | 17.40 | 17.50 | so even a long lecture becomes a short set of questions. |
| 3 | 0.00 | 0.00 | Every note becomes a haunted room. |
| 3 | 2.30 | 2.40 | Each flashcard you have not mastered is a ghost, |
| 3 | 5.25 | 5.35 | and the weaker your memory of it, the more menacing it looks. |
| 3 | 8.45 | 8.55 | The meter at the top shows how crowded your haunting is. |
| 4 | 0.00 | 0.00 | Start a quiz and fill in each blank. |
| 4 | 2.75 | 2.85 | Stuck? Ask for a hint, or reveal the answer. |
| 4 | 6.10 | 6.20 | A wrong answer breaks your quiz streak and sends the ghost |
| 4 | 8.70 (est.) | 8.80 | back to the start of its review ladder. |
| 4 | 11.20 | 11.30 | A right answer banishes it. Small typos on long words are forgiven, |
| 4 | 15.60 | 15.70 | and the answer is never hidden in the page before you respond. |
| 4 | 18.80 | 18.90 | When the round ends, review only the cards you missed. |
| 5 | 0.00 | 0.00 | Banished ghosts do not stay gone. |
| 5 | 2.55 | 2.65 | A review ladder brings each one back after two days, |
| 5 | 5.65 | 5.75 | then three, five, and seven. |
| 5 | 8.50 | 8.60 | Jump ahead, and the ghosts that are due return, glowing orange. |
| 5 | 12.35 | 12.45 | Ignore them longer, and they look stronger. |
| 6 | 0.00 | 0.00 | Your study insights show your day streak, |
| 6 | 2.50 | 2.60 | what you reviewed today, your accuracy this week, |
| 6 | 5.65 | 5.75 | and your weakest rooms. |
| 7 | 0.00 | 0.00 | Your notes live in your browser. |
| 7 | 2.05 | 2.15 | Export a backup any time, and import it back |
| 7 | 4.40 (est.) | 4.50 | with a safety check before anything is merged. |
| 8 | 0.00 | 0.00 | Haunted Notes was built with Kiro, using specs, steering files, hooks, |
| 8 | 4.85 | 4.95 | a custom UI reviewer agent, a Playwright MCP server, |
| 8 | 8.65 | 8.75 | and property-based tests that caught real bugs. |
| 9 | 0.00 | 0.00 | Try it yourself. The live link and the source code are below. |
| 9 | 3.50 | 3.60 | Built for Kiroween 2026, in the Frankenstein category. |

## Measured in a full run (1280px)

For every caption: the time it appeared minus the time its words became audible (from `audio.currentTime` sampled every 50 ms). Negative means the caption came first.

| | First run | After the first-sound wait |
|---|---|---|
| Captions compared | 36 | 36 |
| Caption text equals the cue text | 36 of 36 | 36 of 36 |
| Worst offset | 736 ms early (intro) | 311 ms early (intro) |
| Mean offset | 92 ms | 57 ms |
| Captions more than 150 ms early | 3 (intro 736 and 637 ms, chapter 5 first caption 195 ms) | 3 (intro 311 and 199 ms, chapter 5 first caption 168 ms) |

All offsets were early, never late, which is how subtitles normally behave. The two intro captions were early by 0.64 to 0.74 s because the first sound in a page starts 0.5 to 0.8 s after `play()`. The run now starts the first clip inside the click and waits (at most 1.5 s) until that audio is really playing before its clock starts, so this no longer depends on the device. A missing or blocked first clip ends the wait at once (a test checks the code path; the missing-clip case was run for chapter 3, not chapter 1).

## What the quiz chapter does now

A three-card room (Biology), so a round ends in time for "review only the cards you missed". Times are from the start of the chapter, with the narration phrase on the same row.

| Time | Narration | On screen |
|---|---|---|
| 0.9 to 2.8 | Start a quiz and fill in each blank. | The room's Quiz button is outlined and pressed. |
| 3.4 to 5.6 | Stuck? Ask for a hint, or reveal the answer. | Hint twice (first letter, then length), then Reveal and Next. |
| 6.2 to 8.8 | A wrong answer breaks your quiz streak and sends the ghost | "not sure" is typed and submitted; the ghost shakes; the answer shows. |
| 8.8 to 11.3 | back to the start of its review ladder. | The wrong-answer message stays; then Next. |
| 11.3 to 15.7 | A right answer banishes it. Small typos on long words are forgiven, | The answer is typed with one wrong letter (if it has 6+ letters) and submitted: "Close enough! Banished!" |
| 15.7 to 18.9 | and the answer is never hidden in the page before you respond. | The results screen. |
| 18.9 to 26.5 | When the round ends, review only the cards you missed. | Review missed is outlined and pressed, and the two missed ghosts are answered. |

Two honest gaps: the narration about typos and about the answer not being in the page is said while the results screen is up (the round has only three cards), and the last 5 s of the chapter (the two review answers) have no new narration, only the answer sounds. If the card that is answered with a typo has fewer than 6 letters (DNA), it is answered exactly instead, because the quiz would mark a typo on a short word wrong. The cards come in random order, so this happens in about a third of runs.

## Answer sounds

The right (three-tone chime) and wrong (low buzz) sounds now play during Run demo, at 40% of their normal volume, and follow the Sound on / Sound off button of the bar. In a run they sounded 5 times (13 tones): Reveal, the wrong answer, the typo'd answer and the two review answers. Not heard; measured as tones started and their volumes.

## How to re-measure

1. `npm run dev`, then open the app. Measure clip lengths with `new Audio('/demo-audio/chapter-N.wav')` and `loadedmetadata`.
2. Update `durationMs` and the `cues` in `public/demo-audio/manifest.json`. A cue is the end of the quiet gap before the phrase in the WAV.
3. `npm test`: the tests check the captions against `NARRATION_SCRIPT.md`, the cues against the audio, and that every clip fits.